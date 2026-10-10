---
name: flowable-workflow-builder
description: >-
  Generate, author, or export Flowable BPMN 2.0 workflow definitions (.bpmn20.xml) that include
  full node info (name/type/id/properties), sequence flows with condition expressions, task
  assignees / candidate users / candidate groups, per-user-task operation menus (approve/reject/
  transfer/consult), and field-level permission/visibility rules. Use when the user asks to
  create a workflow, design a process, build an approval/会签 flow, or export a BPMN file for the
  springblade workflow system (/system/workflow) — especially when they mention 节点, 连线, 网关,
  操作者, 候选用户/候选组, 操作菜单, 权限, 可见性, 字段权限, or "Flowable BPMN".
---

# Flowable Workflow Builder

Author self-contained, deployable Flowable BPMN 2.0 XML for the springblade workflow platform.
The XML carries standard Flowable task assignment plus a custom `wf:` extension namespace that
documents operators, operation menus, and field permissions (mapped to springblade DB tables).

## When to use

- User asks to "create / design / build a workflow / 审批流程 / 会签流程" and export it as BPMN.
- User references `/system/workflow`, "导出 BPMN", "节点 / 连线 / 网关", "操作者 / 候选组",
  "操作菜单 (审批/驳回/转办)", "字段权限 / 可见性".
- Note: this skill produces the **export artifact (XML file)**. It cannot click the live web UI;
  the resulting XML is what the designer's export/import would generate.

## Workflow

1. **Collect the spec.** Enumerate nodes (id/nodeKey, name, type, properties), the directed
   sequence flows (with condition expressions for gateways / reject loops), each user task's
   operators (candidate users / candidate groups / assignee + sign order), its operation menu
   (buttons + who can see/use them), and its field-level permissions. Ask only if a required
   decision is genuinely ambiguous.
2. **Scaffold from the template.** Copy `assets/template.bpmn20.xml` as the starting point — it
   already declares all namespaces (`bpmn`, `flowable`, `wf`, `bpmndi`/`omgdc`/`omgdi`) and a
   minimal start→userTask→end shape with `wf:` extension scaffolding.
3. **Emit nodes + flows.** Use the element/attribute reference in `references/bpmn-schema.md`
   (node types, Flowable assignment attrs, condition expressions, the `wf:` extension schema).
4. **Emit DI.** Give every shape a `<omgdc:Bounds>` and every flow a `<bpmndi:BPMNEdge>` with
   `<omgdi:waypoint>`s so the file renders in a designer. See the template for the coordinate
   convention.
5. **Validate.** Run `scripts/validate_bpmn.py <file>` — it checks well-formedness, unique IDs,
   resolvable flow endpoints, gateway default/conditions, and DI presence, then prints a report.
   Fix every reported error before delivering.
6. **Save.** Write to a **new, uniquely-named** `.bpmn20.xml` under the requested directory.
   Never overwrite Flowable engine test fixtures (e.g. `reviewSalesLead.bpmn20.xml`, referenced by
   `BoundaryErrorEventTest`).
7. **(Optional) Verify against the live server.** To prove the generated BPMN actually imports into
   the running springblade workflow service — and that repeated import is idempotent — use the helper
   scripts. This requires the dev gateway + a reachable `blade-workflow` service:
   - `python scripts/sm2_auth.py` — runs the SM3/SM2 selftest and logs in via SM2 (admin/ant.design),
     printing a token. **Gotcha: blade-core uses SM2 C1C2C3 mode (C3 at the end), not C1C3C2** — see
     `references/live-verify.md`.
   - `python scripts/import_workflow.py <file.bpmn20.xml> --repeats 3` — SM2-logins, then POSTs the
     BPMN to `/blade-workflow/definition/import` N times. Each must return `200`; the backend clears
     prior `procKey + version=1` rows (incl. logically-deleted ghosts) before insert, so no unique-key
     clash. See `references/live-verify.md` for the full contract, public-key source, and the
     idempotency fix background.

## Critical gotchas (avoid silent deploy/runtime failures)

- **XML comments must not contain `--`** (double hyphen) — it makes the file not well-formed.
  Use `=` for decorative rules. (The validator also rejects it.)
- **Escape `<` / `>`** in `conditionExpression` and `<documentation>` as `&lt;` / `&gt;`.
- **Plain `<task>` and `<manualTask>` are wait states** — they BLOCK the flow until someone
  completes them. For automatic/auto-pass nodes use `<scriptTask>` (with `scriptFormat` +
  `<script>`) or `<serviceTask>` (with `flowable:type`). Avoid `<sendTask>`: Flowable rejects it
  at deploy without `flowable:type`/`operation` (`flowable-sendtask-invalid-implementation`).
- **A `<userTask>` with multiple outgoing flows** takes the first flow whose condition is true
  (valid implicit decision) — prefer explicit gateways for readability.
- **Element `id` must be unique** across the whole document; treat it as the nodeKey that the
  springblade tables join on.
- **`wf:` extensions are documentation only.** The springblade designer importer does NOT
  auto-create `wf_node_operator` / `wf_custom_operation` / `wf_node_field_perm` rows from them
  (those are saved separately via the designer API). Operators/buttons/perms must still be
  configured in the designer UI, or extend the importer to parse `wf:`. See
  `references/springblade-mapping.md`.

## Resources

- `assets/template.bpmn20.xml` — minimal valid scaffold (start → userTask → end + DI + `wf:` stubs).
- `references/bpmn-schema.md` — BPMN element/attribute catalog, `wf:` extension schema, DI rules.
- `references/springblade-mapping.md` — how `wf:` maps to springblade DB tables + import caveat.
- `references/live-verify.md` — auth (SM2 C1C2C3 gotcha), import endpoint contract, idempotency fix,
  以及导入链路三大坑：导入草稿 `activeVersionId=-1`、非 admin 列表仅返回 `status=1`、`activeVersionId`
  大 ID 做 `Number()` 的精度坑（曾致发布/测试行被版本组过滤误删）。
- `scripts/validate_bpmn.py` — well-formedness + structural validation of the generated file.
- `scripts/sm2_auth.py` — stdlib-only SM2/SM3 + SM2 login to `/blade-auth/token` (gets a token).
- `scripts/import_workflow.py` — import a BPMN file to `/blade-workflow/definition/import` + idempotency regression.
