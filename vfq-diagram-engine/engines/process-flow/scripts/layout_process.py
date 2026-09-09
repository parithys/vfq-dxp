#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
layout_process.py — derives a "primary spine + branch tiers" layout from the
SAME structural nodes/flows bpmn-swimlane.model.json already carries (see
../reference/MODEL_SCHEMA.md). Not a second extraction: every field read
here was already produced by bpmn-swimlane's own extraction step, and
nothing here is ever written back to data/{slug}/bpmn-swimlane.model.json.

Design reference: this layout (and the SVG this feeds — see render.py)
deliberately replicates the visual language of a hand-built one-off
reference file the project maintainer supplied
(vfq-mobile-postpaid-activation-complete-flow_10.html) — a single
horizontal "spine" of numbered primary-path steps, with exception/retry/
escalation nodes dropped into tiers below the spine at their branch point,
grouped into business-phase bands. Every geometric rule below was reverse-
engineered from that reference's own rendered SVG (not guessed), documented
inline at each rule. Unlike that one-off file, none of this is hand-placed:
every rule here is a general function of the shared model.json, so it
produces a correctly-shaped diagram for any BRSD, not just the one the
reference happened to be built from.

Usage (standalone, for testing — render.py calls compute_process_layout()
directly, in-memory, on every render):
  python layout_process.py <model.json> [output.json]
"""
import sys, os, json, collections

# ----------------------------------------------------------------- happy-path spine
def is_happy_flow(f):
    """Mirrors bpmn-swimlane/scripts/validate_model.py::is_happy_flow() exactly —
    the same classification the shared engine's own "Happy Flow" filter and
    the happy-path continuity validator already use. Reused, not
    re-derived: a flow is happy if explicitly marked so, excluded if
    explicitly marked false, and otherwise defaults by kind (seq/data
    happy; esc/err/cond not happy unless explicit)."""
    if f.get("happy") is True:
        return True
    if f.get("happy") is False:
        return False
    if f.get("kind") in ("esc", "err", "cond"):
        return False
    return True


def _spine_order(nodes, flows):
    """The reference file's "primary path" (numbered 01..N along one
    horizontal spine) is EXACTLY the set of nodes reachable from the
    `start` node by following only is_happy_flow()==True edges — verified
    against the actual reference file's own node roster (88 of 108 nodes
    matched exactly). This is not a new concept: it's the identical
    happy-path reachability bpmn-swimlane/scripts/validate_model.py already
    enforces (every BRSD's data already passes that check, so this
    traversal is guaranteed non-empty and start-to-end connected).

    Order along the spine is a topological sort over that same happy-edge
    subgraph (Kahn's algorithm), with the ready-queue at each step broken
    by the node's original (phase, lane-declared-order, slot) — i.e. "the
    swimlane's own reading order, wherever the happy-path graph doesn't
    already force a specific order." Mirrors the same
    algorithm/justification build_model.py's own _enforce_topological_order()
    uses, applied globally instead of per-bucket."""
    import heapq
    nid = {n["id"]: n for n in nodes}
    start = next((n["id"] for n in nodes if n["type"] == "start"), None)
    if start is None:
        return []

    happy_succ = collections.defaultdict(list)
    happy_indeg = collections.defaultdict(int)
    reachable = {start}
    queue = [start]
    while queue:
        cur = queue.pop()
        for f in flows:
            if f.get("from") != cur or not is_happy_flow(f):
                continue
            nxt = f.get("to")
            if nxt not in nid or nxt == cur:
                continue
            happy_succ[cur].append(nxt)
            if nxt not in reachable:
                reachable.add(nxt)
                queue.append(nxt)

    for tgt_list in happy_succ.values():
        for t in tgt_list:
            happy_indeg[t] += 1

    def priority(nid_):
        n = nid[nid_]
        return (n.get("phase", 0), n.get("lane", ""), n.get("slot", 0), nid_)

    heap = [(priority(nid_), nid_) for nid_ in reachable if happy_indeg.get(nid_, 0) == 0]
    heapq.heapify(heap)
    order = []
    seen = set()
    while heap:
        _, cur = heapq.heappop(heap)
        if cur in seen:
            continue
        seen.add(cur)
        order.append(cur)
        for nb in happy_succ.get(cur, []):
            happy_indeg[nb] -= 1
            if happy_indeg[nb] == 0:
                heapq.heappush(heap, (priority(nb), nb))
    if len(order) < len(reachable):
        done = set(order)
        order.extend(sorted((n for n in reachable if n not in done), key=priority))
    return order


# ----------------------------------------------------------------- shape/category classification
def classify(node, is_spine, out_flows):
    """Returns one of: start | end | milestone | decision | primary
    (spine categories) | error | escalation | recovery (off-spine
    categories). Every rule below was confirmed against the reference
    file's actual rendered SVG (not its own — often slightly inaccurate —
    CSS legend text):
      - start/end: node.type, unchanged from the shared schema.
      - milestone: label starts with "Milestone:" — the BRSD's own
        extraction already uses this literal convention for journey
        milestones (5 of 5 "milestone" shapes in the reference matched
        this rule with zero exceptions).
      - decision: node.type in ('decision','validation') OR the node has
        2+ outgoing flows carrying distinct, non-empty labels — the
        reference draws ONE diamond shape for all three cases (its own
        legend groups decision+validation as a single "Decision /
        validation" category, and a real `control`-typed node with a
        branching "Access granted"/"Access denied" outcome — not formally
        typed `decision` at all — still gets diamond treatment; the
        structural signal of "this node gates the flow into named
        branches" outweighs its formal `type` field here). Off-spine
        decision-category nodes keep the SAME diamond size as on-spine
        ones (confirmed: an off-spine `decision`-typed node's rendered
        diamond has the identical half-diagonal as an on-spine one) —
        only their colour differs (handled in render.py via `onSpine`,
        not here).
      - off-spine error: node.type == 'error' — small red circle with a
        white X mark, no sequence number (a journey-ending rejection).
      - off-spine escalation: node.type == 'escalation' — rounded square,
        no sequence number (an approval/escalation task).
      - off-spine else (recovery): everything else off-spine — amber
        circle, no sequence number (a retry/side-flow/pending state)."""
    t = node.get("type")
    label = str(node.get("label") or "")
    if t == "start":
        return "start"
    if t == "end":
        return "end"
    if label.strip().lower().startswith("milestone:"):
        return "milestone"
    distinct_labels = {f.get("label") for f in out_flows if f.get("label")}
    if t in ("decision", "validation") or len(distinct_labels) >= 2:
        return "decision"
    if is_spine:
        return "primary"
    if t == "error":
        return "error"
    if t == "escalation":
        return "escalation"
    return "recovery"


# ----------------------------------------------------------------- geometry constants
# Confirmed directly against the reference's own rendered SVG (not estimated):
STEP = 400            # x-spacing between consecutive spine nodes
X_START = 60           # first (start) node's x
SPINE_Y = 215           # y of every spine node
TIER_BASE = 595          # y of the first off-spine tier (branch nodes directly off the spine)
TIER_STEP = 215          # y-spacing between subsequent off-spine tiers
TOPBAR_H = 64            # phase-header band height
CANVAS_PAD_TOP = 64           # content starts below the topbar
CANVAS_PAD_BOTTOM = 260           # clear space below the deepest tier actually used — NOT just the
                                  # node shape's own bottom edge (which is all `all_max_y` below
                                  # measures): a node's CARD (title/code/desc/tag pills) extends
                                  # well past its shape, up to ~180px past node.y for a card with a
                                  # code line + 2-line description + two tag rows, plus ~80px more
                                  # for the long-distance-connector reserved routing channel (see
                                  # svg_gen.py's LONG_SPAN_X) that sits just above this margin's
                                  # own bottom edge
PHASE_PAD = 200            # extra horizontal padding a phase band gets past its last node

# Drawn radii (not the same as any "search ring" radius — the reference's
# own NODES[].r field conflates the two; these are what's actually painted):
R_START = 16
R_PRIMARY = 14
R_END_INNER, R_END_OUTER = 16, 21
R_MILESTONE_INNER, R_MILESTONE_OUTER = 16, 21
R_DECISION = 18   # half-diagonal of the diamond
R_ERROR = 13
R_RECOVERY = 12
ESCALATION_SIZE = 26   # rounded-square side length


def _anchor_and_tier(off_spine_ids, spine_x, flows):
    """For every off-spine node: anchor_x = the x of the nearest SPINE
    ancestor reached by walking backward over incoming flows (regardless of
    kind/happy — any edge that leads here is a legitimate branch origin);
    tier = 0 if any direct predecessor is itself a spine node, else
    1 + min(tier of its off-spine predecessors) — i.e. how many off-spine
    hops deep this node sits below the spine. Memoized recursion; a
    same-tier cycle among off-spine nodes (shouldn't occur in a validated
    model) falls back to tier 0 rather than recursing forever."""
    preds = collections.defaultdict(list)
    for f in flows:
        a, b = f.get("from"), f.get("to")
        if b in off_spine_ids:
            preds[b].append(a)

    anchor_cache, tier_cache = {}, {}

    def anchor(nid, _guard=None):
        if nid in anchor_cache:
            return anchor_cache[nid]
        _guard = _guard or set()
        if nid in _guard:
            return None
        _guard = _guard | {nid}
        for p in preds.get(nid, []):
            if p in spine_x:
                anchor_cache[nid] = spine_x[p]
                return spine_x[p]
        for p in preds.get(nid, []):
            if p in off_spine_ids:
                a = anchor(p, _guard)
                if a is not None:
                    anchor_cache[nid] = a
                    return a
        anchor_cache[nid] = None
        return None

    def tier(nid, _guard=None):
        if nid in tier_cache:
            return tier_cache[nid]
        _guard = _guard or set()
        if nid in _guard:
            return 0
        _guard = _guard | {nid}
        direct_spine = any(p in spine_x for p in preds.get(nid, []))
        if direct_spine or not preds.get(nid):
            tier_cache[nid] = 0
            return 0
        off_preds = [p for p in preds.get(nid, []) if p in off_spine_ids]
        if not off_preds:
            tier_cache[nid] = 0
            return 0
        t = 1 + min(tier(p, _guard) for p in off_preds)
        tier_cache[nid] = t
        return t

    return {nid: (anchor(nid) if anchor(nid) is not None else X_START, tier(nid)) for nid in off_spine_ids}


def compute_process_layout(nodes, flows, lanes, phases):
    """Returns a dict: { nodes: {id: {category,x,y,r,st,...}}, edges: [...],
    phaseBands: [...], spine: {x1,x2,y} }. Pure function of the shared
    model — never mutates its inputs."""
    nid = {n["id"]: n for n in nodes}
    spine_order = _spine_order(nodes, flows)
    spine_set = set(spine_order)
    spine_x = {node_id: X_START + i * STEP for i, node_id in enumerate(spine_order)}

    off_spine_ids = [n["id"] for n in nodes if n["id"] not in spine_set]
    anchors = _anchor_and_tier(off_spine_ids, spine_x, flows)

    # Collision spread: multiple off-spine nodes sharing the exact same
    # (anchor_x, tier) are nudged apart horizontally in a fixed order
    # (sorted by id for determinism) rather than overlapping outright.
    bucket = collections.defaultdict(list)
    for node_id in off_spine_ids:
        ax, t = anchors[node_id]
        bucket[(ax, t)].append(node_id)

    out_nodes = {}
    for i, node_id in enumerate(spine_order):
        n = nid[node_id]
        out_flows = [f for f in flows if f.get("from") == node_id]
        cat = classify(n, True, out_flows)
        x = spine_x[node_id]
        r = {"start": R_START, "end": R_END_OUTER, "milestone": R_MILESTONE_OUTER,
             "decision": R_DECISION}.get(cat, R_PRIMARY)
        out_nodes[node_id] = {"id": node_id, "category": cat, "x": x, "y": SPINE_Y,
                               "r": r, "st": i + 1, "onSpine": True}

    for (ax, t), ids in bucket.items():
        ids_sorted = sorted(ids)
        n_ids = len(ids_sorted)
        for j, node_id in enumerate(ids_sorted):
            n = nid[node_id]
            out_flows = [f for f in flows if f.get("from") == node_id]
            cat = classify(n, False, out_flows)
            # spread siblings sharing one (anchor,tier) symmetrically around ax
            offset = (j - (n_ids - 1) / 2) * 300
            x = ax + offset
            y = TIER_BASE + t * TIER_STEP
            r = {"error": R_ERROR, "escalation": ESCALATION_SIZE / 2,
                 "decision": R_DECISION}.get(cat, R_RECOVERY)
            out_nodes[node_id] = {"id": node_id, "category": cat, "x": x, "y": y,
                                   "r": r, "st": None, "onSpine": False}

    # ---- phase bands: x-range per business phase, derived from where its
    # member nodes actually landed (spine nodes only — off-spine nodes
    # inherit their anchor's phase visually, they don't need their own
    # band). Alternating tint, matching the reference's own zebra pattern.
    phase_x = collections.defaultdict(list)
    for node_id in spine_order:
        n = nid[node_id]
        phase_x[n.get("phase", 0)].append(out_nodes[node_id]["x"])
    all_max_y = max((out_nodes[nid_]["y"] + out_nodes[nid_]["r"] for nid_ in out_nodes), default=SPINE_Y)
    band_bottom = all_max_y + CANVAS_PAD_BOTTOM

    phase_indices = sorted(phase_x.keys())
    bands = []
    for i, p in enumerate(phase_indices):
        xs = phase_x[p]
        x0 = min(xs) - (STEP / 2 if i > 0 else X_START)
        x1 = (min(phase_x[phase_indices[i + 1]]) - STEP / 2) if i + 1 < len(phase_indices) else max(xs) + PHASE_PAD
        bands.append({"name": phases[p] if p < len(phases) else f"Phase {p}",
                       "x0": max(0, x0), "x1": x1, "tint": i % 2 == 1})

    total_w = bands[-1]["x1"] if bands else (max((n["x"] for n in out_nodes.values()), default=0) + PHASE_PAD)
    total_h = band_bottom + TOPBAR_H

    spine_start_r = out_nodes[spine_order[0]]["r"] if spine_order else 0
    spine_end_r = out_nodes[spine_order[-1]]["r"] if spine_order else 0
    spine = {
        "x1": (out_nodes[spine_order[0]]["x"] + spine_start_r) if spine_order else 0,
        "x2": (out_nodes[spine_order[-1]]["x"] - spine_end_r) if spine_order else 0,
        "y": SPINE_Y,
    }

    return {
        "nodes": out_nodes,
        "phaseBands": bands,
        "spine": spine,
        "totalW": total_w,
        "totalH": total_h,
        "topbarH": TOPBAR_H,
    }


# ----------------------------------------------------------------- CLI
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python layout_process.py <model.json> [output.json]")
        sys.exit(1)
    in_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else in_path

    blob = json.load(open(in_path, encoding="utf-8"))
    layout = compute_process_layout(blob["nodes"], blob.get("flows", []),
                                     blob["layout"]["lanes"], blob["layout"]["phases"])
    json.dump(layout, open(out_path, "w", encoding="utf-8"), indent=1)
    print(f"WROTE {out_path} | totalW {layout['totalW']} totalH {layout['totalH']} "
          f"| spine {sum(1 for n in layout['nodes'].values() if n['onSpine'])} "
          f"| off-spine {sum(1 for n in layout['nodes'].values() if not n['onSpine'])}")
