---
name: 方案C-台账对账与摘除显式写-开发计划
overview: 事件驱动台账投影（方案C）的统一开发计划，整合原 6 份分散文档（阶段1/2/3 计划、两次被取代的早期阶段3迭代、A类漂移修复、§3.4 异步执行器设计）。结论：阶段1(影子实测)→阶段2(真实反写双写校验)→阶段3(摘除业务显式写、改引擎事件单一驱动) 已全部完成，含「不通过(2)终态派生」；A类漂移误报已修复。§3.4 异步执行器按 A/B 路径决策，当前走 A 路径（WfTimeoutJob 覆盖超时，未开异步执行器）。
todos:
  - id: stage1-shadow
    content: 阶段1 影子实测：WfStateProjector 加只读比对 + ledger-listener 跑影子，确认差异计数=0
    status: completed
  - id: stage2-writeback
    content: 阶段2 真实反写：注入 Mapper、先查后写幂等、isFailOnException=true、双写校验
    status: completed
  - id: stage3-strip
    content: 阶段3 摘除 suspend/activate/terminate 业务显式写，改 ENTITY_SUSPENDED/ACTIVATED/PROCESS_CANCELLED 事件单一驱动
    status: completed
  - id: stage3-2derive
    content: 新增 wf_instance.pending_status intent 列，使「不通过(2)」终态可被 PROCESS_CANCELLED 正确派生（非注释守卫降级）
    status: completed
  - id: fix-drift-a
    content: 修复 drift_check.sql A 类误报（排除退回发起人合法中间态）+ 运行期同条件 WARN 兜底告警
    status: completed
  - id: async-executor-decision
    content: §3.4 异步执行器：当前 A 路径（WfTimeoutJob 超时，asyncExecutorActivate=false）；仅 B 路径（需 Flowable 定时器/异步节点）才开启，附 C1 降级+常驻对账+死信告警三项兜底
    status: completed
---

# 方案C — 台账对账与摘除显式写 开发计划（整合版）

> 本文件整合原 6 份文档：`方案C-§3.4…`、`方案C阶段1实测与阶段2-3…`、`方案C阶段3之1…`、`方案C阶段3-摘除暂停恢复终止…`、`方案C阶段3-摘除显式写并支持不通过2终态派生…`、`修复A类漂移误报…`。
> 早期两份「阶段3之1 / 阶段3(无2派生)」已被最终执行版取代，属历史废弃方案，不再单独保留。

## 一、目标

消除 `wf_instance` / `wf_task` 与 `ACT_*` 的**双写漂移**：让台账状态由**引擎事件单一驱动**，业务代码不再手写两侧。

阶段阶梯（§6 灰度）：
- **阶段1 影子实测**：开 `blade.workflow.ledger-listener.enabled=true` 跑影子比对，确认差异计数=0（不可跳过）。✅
- **阶段2 真实反写**：注入 Mapper、先查后写幂等、`isFailOnException=true`，并与业务显式写并存双写校验。✅
- **阶段3 摘除显式写**：摘掉 `WfWriteHelper#suspend/activate/terminate` 的 `wf_instance` 状态与关待办显式写，改由引擎事件反写；保留开关关闭时的兜底显式写（守住一键回退到方案A）。✅

## 二、真实完成度（依据最终执行版 todos 全 completed）

| 项 | 状态 | 依据 |
| --- | --- | --- |
| 阶段1 影子实测 + 差异计数 | ✅ | 最终版依赖链上游 completed |
| 阶段2 真实反写 + 双写校验 | ✅ | 同上 |
| 阶段3 摘除 suspend/activate/terminate 显式写 | ✅ | `WfWriteHelper` 改造 completed |
| 不通过(2) 终态派生 | ✅ | 新增 `wf_instance.pending_status` intent 列，`WfStateProjector#writeCancel` 读列派生 2/3 后清空 |
| 扩展 closeResidualTodos（待办0/协办7） | ✅ | completed |
| 暂停/恢复/撤回回归（status=4/0/3，totalDiff=0） | ✅ | 编译重启回归 completed |
| A 类漂移误报修复 + 运行期 WARN 兜底 | ✅ | `修复A类漂移误报…` todos 全 completed |
| §3.4 异步执行器决策 | ✅（A 路径，未开启） | 设计文档定稿，当前走 A 路径 |

## 三、关键决策

1. **A 路径（当前）**：超时自动流转由 `WfTimeoutJob`（`@Scheduled` 轮询 `wf_task.due_time`）+ `WfTimeoutServiceImpl.fire()` → `taskService.autoApprove` 承载；`asyncExecutorActivate=false`、`asyncHistoryEnabled=false`、`history=audit` 保持不变。超时可用、零异步漏派风险。
2. **B 路径（按需）**：仅当确需 Flowable 定时器边界事件 / 异步节点时才 `setAsyncExecutorActivate(true)`，并显式配线程池参数（`asyncExecutorCorePoolSize/MaxPoolSize/QueueSize/…`），且 §3.4 三项兜底（C1 降级为最终一致 + 常驻对账 + 死信告警）成为硬性前提。
3. **C1 强一致**：阶段2 起 `WfEngineEventListener.isFailOnException()` 返回 `true`（监听写失败回滚整个引擎操作）；异步维度上 C1 失效，故 B 路径须配兜底。
4. **保留项**：`WfWriteHelper#appendLog`（OA 独占写）、`processService.suspend/activate/deleteProcessInstance`（触发引擎事件的动作本身）、`advance()` 建待办逻辑——均不动。
5. **已否决**：不为解决 A 类误报改 `wf_task.assignee` 为可空；不为此开 `engine-multi-instance.enabled`；不动 `rejectToStarter`；早期「只摘 suspend/activate（阶段3之1）」「不摘 2 派生」两种方案已被最终版取代。

## 四、关键文件（改动落点）

```
blade-service/blade-workflow/.../
├── service/helper/WfWriteHelper.java            # 阶段3：suspend/activate/terminate 改事件驱动优先 + 开关兜底
├── listener/WfEngineEventListener.java          # C1 强一致（isFailOnException=true）
├── service/helper/WfStateProjector.java         # 影子比对 + closeResidualTodos + writeCancel(读 pending_status 派生 2/3)
├── service/impl/WfInstanceServiceImpl.java      # 1056/1072/1746 注释更新；运行期 A 类兜底 WARN
├── config/FlowableConfig.java                   # §3.4 异步执行器开关（当前关）
└── doc/sql/.../drift_check.sql                 # A 类误报修正（排除退回发起人）
```

## 五、历史废弃方案（已取代，仅留痕）

- `方案C阶段3之1-摘除暂停恢复的台账状态显式写`：早期只摘 suspend/activate、terminate 不动——被最终版（三类同摘）取代。
- `方案C阶段3-摘除暂停恢复终止的台账状态显式写`：未含「不通过(2) 派生 intent 列」——被最终版（含 pending_status）取代。
