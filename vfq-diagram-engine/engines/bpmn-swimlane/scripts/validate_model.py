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

Also checks `meta.brsdId` — the persisted, canonical BRSD reference that
render-all.js's output-file naming convention ("{brsdId}-{type}.html") is
meant to keep aligned with the model's actual source. It must be present
and must exactly equal the data/{slug}/ directory the model.json lives in;
a missing or mismatched brsdId means a generated diagram's filename could
silently point back to the wrong (or no) source artefact.

Usage:
  python validate_model.py <model.json>          # exits 1 on ERROR, 0 with warnings allowed
  python validate_model.py <model.json> --strict  # exits 1 on WARNING too
"""
import sys, json, os


def classify(a, b):
    """Mirrors engine_template.html's isForward()/isLateral()/backward exactly."""
    if b["phase"] > a["phase"]:
        return "forward"
    if b["phase"] == a["phase"] and a["id"] != b["id"]:
        return "lateral"
    return "backward"


def is_happy_flow(f):
    """Mirrors engine_template.html's isHappyFlow() exactly — the same classification the
    Happy Flow filter and the drawer's Previous/Next navigation both already use. A flow is
    happy if explicitly marked so, excluded if explicitly marked false, and otherwise defaults
    by kind: seq/data (ordinary forward progression) default happy; esc/err (by definition
    exception handling) default NOT happy; cond (a decision's branch) defaults NOT happy and
    must be explicitly marked happy:true — a decision's branches are inherently ambiguous from
    kind alone, unlike every other kind."""
    if f.get("happy") is True:
        return True
    if f.get("happy") is False:
        return False
    if f.get("kind") in ("esc", "err", "cond"):
        return False
    return True


def validate(model_path):
    errors = []
    warnings = []
    blob = json.load(open(model_path, encoding="utf-8"))
    nodes = blob.get("nodes", [])
    flows = blob.get("flows", [])

    # 0. brsdId — the persisted BRSD reference the output-filename convention depends on.
    expected_brsd_id = os.path.basename(os.path.dirname(os.path.abspath(model_path)))
    actual_brsd_id = blob.get("meta", {}).get("brsdId")
    if not actual_brsd_id:
        errors.append(f"meta.brsdId is missing — every model.json must carry the persisted "
                       f"BRSD reference (expected '{expected_brsd_id}', matching this file's "
                       f"data/{{slug}}/ directory) so generated output filenames stay "
                       f"traceable to their source artefact.")
    elif actual_brsd_id != expected_brsd_id:
        errors.append(f"meta.brsdId ('{actual_brsd_id}') does not match this model's own "
                       f"data/{{slug}}/ directory ('{expected_brsd_id}') — the model was likely "
                       f"copied/renamed without updating brsdId. Fix meta.brsdId to "
                       f"'{expected_brsd_id}', or move this file to data/{actual_brsd_id}/ if "
                       f"that's actually the correct source.")

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

    # 0b. Out-of-bounds phase — a node whose 'phase' index has no corresponding entry in
    # layout.phases gets positioned at X0 + phase*colw, past every declared column, i.e.
    # outside the canvas's own totalW entirely (compute_layout()'s total_w only spans
    # len(PHASES) columns). Such a node doesn't wrap, doesn't clip visibly at a column
    # edge, and doesn't show up as a connector-integrity problem in this script's other
    # checks — it silently renders (partially or fully) beyond the SVG's own viewBox, so
    # no scroll/zoom/fit setting in the live view or any export can ever bring it into
    # view. This is exactly the "invisible until the rendered output, after the fact"
    # defect class this script exists to catch — found empirically via a diagram that
    # looked truncated in every viewport and every export despite scrolling/sizing being
    # otherwise correct, traced to nodes whose phase (7, 8, 9) simply didn't exist in a
    # 7-entry (0-6) layout.phases array.
    nphases = len(blob.get("layout", {}).get("phases", []))
    for n in nodes:
        p = n.get("phase")
        if isinstance(p, int) and (p < 0 or p >= nphases):
            errors.append(f"NODE '{n.get('id','?')}' ({n.get('label','')}): phase={p} has no "
                           f"corresponding entry in layout.phases (which has {nphases} entries, "
                           f"valid range 0-{nphases-1}) — this node will be positioned past "
                           f"every declared column, outside the canvas's own totalW, and will "
                           f"never be visible in the live view or in any export regardless of "
                           f"scroll/zoom/fit settings. Reassign it to a real phase index.")

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

    # 5. Happy path continuity — an explicit "the happy path shall be a continuous, fully
    # connected route from Start to End, with no missing nodes, broken connectors, orphaned
    # steps, or disconnected transitions" requirement. Every happy edge (is_happy_flow(f),
    # dangling ones already excluded/reported above) is assembled into a directed graph and
    # walked breadth-first from every 'start' node; anything that graph can't reach an 'end'
    # node through is exactly the "disconnected segment" this check exists to catch. This is
    # also what the diagram's own drawer Previous/Next controls rely on at view time — the same
    # happy_out adjacency a broken link here would silently strand navigation on.
    happy_flows = [f for f in flows
                   if is_happy_flow(f) and f.get("from") in nid and f.get("to") in nid]
    happy_out = {}
    for f in happy_flows:
        happy_out.setdefault(f["from"], []).append(f["to"])
    start_nodes = [n for n in nodes if n.get("type") == "start"]
    end_nodes = [n for n in nodes if n.get("type") == "end"]
    end_ids = {n["id"] for n in end_nodes}

    if not start_nodes:
        errors.append("HAPPY PATH: no node with type 'start' exists — there is no starting "
                       "point a happy-path traversal can begin from.")
    if not end_nodes:
        errors.append("HAPPY PATH: no node with type 'end' exists — there is no terminal point "
                       "a happy-path traversal can conclude at.")

    reached_from_any_start = set()
    for s in start_nodes:
        seen = {s["id"]}
        queue = [s["id"]]
        reached_end = s["id"] in end_ids
        while queue:
            cur = queue.pop(0)
            for nxt in happy_out.get(cur, []):
                if nxt in end_ids:
                    reached_end = True
                if nxt not in seen:
                    seen.add(nxt)
                    queue.append(nxt)
        reached_from_any_start |= seen
        if not reached_end:
            errors.append(f"HAPPY PATH: no continuous happy-path route from start node "
                           f"'{s['id']}' ({s.get('label','')}) reaches any 'end' node — the "
                           f"happy path is broken or dead-ends before completion. Reached "
                           f"{len(seen)} node(s) total: "
                           f"{', '.join(sorted(seen)[:15])}{' ...' if len(seen) > 15 else ''}")
        # A node the happy path reaches but that has no happy way OUT (and isn't itself the
        # end) is a dead end mid-path — a "disconnected transition" from that point onward,
        # even though the node itself is reachable.
        for reached_id in seen:
            rn = nid[reached_id]
            if rn.get("type") != "end" and reached_id not in happy_out:
                errors.append(f"HAPPY PATH: node '{reached_id}' ({rn.get('label','')}) is "
                               f"reachable from start '{s['id']}' along the happy path but has "
                               f"no outgoing happy edge and is not an 'end' node — the happy "
                               f"path dead-ends here instead of continuing to a terminal step.")
    for e in end_nodes:
        if e["id"] not in reached_from_any_start:
            warnings.append(f"HAPPY PATH: end node '{e['id']}' ({e.get('label','')}) is never "
                             f"reached by any start node's happy-path traversal — it may only "
                             f"be reachable via a non-happy (exception/alternate) route, or the "
                             f"happy path never actually concludes here.")

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
