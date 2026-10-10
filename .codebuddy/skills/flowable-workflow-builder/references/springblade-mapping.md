# springblade table mapping for `wf:` extensions

The custom `wf:` elements in the BPMN file document what the springblade workflow platform stores
in separate DB tables, keyed by **nodeKey = the BPMN element `id`**. They are a self-contained
export representation; they are NOT auto-applied by the designer importer (see caveat).

## `wf:operators` → `wf_node_operator`

| `wf:operator` attr | `wf_node_operator` column | Notes |
|---|---|---|
| `type` | operator type | `person` / `dept` / `role` |
| `value` | operator value | user/dept/role id(s), comma-separated |
| `signOrder` | `sign_order` | 会签顺序；同序=或签并列，不同序=顺序会签 |

> Also set the equivalent Flowable attribute on the `<userTask>`:
> `flowable:assignee` (single), `flowable:candidateUsers`, or `flowable:candidateGroups`.

## `wf:customOperations` → `wf_custom_operation` (+ `wf_custom_operation_right`)

`wf:operation` → `wf_custom_operation`:

| attr | column | values |
|---|---|---|
| `btnName` | `btn_name` | 按钮显示名，如 审批通过/驳回/转办/征询 |
| `btnOrder` | `btn_order` | 排序 |
| `actionType` | `action_type` | `1`=URL `2`=流程操作 `3`=接口 |
| `enabled` | `enabled` | `1`=启用 `0`=停用 |

`wf:right` (child) → `wf_custom_operation_right`:

| attr | column | values |
|---|---|---|
| `rightType` | `right_type` | `role` / `dept` / `person` |
| `rightValue` | `right_value` | 对应 ID，逗号分隔 |

Both tables also carry `def_id` (流程定义ID) and `node_key` (= the BPMN element id).

## `wf:fieldPerms` → `wf_node_field_perm`

`wf:fieldPerm` → `wf_node_field_perm`:

| attr | column | values |
|---|---|---|
| `scope` | `scope` | `main` / `dt{idx}` / `dt{idx}_r{row}` |
| `fieldName` | `field_name` | 字段名 |
| `perm` | `perm` | `0`隐藏 `1`只读 `2`可编辑 `3`必填 |

The entity also has three-dimensional columns `is_visible` / `is_editable` / `is_required`
(NULL ⇒ derived from `perm`). Prefer writing `perm` (compatibility column).

## Import caveat (important)

The springblade designer's **import** flow persists the BPMN structure (nodes/links) and reads
`flowable:` assignment attributes, but it does **not** parse `wf:` extensions to auto-create the
three tables above. Therefore:

- The generated XML is safe to import for nodes + assignments + conditions.
- Operators, operation menus, and field permissions still need to be configured in the designer UI
  per nodeKey, OR you must extend the importer (`WfDefinitionServiceImpl` import logic) to read
  `wf:operators` / `wf:customOperations` / `wf:fieldPerms` and bulk-insert the rows.

Until the importer is extended, treat the `wf:` block as the authoritative spec to drive the
manual configuration (or a one-off migration script).
