#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
validate_model.py  —  connector-integrity validation for model.json

Runs BEFORE render.py, on every model.json regardless of how it was built
(path A workbook pipeline or path B hand-authored script). Exists because two
distinct defect classes can silently produce a diagram with "broken" or
"missing" connectors, and neither one is visible in the model.json text
itself — only in the rendered output, after the fact:

  1. DANGLING REFERENCE — a flow's `from`/`to` doesn't match any node id (a
     typo, a renamed/removed node the flow list wasn't updated for). The
     engine's own defensive check (`if(!a||!b)return;`) means the edge is
     silently DROPPED with no error and no visual trace — it just isn't
     there. This looks identical to "a connector went missing" from the
     user's side, with nothing in the browser console to explain it.

  2. MISCLASSIFIED DIRECTION — historically, the engine decided forward vs.
     backward routing from raw x-position instead of `phase`, so any edge
     between two nodes in the SAME phase column but different lanes (e.g. an
     escalation from one lane back into another lane in the same stage) was
     misrouted through the bottom loop-back "bus" — producing wildly
     out-of-proportion detours clustered at the bottom of the diagram. The
     engine now classifies by phase (see engine_template.html's isForward/
     isLateral), which is the permanent fix — but a `model.json` with
     missing/wrong `phase` values on some nodes can still reproduce the
     symptom, since the classification depends entirely on that field being
     populated correctly. This script re-runs the exact same classification
     Python-side and reports the mix, so a build that quietly regresses
     `phase` assignment is caught here instead of by eyeballing the diagram.

Usage:
  python validate_model.py <model.json>          # exits 1 on ERROR, 0 with warnings allowed
  python validate_model.py <model.json> --strict  # exits 1 on WARNING too
"""
import sys, json


def classify(a, b):
    """Mirrors engine_template.html's isForward()/isLateral()/backward exactly."""
    if b["phase"] > a["phase"]:
        return "forward"
    if b["phase"] == a["phase"] and a["id"] != b["id"]:
        return "lateral"
    return "backward"


def validate(model_path):
    errors = []
    warnings = []
    blob = json.load(open(model_path, encoding="utf-8"))
    nodes = blob.get("nodes", [])
    flows = blob.get("flows", [])

    nid = {}
    dupe_ids = set()
    for n in nodes:
        if n["id"] in nid:
            dupe_ids.add(n["id"])
        nid[n["id"]] = n
    for d in dupe_ids:
        errors.append(f"DUPLICATE NODE ID: '{d}' appears more than once in nodes[] — "
                       f"the engine's NID lookup keeps only the last one, silently orphaning "
                       f"any edge meant for the earlier one.")

    for n in nodes:
        if "phase" not in n or not isinstance(n["phase"], int):
            errors.append(f"NODE '{n.get('id','?')}': missing or non-integer 'phase' — "
                           f"forward/lateral/backward routing cannot be classified without it.")

    # 1. Dangling references — the silent-drop defect class.
    dangling = []
    for i, f in enumerate(flows):
        a = nid.get(f.get("from"))
        b = nid.get(f.get("to"))
        if a is None:
            dangling.append((i, f, "from", f.get("from")))
        if b is None:
            dangling.append((i, f, "to", f.get("to")))
    for i, f, side, bad_id in dangling:
        errors.append(f"DANGLING FLOW[{i}] {f.get('from')} -> {f.get('to')}: "
                       f"'{side}' references node id '{bad_id}', which does not exist in nodes[]. "
                       f"This edge will render as NOTHING — no error, no trace — the connector "
                       f"simply will not appear.")

    # 2. Direction classification + self-loop check.
    forward = lateral = backward = selfloop = 0
    for i, f in enumerate(flows):
        a, b = nid.get(f.get("from")), nid.get(f.get("to"))
        if a is None or b is None:
            continue  # already reported above
        if f.get("from") == f.get("to"):
            selfloop += 1
            warnings.append(f"SELF-LOOP FLOW[{i}]: '{f['from']}' -> itself. Not rejected by the "
                             f"engine, but a node connecting to itself is virtually always a data "
                             f"error (e.g. a copy-paste id typo) rather than an intended loop.")
            continue
        d = classify(a, b)
        if d == "forward": forward += 1
        elif d == "lateral": lateral += 1
        else: backward += 1

    # 3. Decision nodes: outgoing flow coverage, AND branches[] metadata (drawer-only, not
    #    connected to what's actually drawn) must match a real flow — otherwise the side
    #    drawer claims an outcome ("No -> Payment declined") that has no visible connector.
    for n in nodes:
        if n.get("type") == "decision":
            outgoing = [f for f in flows if f.get("from") == n["id"]]
            if len(outgoing) < 2 and not n.get("branches"):
                warnings.append(f"DECISION '{n['id']}' ({n.get('label','')}): only "
                                 f"{len(outgoing)} outgoing edge(s) and no 'branches' entry — "
                                 f"check whether the negative/'no' outcome was left unconnected.")
            outgoing_targets = {f["to"] for f in outgoing}
            for b in n.get("branches", []):
                if b.get("to") not in outgoing_targets:
                    warnings.append(f"DECISION '{n['id']}' ({n.get('label','')}): branches[] lists "
                                     f"outcome '{b.get('label')}' -> '{b.get('to')}', but there is no "
                                     f"matching flow with from='{n['id']}' to='{b.get('to')}' — the "
                                     f"side drawer will claim this outcome exists while the diagram "
                                     f"shows no connector for it.")

    # 4. Dead ends (mirrors the engine's own side-drawer notice, surfaced earlier).
    has_outgoing = {f["from"] for f in flows if f.get("from") in nid}
    for n in nodes:
        if n.get("type") != "end" and n["id"] not in has_outgoing:
            warnings.append(f"DEAD END '{n['id']}' ({n.get('label','')}): type is "
                             f"'{n.get('type')}', not 'end', but has zero outgoing edges. "
                             f"The engine will flag this in its side drawer at view time — "
                             f"confirm this is a genuine stopping point, not a gap.")

    print(f"Nodes: {len(nodes)}   Flows: {len(flows)}")
    print(f"Direction mix — forward: {forward}   lateral: {lateral}   backward/loop: {backward}"
          + (f"   self-loop: {selfloop}" if selfloop else ""))
    if backward > lateral and lateral == 0 and len(flows) > 3:
        warnings.append("All non-forward edges classified as 'backward' and none as 'lateral' — "
                         "if this model has any same-phase, cross-lane edges (e.g. an escalation "
                         "back into another lane in the same stage), double-check every node's "
                         "'phase' value is actually populated; a model where 'phase' silently "
                         "defaults to 0 everywhere will misreport every edge as backward.")
    if forward == 0 and len(flows) > 2 and len(nodes) > 2:
        warnings.append("ZERO forward edges found across the whole model. A real multi-stage "
                         "process almost always progresses through at least one phase boundary — "
                         "this usually means every node's 'phase' collapsed to the same value "
                         "(e.g. all zero), which also collapses the x-axis layout itself (every "
                         "node lands in the same column, not just the connectors). Check "
                         "compute_layout()'s PHASES/phase inputs before rendering.")

    print()
    if errors:
        print(f"ERRORS ({len(errors)}):")
        for e in errors: print("  -", e)
    if warnings:
        print(f"WARNINGS ({len(warnings)}):")
        for w in warnings: print("  -", w)
    if not errors and not warnings:
        print("No issues found.")
    return errors, warnings


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python validate_model.py <model.json> [--strict]"); sys.exit(1)
    strict = "--strict" in sys.argv
    errors, warnings = validate(sys.argv[1])
    if errors or (strict and warnings):
        sys.exit(1)
    sys.exit(0)
