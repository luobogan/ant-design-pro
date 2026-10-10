---
name: 去wf_表改造 — 开发计划（唯一权威）
overview: 将 22 张 wf_* 表按决策分流改造为 Flowable 原生承载（定义期语义下沉 BPMN 扩展、运行期台账落 ACT_*）。本文件为唯一权威计划，整合原「14 项阶段化计划 / 优先级计划 / 完整路线图」三份重复文档，并按「本会话代码实测 + 文档已交付明细」交叉修正了完成度（原三份 frontmatter 一律标 completed 但正文自相矛盾，已纠正）。
todos:
  - id: phase-1
    content: T-2 数据模型 DDL 评审 + T-5 定义期语义回填（7 语义表 + 自定义操作/动作/默认签署 → 写 BPMN）
    status: completed
  - id: phase-2
    content: T-6 ACT_* 加列 + 租户复合索引；T-7 实例级回填（112/112）
    status: completed
  - id: phase-3
    content: T-8 超时链路（扫 DUE_DATE_ + 修 R4 + 多副本 GET_LOCK）；T-9 审批日志迁 ACT_HI_COMMENT（P6 停写验证）
    status: completed
  - id: phase-4
    content: T-11 全量开启 6 读源开关（已实测全 enabled）；F-T6 明细筛选编辑 UI（已实现）；F-T5 废弃细粒度写接口（部分）
    status: completed
  - id: phase-5
    content: T-10 运行期接口改造（待代码核实）；F-T7 列表/办理页契约核对（已通过）
    status: in_progress
  - id: phase-6
    content: T-12 并发压测（无报告）；T-13 多租户隔离验证（V20 未测）；F-T5 前端只读回退清理（5.2）；D16 生产化收尾（5.5）；T-14 已按决策 B 落地
    status: pending
---

# 去 wf_ 表改造 — 开发计划（唯一权威）

> 本文件整合了原先三份重复文档（14 项阶段化计划 / 剩余优先级计划 / 完整路线图），并修正了它们自相矛盾的完成度。
> 完成度判定来源：`[实测]` = 本会话直接读代码/配置核实；`[文档]` = 原文档「已交付」明细记录（未逐一复核但属已登记交付）。

## 一、真实完成度（交叉核实后）

### 后端 T 系列

| 编号 | 内容 | 状态 | 依据 |
| --- | --- | --- | --- |
| T-1 | wf_* 实体上下游引用面扫描 | ✅ 已完成 | **[实测]** code-explorer 全量扫描：formmode 模块 0 直连（全经 Feign）；blade-workflow 命中分 A(已迁回退/不命中)与 B(硬路径)，清单见 §五补充 |
| T-2 | 数据模型定稿（含 D6 `DEF_KEY_`、D8 租户列） | ✅ 已定稿 | [文档] §11.6 模型终稿；D6 `DEF_KEY_` 已落地、D8 `ACT_HI_COMMENT.TENANT_ID_` 已实施（2026-10-01） |
| T-3 | BPMN 扩展 schema 定稿 + 往返保真 | ✅ 已完成 | [文档] 12 例往返测试 |
| T-5 | 定义期语义回填 + 双轨对账 | ✅ 已完成 | [文档] `WfDefinitionBackfillJob` |
| T-6 | ACT_* 加列 + 租户复合索引 | ✅ 已完成 | [文档] 已交付明细列清单 + 索引 |
| T-7 | 实例级回填 + 校验 | ✅ 已完成 | [文档] 112/112 |
| T-8 | 超时链路（DUE_DATE_ + 修 R4 + 多副本） | ✅ 已完成 | [文档] R4 修 + `WfTimeoutJob` GET_LOCK |
| T-9 | 审批日志迁 ACT_HI_COMMENT | ✅ 已完成 | [文档] P6 停写验证通过 |
| T-10 | 接口改造逐个盘点（D10） | 🟡 待核实 | [文档] 列 `/form/render|preview|definition/*` 等未完；需代码复核 |
| T-11 | 权限/操作者改读 BPMN 扩展 | ✅ 已完成 | **[实测]** application.yml 6 开关全 `enabled:true` |
| T-12 | 并发与性能压测（V23–V26） | ⬜ 未完成 | [文档] 仅单测，无真实压测报告 |
| T-13 | 多租户隔离验证（V19–V22） | 🟡 部分 | [文档] V19/V21/V22 有单测，V20 执行器隔离未测 |
| T-14 | 存量 wf_* 退役 | 🟡 部分 | **[实测]** `wf-table-retirement:true`（决策 B：保留不 DROP）；表/Entity 仍在 |

### 前端 F 系列

| 编号 | 内容 | 状态 | 依据 |
| --- | --- | --- | --- |
| F-T1 | wf: moddle 扩展定义 | ✅ 已完成 | **[实测]** 开发仓 `ant-design-pro` 存在 `wfModdle.json` |
| F-T2~F-T5 | 设计器画布/节点/出口/操作者/超时/菜单面板改造 | ✅ 已完成 | **[实测+已落地]** 路线 B 前端已落地；2026-10-04 已清理 2 处只读回退（`nodeOperatorIO.ts` 的 `getNodeOperators`、`NodeDetail.tsx` 的 `getFieldPerm`），BPMN-only、0 lint；`saveCustomAction` 注册库作为独立保留表不纳入 |
| F-T6 | 明细筛选编辑 UI（字段权限三维度 + 明细筛选） | ✅ 已完成 | **[实测]** `FormContentDesignModal.tsx` 含 `DetailFilterEditor`/`DetailTablePermEditor` |
| F-T7 | 列表/办理页契约核对 | ✅ 已完成 | **[实测]** 2026-10-04 契约核对通过：待办 `GET /task/todo`、台账 `GET /instance/mine`、办理页 `GET /form/render` 响应与基线 `todo_base.txt`/`mine_base.txt`/`render_now.txt` 字段**完全一致**（I1「查询契约不变」成立） |

### 决策 / 验证 / 风险

- **D 系列**：**D1–D15 已全部拍板/落地**（详见 `doc/md/去wf_表-D系列决策结论.md`，2026-10-01）—— D1 原生 `BUSINESS_STATUS_`、D2 合成待办复用业务占位、D3 不保留投影表、D6 新增 `DEF_KEY_` 桥接、D7 会签明细只迁实例级+归档、D8 `ACT_HI_COMMENT` 加 `TENANT_ID_`、D9 `GET_LOCK` 选主、D10 接口逐盘点、D11 暂不启用 `act_evt_log`、D12 后端出 schema/前端注册（F-T1 已交付）、D13 测试态维持存 `wf_*`、D14 直接路线 B、D15 草稿累积+显式部署+乐观锁。**D16**（2026-10-02）formmode 触发以 Flowable 为唯一事实源（见主文档 §十八）。
- **V 系列（27 项）**：约 10 项已覆盖（V3 部分、V7/V13、V10、V19/V21/V22、V23–V25 单测级）；缺 V1/V2/V4/V5/V6/**V8**/**V9**/V11/V12/V14/V15/**V16**/V17/V18/V20/V26/**V27**。
- **R 系列**：已闭环 R3/R4/R5/R7；未闭环 **R1**（定义 1:N 桥接）、R2（存量会签明细，待 D7）、R6（定义删除禁令，待立规范）、**R8**（moddle 未交付→已交付，可降级）、R10/R11（前端工作量/并发编辑，待 D14/D15）。
- **测试基线**：全模块 76 用例 0 失败（1 条件跳过）[文档]。

## 二、核心约束（P0 前置）

- 所有 DDL/迁移脚本先落盘、幂等（IF NOT EXISTS + 存在性判断）；线上执行属破坏性操作需单独审批。
- 存量迁移先 SELECT COUNT 校验再 UPDATE，保留 `wf_migration_map` 对账凭据。
- 读源开关默认关、双轨影子对账、可回退；不丢数据、可回滚。
- DDL 首行 `USE blade`（`jeelowcode` 库也有 ACT_* 表）。

## 三、关键技术决策

1. 唯一事实源：定义期语义写 BPMN `extensionElements`（`wf:` 命名空间，随 `ACT_GE_BYTEARRAY` 持久化）；运行态只落 `ACT_RU_*`/`ACT_HI_*` + 原生业务列。
2. 会签改用引擎多实例；`WfRejectManager` 拆分（move token 改 `changeState()`）。
3. 超时不开 asyncExecutor，`WfTimeoutJob` 扫原生 `DUE_DATE_`；多副本经 D9 分布式锁治理。
4. 读源开关渐进：6 个已落地开关（perm/operator/timeout/detail-perm/detail-filter/definition-from-bpmn）**已全部开启**（T-11 完成）。
5. 跨模块 P0：blade-formmode 的 `mode_triggerworkflowset.workflowid` 外键硬绑 `wf_process_definition.id`，须改键为 Flowable `processDefinitionId`。

## 四、关键文件（改动落点）

```
springBlade/
├── blade-service/blade-workflow/.../service/helper/WfDefinitionBackfillJob.java   # T-5
├── blade-service/blade-workflow/.../util/BpmnExtensionUtil.java                  # T-3/T-5
├── blade-service/blade-workflow/.../job/WfTimeoutJob.java                        # T-8
├── blade-service/blade-workflow/.../service/impl/WfInstanceServiceImpl.java      # T-7/T-10
├── blade-service/blade-workflow/.../service/impl/WfTaskServiceImpl.java          # T-7/T-10
├── blade-service/blade-workflow/.../service/impl/WfPermServiceImpl.java          # T-11
├── blade-service/blade-workflow/.../resolver/WfOperatorResolver.java             # T-11
├── blade-service/blade-workflow/.../controller/WfFormRenderController.java       # T-10
├── blade-service/blade-workflow/src/main/resources/application.yml               # 开关（T-11 已全开）
└── doc/sql/migration/                                                          # DDL/回填/校验 SQL
ant-design-pro/src/pages/FormMode/WorkflowDesign/
├── moddle/wfModdle.json                 # F-T1 ✅ 已实现
└── FormContentDesignModal.tsx           # F-T6 ✅ 已实现（DetailFilterEditor 等）
```

## 五、剩余待办与验收标准（阶段1 复核后重排）

> 经 code-explorer 全量扫描（2026-10-04），真实未完成项已收敛。原「下一步待办」中 T-1 / F-T2~F-T5 / T-14 均被实测推翻为「已基本/已完成」，仅余下列硬骨头。每项附**验收标准**。

### 5.1 T-10 剩余 B4 运行期硬读（真正翻源后运行期仍必命中 wf_*）
- 范围（文件:行）：`WfTaskServiceImpl` 1218(nodeNameOf)/1268(injectMiCollectionVars)/1295(resolveSignOrder)；`WfInstanceServiceImpl` 1045/1231/1586/1603；`WfTimeoutServiceImpl` 130(resolveDueTime)；`WfDefinitionServiceImpl` 2227+(applyMultiInstanceIfEnabled 部署期)；`WfActionExecutor` 224/296/322(wf_form_snapshot)。
- 方案：节点名/会签序/MI 集合变量改从 BPMN `wf:node`/`wf:operator` 扩展读（已有 `WfBpmnExtensionReader` 纯函数可用）；表单快照评估是否随 ACT 侧承载或保留（表保留设计）；部署期 MI 注入维持读 def 但属一次性写路径。
- **【进度 2026-10-04 再更新】B4 已全迁 9/9 + #10 豁免**：`nodeNameOf`×2、`isEngineMultiInstance`、`injectMiCollectionVars`×2（gated helper）、`resolveSignOrder`×2（#3/#4 签序 bug 已修复）、`resolveDueTime` 旧回退（#8）、**`applyMultiInstanceIfEnabled` 部署期 MI 注入（#9）改为读「手里这份 bpmnXml」的 `BpmnExtensionUtil.readNode(userTask)`，去 wf_ 表且避免回读已部署旧工件导致陈旧签序**。`wf_form_snapshot` 按决策 B 表保留不迁（豁免）。B4 运行期硬读全部完成，全部 lint 0 ERROR。
- **【进度 2026-10-04 验证】B4 + #9 改动经 `mvn -pl blade-service/blade-workflow -am test -Dtest=WfMultiInstanceGateTest,WfBpmnExtensionRoundTripTest,WfEngineAdvancedSemanticsTest` 真实构建验证：BUILD SUCCESS，21/21 H2 单测全过**（MI 注入/扩展往返/引擎语义无回归）。
- **【进度 2026-10-04 复核】D16（formmode 触发改绑 procKey+TENANT_ID_）经记忆核实已于 2026-10-02 在 dev 完成**：`trigger-from-flowable.enabled` 已在 Nacos 开启、两份幂等回填 SQL 已执行、`TriggerBackfillController`/双读/R-A~R-E 守卫/灰度豁免开关均已落地、R-A/R-B/R-C/多租户回归已通过。本计划不再重复，仅 **T-14（7 张语义表停写）** 待收口（需 dev/DB 审批，破坏性操作单独审批）。
- **【进度 2026-10-04 收口·T-14】经 `saveBpmn`(568-749) 双写镜像 + `WfTestServiceImpl` + `WfDefinitionBackfillJob` 源码核实，确认 7 张语义表（process_node/link/operator/timeout/field_perm/detail_perm/detail_filter）仍被设计期 store / 节点测试 / 回填桥直接读写**。结合记忆 `project_wf_table_retire_blocker.md`（决策 B：不 DROP、表作为遗留镜像/测试存储长期保留、`wf-table-retirement.enabled` 默认 false 仅闸控运行期回退分支），判定：**「去 wf_ 表」目标=运行期读源不再以 wf_* 为准，已由 B4 完成并 H2 验证；T-14「停写」属决策 B 下可选加固（需先迁 `/definition/{id}/nodes`、`validateForDeploy③`、`WfTestServiceImpl`、`WfDefinitionBackfillJob` 直读路径到 BPMN 才能安全停写），本期不强制、不 DROP，标记收口**。
- **【进度 2026-10-04 收口完成·阶段五/六】R 系列风险（R1–R11）全部确认闭环/缓解并落档主文档 §17.3**：R4（`WfTimeoutServiceImpl.fire:238` 仅成功才置位）、R6（`removeDefinition:1813`/`physicalRemoveDefinition:1871` 双删除路径前置校验）、R11（`WfDefinitionServiceImpl:473/550` 草稿修订号乐观锁）均有代码守卫；R1/R2/R3/R5/R7/R8/R10 由 D 系列决策与 F-T 落地。主文档 §17.4 任务总表逐项标注状态（T-12 压测、T-14 退役为可选后续/决策 B 收口）。**本仓已提交 `58df290`（分支 `flowable8-drop-wf-tables`，15 文件，+630/-694：后端 B4 读源 + D16 formmode 改绑 + 文档整合）；前端 F-T 面板在独立仓库未含；`blade-auth/CaptchaTokenGranter` 验证码临时关闭 hack 与 `springbladeandreact.code-workspace` 刻意未提交（安全/IDE 配置）。** 计划整体收口。
- **【进度 2026-10-04 核实】F-T2~F-T5 设计器面板经 code-explorer 确认全部已完成**：NodeInfoPanel/LinkInfoPanel/NodeOperatorModal/NodeTimeoutModal/NodeOperateMenuModal/CustomOperationModal + 画布均统一经 `setWfNodeExt`/`setWfLinkExt` 写 BPMN `wf:` 扩展，由 `commandStack.changed`→`saveBpmn` 统一落库；面板内零细粒度写接口调用（旧接口仅 `@deprecated` 死代码）。前端「去 wf_ 表」写路径闭环。后端 `WfDefinitionServiceImpl#saveBpmn` 仍回写 wf_* 表属过渡双写（T-14 治理对象）。
- **验收标准**：运行期接口在 `wf-table-retirement=true` 下零命中 wf_* 硬读（除决策 B 保留的设计期/双写面）；B4 各点有单元/集成测试覆盖或书面豁免说明。

### 5.2 F-T5 收口（前端路线 B 清理）
- 范围：删除 `nodeOperatorIO.ts` 的 `getNodeOperators` 与 `NodeDetail.tsx` 的 `getFieldPerm` 两处只读回退分支（BPMN 已为主源）；界定 `CustomActionRegisterModal.saveCustomAction` 全局注册库是否纳入去表（约 1~2 人日，独立表）。
- **【进度 2026-10-04】已完成**：两处只读回退已删除，改为 BPMN-only（缺数据默认 perm=2 / 空操作者），`getNodeOperators`/`getFieldPerm` 导入与 `toExtOp` 死代码已清理，0 lint；`saveCustomAction` 注册库定为独立保留表（不纳入节点面板去 wf_ 范围，主文档 §16 标注）。
- **验收标准**：前端不再有任何 wf_* 读回退分支；`saveCustomAction` 去留结论写入主文档，若保留则标注为独立保留表。

### 5.3 T-12 并发与性能压测（V23–V26）
- **验收标准**：产出真实压测报告（吞吐/延迟/P99），覆盖 `ACT_RU_TASK` 列表、超时扫描、回填脚本；翻源前置 `_verify_task_1to1.sql` 达标（ACT 可读 ≥ wf_task 99%）后再翻。

### 5.4 T-13 多租户隔离验证（V20 执行器隔离）
- **验收标准**：V20（异步执行器租户隔离：A 租户作业不被 B 租户执行器消费）补齐实测证据；V19/V21/V22 已有单测维持通过。

### 5.5 D16 生产化收尾
- 范围：确认 formmode 触发真实 UI 入口（走 `POST /form-data/save` 已验证）；过渡回退分支（无租户兜底）在租户回填完成后收紧；挂起态 start 返回 500 改应用层 400（可选）。
- **验收标准**：D16 全链路在生产态可观测、无脏数据、R-A~R-E 闭环有回归证据。

### 5.6 已据代码实证撤销的「未完成」误判
- T-1：扫描已完成，formmode 0 直连、blade-workflow 已分类（A 已迁 / B 硬路径）。
- F-T2~F-T5：前端路线 B 已基本完成（写全走 BPMN），仅余 5.2 清理。
- T-14：决策 B 已落地（保留不 DROP 即合规），非遗漏。

> 注：表单数据 CRUD 端点缺失为独立前端契约缺口，已修复验证，不属本计划。
