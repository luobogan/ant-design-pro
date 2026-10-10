---
name: 起止节点建模分析与UserTask根治
overview: 把「开始/结束事件本质 + 仅作标记的问题 + 申请人填单建模为 UserTask 的根治方案」落成 springBlade/doc/md/ 设计文档，并分阶段计划：先修两个止血缺陷（BPMN 读源 nodeType 口径不一致、act 读源与合成待办冲突），再推进 UserTask 根治改造。
todos:
  - id: write-design-doc
    content: 将三部分分析落成 springBlade/doc/md/ 下的设计文档，含代码行号引用与实测证据
    status: completed
  - id: fix-reader-node-type
    content: 统一 WfBpmnExtensionReader 的 node() 与 nodes() 口径，非 UserTask 按元素类型权威映射 nodeType
    status: completed
  - id: fix-act-read-source
    content: act 读源屏蔽退回发起人期间停在第一审批节点的停靠任务，列表与角标计数同步
    status: completed
  - id: regression-verify
    content: 用 [skill:springblade-dev-login] 回归验证发起、退回发起人、重新提交、归档全链路
    status: completed
    dependencies:
      - fix-reader-node-type
      - fix-act-read-source
  - id: refactor-designer-model
    content: 改造设计器与 BPMN 建模：申请人填单改为 UserTask，并编写存量定义迁移方案
    status: completed
    dependencies:
      - write-design-doc
  - id: refactor-start-api
    content: 改造部署路径与发起页、发起接口，使发起后停在填单 UserTask，草稿机制并入
    status: completed
    dependencies:
      - refactor-designer-model
  - id: remove-runtime-specials
    content: 用 [subagent:code-explorer] 排查后删除运行期特例并收敛结束节点配置
    status: completed
    dependencies:
      - refactor-start-api
---

## 产品/需求概述

围绕「BPMN 起止事件（StartEvent / EndEvent）被当作业务节点使用」这一建模错配，产出一份可长期维护的设计文档，并按「先止血、再根治」的节奏给出可执行的改造计划。

## 核心诉求

1. **文档落地**：把已完成的专题分析落成 `springBlade/doc/md/` 下的设计文档，沿用该目录中文命名风格。
2. **止血修复**：修复两个已定位、且相互独立的缺陷，使「退回发起人」在当前架构下表现正确。
3. **根治改造**：将「申请人填单」从 startEvent 标记改造为真正的 UserTask（等待态），废除合成待办与状态分裂，并收敛结束节点的装饰性配置。

## 功能范围

### 文档内容（三部分）

- 一、BPMN 规范中开始/结束事件的本质含义（仅代表流程实例或分支的起止逻辑信号，不承载业务动作、页面跳转或数据处理）
- 二、仅将其当作「逻辑标记」使用时，在前端用户体验与流程功能层面的具体问题（UI 隐藏起止节点后的用户感知、流程可视化、待办生成、状态管理等），开始节点与结束节点分别展开
- 三、根治方案：形态、为何最干净、对 BPMN 建模/部署/发起页/发起接口的具体影响与改动范围

### 缺陷① BPMN 读源自身不一致导致退回落错分支

`WfBpmnExtensionReader.nodes()`（复数）对 StartEvent 用 `syntheticNode` 强制 `nodeType=0`，使其成为合法退回候选；而 `node()`（单数）走 `toProcessNode`，`nodeType` 只取自 `wf:node` 扩展属性。实测部署 BPMN 中 `<startEvent id="Event_1wh3dpi">` 的 `wf:node` **无 nodeType 属性** → `node()` 返回 `nodeType=null` → `WfTaskServiceImpl` 469 行 `nodeType==0` 判定失败 → 落 else 分支执行 `moveActivity + advance()` → 引擎从 startEvent 自然流出停在第一审批节点、`advance` 生成审批人待办并把 `current_node_key` 改回 `Activity_16wyet2`，即「等于没退回」。

证据：实例 2107151967368323074，`ACT_HI_COMMENT` 仅 3 条（00:52:32 提交 / 00:53:43 退回#1 / 01:03:36 退回#2），两次退回之间**无任何重新提交**，但每次退回同一秒即重建 3 条待办；`ACT_HI_TASKINST` 删除原因为 `Change parent activity to Event_1wh3dpi`。

### 缺陷② 与 `task-read-source: act` 的结构性冲突

`rejectToStarter` 刻意让引擎停在第一审批节点（真实 `ACT_RU_TASK` 行），台账记「当前节点=开始节点」+ 给发起人一条 `engine_task_id` 为空的合成待办。读源=act 读引擎真实任务 → 那 3 条停靠任务照样进入审批人待办、照样可提交/退回；合成待办反靠 `WfTaskActReader` 兜底 merge 才显示。即使修好缺陷①，该现象依然存在。

### 根治方案

把创建节点底层元素类型从 `startEvent` 改为 `userTask`（保留 `wf:node nodeType=0` 的业务语义），使引擎真正为其生成任务并停住 token，从而消灭「状态分裂」与「合成待办」两个概念，让创建节点与审批节点同构。

## 约束与边界

- 不得为跑通测试擅自修改共享 dev 环境配置/开关（含 Nacos）；`task-read-source` 当前为 `act`，如需回退 `wf` 必须先说明因果链并获用户确认。
- `blade-workflow-dev.yaml` 在 Nacos 不存在（404），相关开关均取 `application.yml` 本地值。
- 根治改造属建模范式变更，须灰度：新定义走新模型，存量定义与在途实例保留兼容分支。

## 技术栈

沿用项目现有技术栈，不引入新框架。

- 后端：Java 17 / Spring Boot 3.5.9 / Spring Cloud 2025.0.1 / Spring Cloud Alibaba 2025.0.0.0
- 流程引擎：Flowable 8.1.0-SNAPSHOT（`flowable-engine` / `flowable-spring`）
- ORM：MyBatis Plus 3.5.19；数据库 MySQL 8（`blade` 库，`wf_*` + `ACT_*`）
- 配置中心：Nacos 3.x（v3 API）
- 前端：React + TypeScript + Ant Design Pro；流程图 bpmn-js NavigatedViewer
- 文档：Markdown，落于 `springBlade/doc/md/`

## 实现思路

**总体策略**：先做两处互不依赖、影响面可控的止血修复（分别针对缺陷①的读源口径、缺陷②的读源冲突），验证通过后再推进建模范式改造。止血与根治解耦，止血不依赖根治，可独立上线。

**关键技术决策**

1. **止血①采用「统一读源口径」而非「改数据」**
把 `WfBpmnExtensionReader.node()` 与 `nodes()` 对齐：非 UserTask 元素按**元素类型**权威映射 nodeType（StartEvent=0 / EndEvent=3 / Gateway=7 / ReceiveTask·IntermediateCatchEvent·ThrowEvent=5 / Service·Script·Send·BusinessRule·CallActivity=6 / ManualTask=1），复用现成的 `syntheticNode`。

- 理由：改数据（给存量 BPMN 的 `wf:node` 补 `nodeType="0"`）只能治当前这一份定义，且需全量回填；统一口径一次性修复所有消费方（`loadNode` 被 `doApprove` / 转办 / 抄送 / 列表节点名 / 退回目标校验共用），且不触碰数据。
- 兼容性：对 UserTask 行为零变化；对非 UserTask 从「可能为 null」变为「恒有值」，与 `nodes()` 及 `wf_process_node` 既有口径一致，属收敛而非新增语义。

2. **止血②采用「读侧按实例语义屏蔽」，不改引擎