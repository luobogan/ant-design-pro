# BPMN 2.0 Schema Reference (Flowable + `wf:` extension)

## Namespaces (declare once on `<definitions>`)

```xml
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:flowable="http://flowable.org/bpmn"
             xmlns:wf="http://www.springblade.org/workflow"
             xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
             xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"
             xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI"
             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
             targetNamespace="http://www.springblade.org/workflow">
```

## Node types

| Element | Meaning | Key attributes |
|---|---|---|
| `<startEvent>` | 开始 | `flowable:initiator="initiator"` (records starter var) |
| `<endEvent>` | 结束 | — |
| `<userTask>` | 用户任务（人工） | `flowable:assignee`, `flowable:candidateUsers`, `flowable:candidateGroups`, `flowable:formKey`, `flowable:dueDate` |
| `<scriptTask>` | 自动脚本任务（**不阻塞**） | `scriptFormat="javascript"` + `<script>...</script>` |
| `<serviceTask>` | 自动服务任务（**不阻塞**） | `flowable:type="..."` (or `flowable:class`/`delegateExpression`/`expression`) |
| `<task>` / `<manualTask>` | **阻塞**等待节点（谨慎用） | — |
| `<sendTask>` | 发送任务 | ⚠ requires `flowable:type`/`operation` or deploy fails — prefer `scriptTask` |
| `<exclusiveGateway>` | 排他网关（单选分支） | `default="Flow_x"` (optional but recommended) |
| `<parallelGateway>` | 并行网关（fork/join） | — |
| `<inclusiveGateway>` | 包容网关 | `default="Flow_x"` |
| `<subProcess>` | 子流程 | `isExpanded="true"` |
| `<boundaryEvent>` | 边界事件（挂在节点上） | `attachedToRef`, `<errorEventDefinition>` etc. |

## Task assignment (Flowable extension attributes)

```xml
<!-- single assignee (expression or literal) -->
<userTask id="T1" name="填写" flowable:assignee="${initiator}"/>
<!-- candidate users (comma-separated ids) -->
<userTask id="T2" name="财务" flowable:candidateUsers="finance1,finance2"/>
<!-- candidate groups (comma-separated role/dept keys) -->
<userTask id="T3" name="总经理" flowable:candidateGroups="management"/>
```

These are read by Flowable to create task candidates/assignee. Also mirror them in `<wf:operators>`
for self-documentation (see below).

## Sequence flows + conditions

```xml
<sequenceFlow id="Flow_3" name="审批通过" sourceRef="T1" targetRef="G1">
  <conditionExpression xsi:type="tFormalExpression">${wfOutcome != 'reject'}</conditionExpression>
</sequenceFlow>
<sequenceFlow id="Flow_4" name="驳回" sourceRef="T1" targetRef="T_revise">
  <conditionExpression xsi:type="tFormalExpression">${wfOutcome == 'reject'}</conditionExpression>
</sequenceFlow>
```

- An `exclusiveGateway` with multiple outgoing flows **must** either cover all cases with
  conditions or set a `default` flow (otherwise runtime may have no path).
- Reject/revise loops: a flow back to a "重新提交" userTask, then a flow forward again.
- Escape `<`/`>` in expressions: `&lt;=` , `&gt;=`.

## The `wf:` extension (self-contained operators / menus / perms)

Place inside each element's `<extensionElements>`. Mirror the springblade DB tables (see
`springblade-mapping.md`).

```xml
<extensionElements>
  <!-- 操作者 -> wf_node_operator -->
  <wf:operators>
    <wf:operator type="role"    value="dept_manager" signOrder="1"/>
    <wf:operator type="person"  value="user7960"     signOrder="1"/>
  </wf:operators>

  <!-- 操作菜单 -> wf_custom_operation (+ wf_custom_operation_right) -->
  <wf:customOperations>
    <wf:operation btnName="审批通过" btnOrder="1" actionType="2" enabled="1">
      <wf:right rightType="role"   rightValue="dept_manager"/>
      <wf:right rightType="person" rightValue="admin"/>
    </wf:operation>
    <wf:operation btnName="驳回"   btnOrder="2" actionType="2" enabled="1">
      <wf:right rightType="role" rightValue="dept_manager"/>
    </wf:operation>
  </wf:customOperations>

  <!-- 字段权限 -> wf_node_field_perm : perm 0隐藏 1只读 2可编辑 3必填 -->
  <wf:fieldPerms>
    <wf:fieldPerm scope="main" fieldName="amount"      perm="3"/>
    <wf:fieldPerm scope="main" fieldName="secretLevel" perm="0"/>
  </wf:fieldPerms>
</extensionElements>
```

`actionType`: `1`=URL, `2`=流程操作(审批/驳回/转办/征询), `3`=接口.
`rightType`: `role` / `dept` / `person`; `rightValue` comma-separated IDs.
Empty containers are allowed: `<wf:operators/>`.

## DI (graphical coordinates)

Every flow node needs a `<bpmndi:BPMNShape>` with `<omgdc:Bounds x y width height/>`,
and every `sequenceFlow` needs a `<bpmndi:BPMNEdge>` with ≥2 `<omgdi:waypoint x y/>`.

```xml
<bpmndi:BPMNDiagram id="BPMNDiagram_1">
  <bpmndi:BPMNPlane bpmnElement="processId" id="BPMNPlane_1">
    <bpmndi:BPMNShape bpmnElement="T1" id="T1_di">
      <omgdc:Bounds x="360" y="190" width="120" height="80"/>
    </bpmndi:BPMNShape>
    <bpmndi:BPMNEdge bpmnElement="Flow_3" id="Flow_3_di">
      <omgdi:waypoint x="480" y="230"/><omgdi:waypoint x="540" y="230"/>
    </bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane>
</bpmndi:BPMNDiagram>
```

Convention: lay nodes left→right; gates 40–50px, tasks 120×80, events 30×30. Keep waypoints
on straight or right-angle paths.
