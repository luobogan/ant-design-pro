#!/usr/bin/env python3
"""Validate a Flowable BPMN 2.0 workflow XML produced by the flowable-workflow-builder skill.

Checks:
  - well-formed XML (reports line/col on error)
  - required namespaces present (bpmn default, flowable, wf)
  - unique element ids
  - sequenceFlow source/target resolve to existing ids
  - exclusive/inclusive gateways have a default flow or conditioned outgoing flows
  - every flow node and sequenceFlow has DI (BPMNShape / BPMNEdge)
  - userTasks declare at least one Flowable assignment attribute

Usage:
  python validate_bpmn.py <file.bpmn20.xml>
Exit code 0 = pass (warnings allowed), 1 = errors found.
"""
import sys
import xml.etree.ElementTree as ET

BPMN_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL"
FLOWABLE_NS = "http://flowable.org/bpmn"
WF_NS = "http://www.springblade.org/workflow"

NODE_TAGS = {
    "startEvent", "endEvent", "userTask", "scriptTask", "serviceTask",
    "task", "manualTask", "sendTask", "subProcess", "boundaryEvent",
    "exclusiveGateway", "parallelGateway", "inclusiveGateway",
}
GATEWAY_BRANCH_TAGS = {"exclusiveGateway", "inclusiveGateway"}


def local(tag):
    return tag.split("}", 1)[1] if "}" in tag else tag


def main(path):
    errors, warnings = [], []

    # 1. well-formedness
    try:
        tree = ET.parse(path)
    except ET.ParseError as e:
        line, col = e.position
        print(f"ERROR  XML not well-formed at line {line}:{col} -> {e}")
        return 1
    root = tree.getroot()

    # 2. namespaces (cheap string check on raw file)
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    if 'xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"' not in raw:
        warnings.append("missing default BPMN namespace on <definitions>")
    if "xmlns:flowable=" not in raw:
        warnings.append("missing xmlns:flowable (Flowable assignment attrs will not work)")
    if "xmlns:wf=" not in raw:
        warnings.append("missing xmlns:wf (custom operators/menus/perms extension)")

    # 3. unique ids + collect flow nodes
    ids = {}
    for el in root.iter():
        lid = local(el.tag)
        eid = el.get("id")
        if eid is not None:
            if eid in ids:
                errors.append(f"duplicate id '{eid}' (also at <{ids[eid]}>)")
            else:
                ids[eid] = lid

    flows = []  # (id, source, target, has_condition)
    for el in root.iter():
        if local(el.tag) == "sequenceFlow":
            sid = el.get("sourceRef")
            tid = el.get("targetRef")
            cond = any(local(c.tag) == "conditionExpression" for c in el)
            flows.append((el.get("id"), sid, tid, cond))

    # 4. flow endpoints resolve
    for fid, sid, tid, _ in flows:
        for ref, label in ((sid, "sourceRef"), (tid, "targetRef")):
            if ref is None:
                errors.append(f"<sequenceFlow id='{fid}'> missing {label}")
            elif ref not in ids:
                errors.append(f"<sequenceFlow id='{fid}'> {label}='{ref}' does not exist")

    # 5. gateway branch coverage
    for el in root.iter():
        lid = local(el.tag)
        if lid in GATEWAY_BRANCH_TAGS:
            gid = el.get("id")
            if el.get("default"):
                continue
            out = [f for f in flows if f[1] == gid]
            if not any(f[3] for f in out):
                warnings.append(
                    f"<{lid} id='{gid}'> has no 'default' and no conditioned outgoing flow "
                    f"(runtime may have no path)"
                )

    # 6. DI presence
    di_shapes, di_edges = set(), set()
    for el in root.iter():
        lid = local(el.tag)
        if lid == "BPMNShape":
            di_shapes.add(el.get("bpmnElement"))
        elif lid == "BPMNEdge":
            di_edges.add(el.get("bpmnElement"))

    missing_shape, missing_edge = [], []
    for el in root.iter():
        lid = local(el.tag)
        if lid in NODE_TAGS and el.get("id") not in di_shapes:
            missing_shape.append(el.get("id"))
        if lid == "sequenceFlow" and el.get("id") not in di_edges:
            missing_edge.append(el.get("id"))
    if missing_shape:
        warnings.append(f"flow nodes missing DI shape: {missing_shape}")
    if missing_edge:
        warnings.append(f"sequenceFlows missing DI edge: {missing_edge}")

    # 7. userTask assignment
    for el in root.iter():
        if local(el.tag) == "userTask":
            has = any(k.startswith(f"{{{FLOWABLE_NS}}}") and k.split("}", 1)[1]
                      in ("assignee", "candidateUsers", "candidateGroups")
                      for k in el.attrib)
            if not has:
                warnings.append(
                    f"<userTask id='{el.get('id')}'> has no Flowable assignment "
                    f"(assignee/candidateUsers/candidateGroups)"
                )

    # wf: extension usage summary
    wf_counts = {"operators": 0, "customOperations": 0, "fieldPerms": 0}
    for el in root.iter():
        lid = local(el.tag)
        if lid in wf_counts:
            wf_counts[lid] += 1

    # report
    print(f"File: {path}")
    print(f"  elements with id: {len(ids)} | sequenceFlows: {len(flows)}")
    print(f"  wf: extension blocks -> operators:{wf_counts['operators']} "
          f"customOperations:{wf_counts['customOperations']} fieldPerms:{wf_counts['fieldPerms']}")
    for w in warnings:
        print(f"  WARN  {w}")
    for e in errors:
        print(f"  ERROR {e}")

    if errors:
        print(f"\nRESULT: FAIL ({len(errors)} error(s), {len(warnings)} warning(s))")
        return 1
    print(f"\nRESULT: PASS ({len(warnings)} warning(s))")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python validate_bpmn.py <file.bpmn20.xml>")
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
