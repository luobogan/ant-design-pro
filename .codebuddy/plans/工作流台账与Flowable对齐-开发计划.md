---
name: 工作流台账与Flowable对齐-开发计划
overview: 整合《工作流台账与Flowable引擎对齐改造_按优先级顺序执行》《Flowable7整合wf_节点与出口信息-整体改造方案》《flowable-authoritative-trigger》三份文档。前者为 5 阶段台账对齐（会签下沉BPMN多实例/审批轨迹迁ACT_HI_COMMENT/抄送传阅迁identity link/方案C事件驱动/C档保留），全 completed；中者为架构级总体方案（节点/出口信息事实源下沉 BPMN extensionElements）；后者为触发与版本解析权威源迁 Flowable 原生身份（procKey+tenant），全 completed。
todos:
  - id: ledger-align-5stage
    content: 5 阶段台账对齐：会签/或签/依次下沉 BPMN 多实例、审批轨迹迁 ACT_HI_COMMENT、抄送传阅迁自定义 identity link、方案C 事件驱动派生状态、C 档（组织/快照/设计态/草稿/催办）保留不动
    status: completed
  - id: node-link-sink-bpmn
    content: 架构总体方案：节点信息 + 出口信息事实源从 wf_* 侧表下沉到 BPMN 模型本身（extensionElements），消除设计期/部署期静默漂移
    status: completed
  - id: authoritative-trigger
    content: 触发与发起版本解析权威源从 wf_process_definition 迁 Flowable 原生身份（procKey+TENANT_ID_+版本/pdId），消解 R-A~R-E；含部署落 TENANT_ID_ 幂等迁移与 dev 回归
    status: completed
---

# 工作流台账与 Flowable 对齐 — 开发计划（整合版）

> 整合 `工作流台账与Flowable引擎对齐改造_按优先级顺序执行`、`Flowable7整合wf_节点与出口信息-整体改造方案`、`flowable-authoritative-trigger`。
> 注意：本计划与 `去wf_表改造-开发计划.md` 高度相关（同属「wf_* 下沉引擎」主题），本文件侧重**早期架构决策与触发权威源迁移**，去 wf_ 表计划侧重**22 张表分流改造的剩余项收口**。

## 一、目标

把 blade-workflow 中"越界自建、Flowable 引擎本可原生承载"的能力逐步下沉到引擎，消灭重复维护（而非消灭 `wf_*`），并让流程触发/版本解析以 Flowable 原生身份为权威源。

## 二、真实完成度（源文件 todos 全 completed）

| 子计划 | 内容 | 状态 |
| --- | --- | --- |
| 5 阶段台账对齐 | ①会签/或签/依次下沉 BPMN 多实例（SignOrder→completionCondition/isSequential）②审批轨迹/意见迁 ACT_HI_COMMENT、退役 wf_approval_log 重复存储 ③抄送/传阅迁自定义 identity link（cc/circulate，不产生可办任务）④方案C 事件驱动派生台账状态（FlowableEventListener + WfStateProjector）⑤C 档（组织/快照/设计态/草稿/催办）保留不动 | ✅ |
| 节点/出口信息下沉（总体方案） | 架构级：把 wf_process_node / wf_node_link 的事实源下沉到 BPMN（拓扑+全部语义），wf_* 降级为只读投影；承接载体为 UserTask extensionElements / SequenceFlow 原生 conditionExpression | ✅（方案定稿，部分已在去 wf_ 表计划落地） |
| 触发权威源迁移 | 部署落 TENANT_ID_（幂等回填脚本）、workflow_key 加列与双读回退、WfInstanceServiceImpl 按 (procKey,tenant) 解析版本与挂起态、收窄测试数据断言、dev 浏览器审批回归通过 | ✅ |

## 三、关键决策

- `ACT_*` 表早期约束"不可加列"（仅原生表+变量表）；后续去 wf_ 表计划放宽加原生业务列（见 `去wf_表改造-开发计划.md`）。
- 每项改造独立 `@ConditionalOnProperty` 开关，可灰度、可回滚；与 `wf_*` 同 DataSource。
- 版本锁定 Flowable（7.1.0 → 8.1.0-SNAPSHOT，见去 wf_ 表计划）。

## 四、关键文件

```
springBlade/blade-service/blade-workflow/.../
├── service/impl/WfInstanceServiceImpl.java        # 权威源解析版本/挂起态
├── service/impl/ApprovalTriggerServiceImpl.java    # 触发换绑 workflow_key
├── listener/WfEngineEventListener.java / helper/WfStateProjector.java
└── config/FlowableConfig.java
springBlade/doc/sql/migration/V2026.10.02__*.sql    # tenant/workflow_key 幂等回填
```
