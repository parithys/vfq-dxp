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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import svg_gen  # noqa: E402 — card_height() needs to agree exactly with what node_card_svg() actually draws

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
STEP = 340            # x-spacing between consecutive spine nodes — was 400 (a 60px, 15% cut,
                        # paired with svg_gen.py's CARD_AVAIL_W, 330->270, the SAME 60px cut) per
                        # direct user review of rendered output across 6 full-page screenshots: a short card's
                        # text routinely left 150px+ of dead canvas before the next spine node,
                        # reading as wasted screen real estate rather than intentional breathing
                        # room. CARD_TEXT_OFFSET is deliberately left untouched — shrinking it
                        # risks text visibly crowding a node's own shape marker (up to r=21 for
                        # R_END_OUTER/R_MILESTONE_OUTER) — so the entire 60px cut comes out of
                        # CARD_AVAIL_W, which keeps the router's own reserve gap (STEP -
                        # CARD_TEXT_OFFSET - CARD_AVAIL_W, see svg_gen.py's own comment on this
                        # near its CARD_AVAIL_W definition) shrinking by the SAME 60px as STEP —
                        # not compounding on top of it. That reserve is exactly the room this
                        # engine's own dodge/escape connector-routing logic (_dodge_x2 and the
                        # left-vertex-exit "too close" fallback in svg_gen.py) searches in when a
                        # preceding card blocks a direct approach — already confirmed tight at the
                        # OLD 44px reserve (multiple corpus-wide cases needed the y-escape or the
                        # SHORT_VERTEX_ENTRY_MIN exception even before this change) — see the
                        # verification note against the CARD_AVAIL_W edit in svg_gen.py.
X_START = 60           # first (start) node's x
SPINE_Y = 215           # y of every spine node
TOPBAR_H = 64            # phase-header band height

# Row-to-row vertical gap floors at REFERENCE_TIER_GAP (below), the flat
# constant reverse-engineered directly from the maintainer-supplied
# reference file's own off-spine tier spacing — confirmed there across
# every multi-tier chain checked (x=5260, x=6860, x=16060 all use exactly
# 215px between consecutive tier centres). Grows past that floor only when
# THIS row's own content genuinely needs more: an earlier version derived
# the gap purely from card height with no floor at all, which — for a row
# whose card happened to be shorter than what the reference's own examples
# had — left as little as ~15px between that row's card text and the next
# row's connector routing, nowhere near the 40px minimum clearance a
# reader needs. Flooring at the reference's own constant, rather than
# computing every row independently from scratch, matches the reference's
# actual behaviour for the common case while still growing for genuinely
# long content instead of letting it overlap.
REFERENCE_TIER_GAP = 215
ROW_TEXT_CLEARANCE = 40   # required clearance: card bottom -> first routing lane, and last lane -> next row's shapes
N_ROUTING_LANES = 2        # in-gap lanes guaranteed 40px clear of card text and of each other;
                            # a row-gap needing a 3rd+ concurrent connector overflows into the
                            # reserved bottom channel instead (see LONG_SPAN_X / lane allocator)
BOTTOM_CHANNEL_LANES = 6    # the reserved channel below the whole diagram (for long-distance
                            # connectors — see svg_gen.py's LONG_SPAN_X) gets a more generous lane
                            # budget than an ordinary in-gap row, since every long-distance
                            # connector in the whole diagram funnels into that one shared channel,
                            # not just the ones crossing one particular row
LANE_PITCH = 60             # mirrors svg_gen.py's own LANE_PITCH — see that copy's own comment for why
                            # it's above the bare ROW_TEXT_CLEARANCE(40) floor, not just at it


def _row_gap(max_card_h, n_lanes=N_ROUTING_LANES):
    """Vertical distance needed to fit: the tallest card actually in this
    diagram + 40px clearance below it + `n_lanes` routing lanes at
    LANE_PITCH + 40px clearance before whatever comes next — floored at
    REFERENCE_TIER_GAP (see its own comment). Used both for the uniform
    spine/tier row gap (default n_lanes) and for the bottom overflow
    channel's own depth (BOTTOM_CHANNEL_LANES)."""
    return max(REFERENCE_TIER_GAP, max_card_h + ROW_TEXT_CLEARANCE + n_lanes * LANE_PITCH + ROW_TEXT_CLEARANCE)
CANVAS_PAD_TOP = 64           # content starts below the topbar
# CANVAS_PAD_BOTTOM is no longer a flat constant — see compute_process_layout(),
# where it's computed as _row_gap(max_card_h, BOTTOM_CHANNEL_LANES): the
# deepest row's own card needs the same 40px clearance any other row's card
# gets, plus room for however many long-distance connectors funnel into the
# shared bottom overflow channel (see svg_gen.py's LONG_SPAN_X).
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

    # BOUNDARY_MARGIN keeps a card's own text visibly clear of the phase
    # divider LINE itself, not just technically not-overlapping it — the
    # same "real reading gap, not a bare non-collision" reasoning
    # ROW_TEXT_CLEARANCE already documents for row spacing. MIN_CARD_AVAIL_W
    # is a floor so a pathologically narrow phase (very short business
    # phase, few nodes) still wraps to a readable multi-word line instead
    # of degenerating toward one word per line. Defined here, ahead of
    # spine_x, because spine_x's own gap sizing (below) now depends on
    # them.
    BOUNDARY_MARGIN = 20
    MIN_CARD_AVAIL_W = 120

    # Spine spacing is dynamic, floored at STEP(400) — never below it,
    # regardless of content — but grown past that floor wherever a phase
    # boundary would otherwise squeeze a card. The boundary line between
    # two phases sits at the MIDPOINT of the gap separating them (see the
    # band x0/x1 math below, confirmed against the reference), so at a
    # flat STEP=400 gap that midpoint lands only 200px past the outgoing
    # phase's last node — nowhere near the CARD_TEXT_OFFSET(26) +
    # CARD_AVAIL_W(330) + BOUNDARY_MARGIN(20) = 376px that node's own card
    # needs, forcing it to compress well below its designed width
    # (confirmed overflowing on Mobile Postpaid Activation's "Save
    # Milestone as Draft Order" before this fix existed). Widening JUST
    # the gap that straddles a phase boundary — to whatever keeps that
    # midpoint the full 376px clear of the outgoing node — lets every
    # card render at its full designed width instead of being squeezed;
    # every other (same-phase) gap stays at the flat STEP floor since
    # nothing there ever needs more.
    PHASE_BOUNDARY_GAP = max(STEP, 2 * (svg_gen.CARD_TEXT_OFFSET + svg_gen.CARD_AVAIL_W + BOUNDARY_MARGIN))

    spine_x = {}
    for i, node_id in enumerate(spine_order):
        if i == 0:
            spine_x[node_id] = X_START
            continue
        prev_id = spine_order[i - 1]
        crosses_phase = nid[prev_id].get("phase", 0) != nid[node_id].get("phase", 0)
        spine_x[node_id] = spine_x[prev_id] + (PHASE_BOUNDARY_GAP if crosses_phase else STEP)

    # Phase bands only ever depend on spine node x (fixed the instant
    # spine_x above is known — never on row_gap/card height/off-spine
    # positions), so they're computed here, BEFORE card heights, rather
    # than at the end where the final returned dict needs them.
    phase_x = collections.defaultdict(list)
    for node_id in spine_order:
        phase_x[nid[node_id].get("phase", 0)].append(spine_x[node_id])
    phase_indices = sorted(phase_x.keys())
    bands = []
    for i, p in enumerate(phase_indices):
        xs = phase_x[p]
        x0 = min(xs) - (PHASE_BOUNDARY_GAP / 2 if i > 0 else X_START)
        x1 = (min(phase_x[phase_indices[i + 1]]) - PHASE_BOUNDARY_GAP / 2) if i + 1 < len(phase_indices) else max(xs) + PHASE_PAD
        bands.append({"name": phases[p] if p < len(phases) else f"Phase {p}",
                       "x0": max(0, x0), "x1": x1, "tint": i % 2 == 1})
    band_x1_by_phase = {p: bands[i]["x1"] for i, p in enumerate(phase_indices)}

    avail_w_by_node = {}
    for node_id in spine_order:
        x1 = band_x1_by_phase.get(nid[node_id].get("phase", 0))
        if x1 is None:
            continue
        room = x1 - (spine_x[node_id] + svg_gen.CARD_TEXT_OFFSET) - BOUNDARY_MARGIN
        avail_w_by_node[node_id] = max(MIN_CARD_AVAIL_W, min(svg_gen.CARD_AVAIL_W, room))

    # Row gap is LOCAL to each spine anchor's own branch, not one value for
    # the whole diagram — a branch near short cards sits close to its own
    # spine row; a branch near a verbose card still gets all the room it
    # needs, without inflating spacing anywhere else in the diagram.
    #
    # An earlier version of this tried exactly that and reverted: sizing
    # a branch's gap from just that anchor's own subtree (itself + its
    # off-spine descendants) missed the case where a DIFFERENT, unrelated
    # spine node's card physically reaches into this branch's territory —
    # off-spine siblings spread up to +/-SIBLING_PITCH per extra sibling
    # from their own anchor, easily landing inside a NEIGHBOURING spine
    # column's own 330px-wide card, even when that neighbour has no
    # off-spine children of its own (so nothing in "just this anchor's
    # subtree" ever accounted for it). Confirmed and reverted on Mobile
    # Postpaid Activation's "Scan Identity Document" / "Draft Order
    # Expiry" pair — a real, measured overlap.
    #
    # The fix kept here: local_max_h for a branch is the tallest card
    # among its own subtree AND every spine node whose own card
    # (x+CARD_TEXT_OFFSET .. x+CARD_TEXT_OFFSET+CARD_AVAIL_W) horizontally
    # overlaps the x-territory this branch's own cards occupy — computed
    # from real x positions (off-spine x never depends on row_gap, so it
    # can be finalized first), not a guessed safety margin.
    lane_name_by_key = {l["key"]: l["name"] for l in lanes}

    def _card_h(node_id, is_spine):
        n = nid[node_id]
        lane_name = lane_name_by_key.get(n.get("lane"), "")
        avail_w = avail_w_by_node.get(node_id, svg_gen.CARD_AVAIL_W)
        return svg_gen.card_height(n, lane_name, on_spine=is_spine, avail_w=avail_w)

    # Still computed globally — used only as the fallback for a spine node
    # that never anchors any off-spine branch (never actually exercised
    # for row-spacing in that case) and for the shared bottom overflow
    # channel's own depth, below.
    max_card_h = max((_card_h(n["id"], n["id"] in spine_set) for n in nodes), default=0)
    fallback_row_gap = _row_gap(max_card_h)

    off_spine_ids = [n["id"] for n in nodes if n["id"] not in spine_set]
    anchors = _anchor_and_tier(off_spine_ids, spine_x, flows)
    x_to_spine_id = {x: sid for sid, x in spine_x.items()}

    # Collision spread: multiple off-spine nodes sharing the exact same
    # (anchor_x, tier) are nudged apart horizontally in a fixed order
    # (sorted by id for determinism) rather than overlapping outright.
    # X positions never depend on row_gap (only y does), so every off-spine
    # node's final x can be finalized before row_gap is computed at all.
    bucket = collections.defaultdict(list)
    for node_id in off_spine_ids:
        ax, t = anchors[node_id]
        bucket[(ax, t)].append(node_id)

    off_spine_x = {}
    descendants_by_anchor = collections.defaultdict(list)
    for (ax, t), ids in bucket.items():
        # Sequential forward offsets (0, +STEP, +2*STEP, ...) — the first
        # sibling sits in the SAME column as its own anchor, each further
        # one shifted one more spine-column-width to the right. Reused
        # directly from the maintainer-supplied reference file's own
        # layout (vfq-mobile-postpaid-activation-complete-flow_10.html):
        # confirmed on its jsm05 cluster, whose three siblings sit at
        # anchor+0/+400/+800 — the SAME 400px pitch the primary spine
        # itself uses, not a card-width-derived spread centred on the
        # anchor. An earlier version of this code centred siblings
        # symmetrically around their anchor at +/-SIBLING_PITCH; that
        # doesn't match the reference at all (every real example places
        # the first sibling directly under the anchor and grows only
        # rightward).
        #
        # Column ORDER within that sequence: a sibling that is also the
        # target of another sibling's own edge (a within-cluster
        # convergence point) is pushed to the outermost column — it needs
        # routing headroom for that cross-sibling edge on top of whatever
        # reaches it from the anchor itself. Every other sibling keeps its
        # natural declaration order, starting at the anchor's own column.
        # This is the whole reference's ONLY real 3+-way fan-out (every
        # other spine node in it has exactly one off-spine child, so
        # there's no ordering to resolve there) — jsm05's cluster: jsm07 ->
        # jsm06 is a cross-sibling edge, so jsm06 (its target) lands last
        # (+800) while jsm07 and jsm08, untouched by any cross-sibling
        # edge, keep their declared order at +0/+400. A single confirmed
        # example can't rule out a subtler rule for larger clusters, but
        # this reproduces the one case there is to check against and
        # never changes behaviour for the common case (no cross-sibling
        # edges at all).
        sibling_targets = {f.get("to") for f in flows if f.get("from") in ids and f.get("to") in ids}
        ids_sorted = sorted(ids, key=lambda nid_: (nid_ in sibling_targets, ids.index(nid_)))
        for j, node_id in enumerate(ids_sorted):
            off_spine_x[node_id] = ax + j * STEP
        descendants_by_anchor[ax].extend(ids_sorted)

    CARD_L, CARD_R = svg_gen.CARD_TEXT_OFFSET, svg_gen.CARD_TEXT_OFFSET + svg_gen.CARD_AVAIL_W
    local_max_h = {}
    for ax, descendant_ids in descendants_by_anchor.items():
        anchor_id = x_to_spine_id.get(ax)
        subtree_ids = ([anchor_id] if anchor_id else []) + descendant_ids
        h = max((_card_h(nid_, nid_ in spine_set) for nid_ in subtree_ids), default=0)
        lo = min(off_spine_x[nid_] for nid_ in descendant_ids) + CARD_L
        hi = max(off_spine_x[nid_] for nid_ in descendant_ids) + CARD_R
        lo, hi = min(lo, ax + CARD_L), max(hi, ax + CARD_R)
        for sid in spine_order:
            s_x = spine_x[sid]
            if s_x + CARD_L <= hi and s_x + CARD_R >= lo:
                h = max(h, _card_h(sid, True))
        local_max_h[ax] = h

    # How many EXPLICIT ROUTED connectors (not the implicit spine line, not
    # an inline happy-branch label — see svg_gen.needs_lane()) actually
    # leave each spine anchor, using the SAME classification svg_gen.py's
    # connectors_svg() itself uses for the real render, evaluated here on
    # lightweight prelim node dicts (onSpine/st are already fully decided
    # by spine_order — nothing else needs_lane() reads depends on row_gap
    # or any of the geometry that's still being computed at this point).
    # A row_gap sized for a flat N_ROUTING_LANES(2) starves any anchor with
    # 3+ concurrent jogs, forcing the excess into the shared bottom
    # overflow channel — a detour proportional to the WHOLE diagram's
    # height, not to how far apart the two actual nodes are (confirmed on
    # Mobile Postpaid Activation node jsm05/jsm06's own 5 outgoing data-flow
    # edges, and again on jsm06/jsm07's "Supervisor reassigns draft"/
    # "Retention period elapses" pair). Sizing each anchor's own row_gap to
    # its REAL demand keeps every jog local, the same "derive from actual
    # need, not a guess" rule local_max_h above already follows for card
    # height.
    st_by_id = {node_id: i + 1 for i, node_id in enumerate(spine_order)}

    def _prelim(node_id):
        return {"onSpine": node_id in spine_set, "st": st_by_id.get(node_id)}

    # Counts BOTH directions: an outgoing edge claims a lane in the gap
    # right after its own source (going_down) — that's this anchor's own
    # demand; an INCOMING edge landing here that travels upward (a
    # loop-back) claims a lane in the gap right before ITS OWN source,
    # which can still land inside a NEIGHBOURING anchor's gap region and
    # collide there purely by (row_gap, SPINE_Y_FALLBACK) arithmetic
    # coincidence — confirmed on Mobile Postpaid Activation's jsm05, whose
    # own 3 outgoing edges (to jsm06/jsm07/jsm08) got exactly 3 lanes, yet
    # the 3rd still overflowed to the bottom channel because an unrelated
    # loop-back edge landing AT jsm05 (from a node two columns over)
    # happened to compute the identical absolute y for its own jog. A flat
    # +1 buffer on any anchor with real demand absorbs that kind of
    # incidental cross-anchor collision without the cost of a full global
    # lane-scheduling pass.
    # An OFF-SPINE node's own edges route through ITS OWN anchor's row-gap
    # too (a["laneCount"]/a["rowGap"] for an off-spine source come from
    # local_lane_count[its own anchor x] — see out_nodes below) — but
    # only on-spine endpoints were ever counted here, so an edge entirely
    # BETWEEN two off-spine nodes (neither in spine_x) contributed to NO
    # anchor's demand at all, no matter how many such edges piled onto
    # the same busy anchor. Confirmed on Mobile Postpaid Activation:
    # kyc03_rescan -> kyc03_manual_approval and kyc03_manual_approval ->
    # kyc04_age (both off-spine-sourced) detoured thousands of px to the
    # shared bottom channel — their shared anchor's demand count never
    # saw either edge, so it never provisioned the extra lanes they
    # needed. _anchor_x resolves an off-spine node to the same anchor x
    # its own row_gap/laneCount will end up using.
    def _anchor_x(node_id):
        if node_id in spine_x:
            return spine_x[node_id]
        if node_id in anchors:
            return anchors[node_id][0]
        return None

    lanes_needed_by_anchor = collections.defaultdict(int)
    for f in flows:
        a_id, b_id = f.get("from"), f.get("to")
        if a_id not in nid or b_id not in nid:
            continue
        if not svg_gen.needs_lane(f, _prelim(a_id), _prelim(b_id)):
            continue
        a_anchor, b_anchor = _anchor_x(a_id), _anchor_x(b_id)
        if a_anchor is not None:
            lanes_needed_by_anchor[a_anchor] += 1
        # Only counted again for b_anchor when it DIFFERS from a_anchor —
        # one flow is one lane, however many of its own endpoints happen
        # to anchor to the same x. Counting it twice against the SAME
        # anchor's demand when both ends share it (a parent-child edge
        # anchored to the parent's own column, or any edge entirely
        # within one multi-child cluster) inflated that anchor's row_gap
        # far past what its actual lane usage needed — confirmed on
        # Mobile Postpaid Activation's jsm05 cluster: 5 real edges (3
        # parent->child drops, 1 within-cluster edge, 1 loop-back), all
        # anchored to jsm05's own x on BOTH ends, counted as 10 lanes of
        # demand instead of 5, more than doubling that row's own gap
        # past what routing them actually required.
        if b_anchor is not None and b_anchor != a_anchor:
            lanes_needed_by_anchor[b_anchor] += 1

    local_row_gap = {}
    local_lane_count = {}
    for ax in spine_x.values():
        demand = lanes_needed_by_anchor.get(ax, 0)
        # +2 buffer only once demand already exceeds the base allowance —
        # ordinary low-traffic anchors (the vast majority) stay at the
        # tight default, only a genuinely busy anchor pays for the slack
        # that absorbs incidental cross-anchor collisions (see comment
        # above lanes_needed_by_anchor) AND candidates the card-clearance
        # check (_LaneRouter._clear_of_cards()) rejects outright — a
        # card-blocked lane isn't recoverable the way a jog-blocked one is
        # (there's no "wait for the other jog to move"), so busy anchors
        # need more spare capacity now that both checks compete for the
        # same lane pool. +1 alone measurably under-provisioned this in
        # practice (60/518 connectors still overflowing to the bottom
        # channel, up from 41/522 before the card-clearance check existed).
        n_lanes_here = max(N_ROUTING_LANES, demand + 2 if demand > N_ROUTING_LANES else demand)
        local_lane_count[ax] = n_lanes_here
        local_row_gap[ax] = _row_gap(local_max_h.get(ax, max_card_h), n_lanes_here)

    out_nodes = {}
    for i, node_id in enumerate(spine_order):
        n = nid[node_id]
        out_flows = [f for f in flows if f.get("from") == node_id]
        cat = classify(n, True, out_flows)
        x = spine_x[node_id]
        r = {"start": R_START, "end": R_END_OUTER, "milestone": R_MILESTONE_OUTER,
             "decision": R_DECISION}.get(cat, R_PRIMARY)
        out_nodes[node_id] = {"id": node_id, "category": cat, "x": x, "y": SPINE_Y,
                               "r": r, "st": i + 1, "onSpine": True,
                               "rowGap": local_row_gap.get(x, fallback_row_gap),
                               "maxCardH": local_max_h.get(x, max_card_h),
                               "availW": avail_w_by_node.get(node_id, svg_gen.CARD_AVAIL_W),
                               "laneCount": local_lane_count.get(x, N_ROUTING_LANES)}

    for (ax, t), ids in bucket.items():
        ids_sorted = sorted(ids)
        n_ids = len(ids_sorted)
        row_gap_here = local_row_gap[ax]
        max_h_here = local_max_h[ax]
        for j, node_id in enumerate(ids_sorted):
            n = nid[node_id]
            out_flows = [f for f in flows if f.get("from") == node_id]
            cat = classify(n, False, out_flows)
            x = off_spine_x[node_id]
            y = SPINE_Y + (t + 1) * row_gap_here
            r = {"error": R_ERROR, "escalation": ESCALATION_SIZE / 2,
                 "decision": R_DECISION}.get(cat, R_RECOVERY)
            out_nodes[node_id] = {"id": node_id, "category": cat, "x": x, "y": y,
                                   "r": r, "st": None, "onSpine": False,
                                   "rowGap": row_gap_here, "maxCardH": max_h_here,
                                   "laneCount": local_lane_count.get(ax, N_ROUTING_LANES)}

    # Two off-spine nodes anchored to DIFFERENT spine columns can still
    # spread toward each other far enough for their cards to overlap —
    # the sibling-offset formula above only guarantees clearance WITHIN one (anchor,
    # tier) bucket, not between two independent branches that happen to
    # land close together (confirmed on Mobile MACD Plan Change:
    # "reject_blacklist" / "lockin_penalty_payment", anchored to two
    # different spine nodes). Final deterministic sweep, sorted by (y, x)
    # so it processes top-to-bottom/left-to-right the same way every
    # time: push any card that still overlaps an already-placed one to
    # sit just right of it, re-checking against everything placed so far
    # since one push can walk into a card that was already clear.
    # A node's own reserved footprint isn't just its card text box — an
    # off-spine node with an upward outgoing edge routes that connector's
    # exit from its LEFT vertex plus a short horizontal lead-in (see
    # svg_gen.py's left_vertex_exit), landing OUTSIDE the card box, to its
    # own left. Not every off-spine node ends up using one, but reserving
    # the room unconditionally is cheap and guarantees an unrelated card
    # can never end up sitting exactly where that exit would need to pass
    # through (confirmed on Bill Formatter: "xml_failed"'s own left-vertex
    # exit point landed 4px inside "reports_account_mgr"'s card — the two
    # are on different branches entirely, so this sweep's own EXISTING
    # card-vs-card check, below, had no reason to know about it).
    LEFT_EXIT_MARGIN = svg_gen.MIN_SEGMENT_LENGTH

    off_spine_sorted = sorted(off_spine_ids, key=lambda nid_: (out_nodes[nid_]["y"], out_nodes[nid_]["x"]))
    placed_boxes = []   # (x0, y0, x1, y1) already finalized, in this pass's own order
    for node_id in off_spine_sorted:
        n = out_nodes[node_id]
        h = _card_h(node_id, False)
        base_x = n["x"]
        left_offset = min(CARD_L, -n["r"] - LEFT_EXIT_MARGIN)
        y0, y1 = n["y"], n["y"] + h
        dx = 0
        for _ in range(len(placed_boxes) + 1):   # bounded: dx only ever grows, past a finite set
            moved = False
            box_left, box_right = base_x + dx + left_offset, base_x + dx + CARD_R
            for (px0, py0, px1, py1) in placed_boxes:
                if box_left < px1 and box_right > px0 and y0 < py1 and y1 > py0:
                    dx = px1 + ROW_TEXT_CLEARANCE - left_offset - base_x
                    moved = True
            if not moved:
                break
        n["x"] = base_x + dx
        placed_boxes.append((base_x + dx + left_offset, y0, base_x + dx + CARD_R, y1))

    # Widen phase bands (forward only) to include every off-spine node's
    # full-width card requirement — keyed by which band the node's own x
    # ACTUALLY falls inside, not by its declared phase field. Those two
    # routinely disagree: a decision's rejection/exception branch is
    # commonly declared under the NEXT business phase even though it
    # renders right next to the decision itself, still inside the
    # decision's own (earlier) phase's band (a real, intentional
    # modelling choice — see the phase-mismatch badge below, and
    # README). Widening whichever band the DECLARED phase names, instead
    # of whichever band the node is actually drawn inside, widened a
    # band the node was never rendered in and left the real one exactly
    # as narrow as before — confirmed on Mobile Postpaid Activation's
    # "Reject Unsupported Document Type" (anchored at the same x as its
    # own decision, squarely inside that decision's phase band, but
    # declared under the FOLLOWING phase): its band never widened, so
    # its card fell all the way to the MIN_CARD_AVAIL_W floor below and
    # STILL overflowed the boundary — the floor guarantees a readable
    # minimum width, never that the width fits in whatever room is
    # actually left.
    #
    # `+ BOUNDARY_MARGIN` (not just `+ CARD_R`) so a member drives its
    # band all the way out to give its OWN card true CARD_AVAIL_W at
    # render time (see the avail_w loop just below, which subtracts the
    # same BOUNDARY_MARGIN) — otherwise every member's card landed
    # exactly BOUNDARY_MARGIN short of full width regardless of how much
    # the band grew.
    #
    # Only ever extends x1 rightward, cascading into every later band's
    # own x0 so nothing overlaps — never pulls a band's x0 backward to
    # reach a member that drifted BEFORE its own band starts, since that
    # would eat into the PREVIOUS band's already-established territory.
    #
    # `natural_bands` starts as a snapshot of the PRE-widening band
    # list, and every membership decision each pass makes (both which
    # band a node's own requirement widens, and which band's x1 that
    # same node reads back) keys off this SAME snapshot — but a single
    # pass isn't enough: widening one band can push its own x1 forward
    # far enough to swallow a node that a LATER band's own natural
    # (pre-widening) territory used to contain, and that later band's
    # own widening was never sized for it (it widened using the
    # snapshot BEFORE the earlier band grew). Confirmed on Bill
    # Formatter: "Operational Dashboard & Statistics" (and two
    # siblings) naturally sat in band 2 pre-widening, but band 1 widened
    # — for a completely different member — past their shared x, and a
    # single-pass version of this fix kept sizing these three nodes
    # against band 2's OWN (unrelated) x1 even though they'd since been
    # geometrically swallowed by band 1's now-wider territory, so their
    # cards rendered starting on band 1's background but ending well
    # into band 2's. Re-running the whole pass against its own previous
    # output, until no band's x1 moves and every node's natural-band
    # assignment stops changing, converges on a fixed point where every
    # off-spine node's requirement is counted by whichever band it's
    # ACTUALLY, finally rendered inside — not just whichever band
    # widening had settled on one pass ago. Bounded by the number of
    # off-spine nodes (at most one additional node can get newly
    # captured by an earlier band per pass, so it can't run longer than
    # that before stabilising).
    natural_bands = bands
    for _ in range(len(off_spine_ids) + 2):
        def _natural_band_index(x, _bands=natural_bands):
            for bi, b in enumerate(_bands):
                if b["x0"] <= x < b["x1"]:
                    return bi
            return len(_bands) - 1

        running_x = 0
        widened_bands = []
        for i, band in enumerate(natural_bands):
            members_x1 = [
                out_nodes[nid_]["x"] + CARD_R + BOUNDARY_MARGIN
                for nid_ in off_spine_ids
                if _natural_band_index(out_nodes[nid_]["x"]) == i
            ]
            x0 = max(band["x0"], running_x)
            x1 = max(band["x1"], x0, *members_x1) if members_x1 else max(band["x1"], x0)
            widened_bands.append({**band, "x0": x0, "x1": x1})
            running_x = x1
        if widened_bands == natural_bands:
            break
        natural_bands = widened_bands
    bands = natural_bands

    # Redefined fresh against the FINAL, converged `bands` — the loop's
    # own last definition of this same helper closed over whichever
    # `natural_bands` was current one pass before convergence, which
    # only coincidentally matches `bands` when the loop broke out early
    # rather than exhausting its safety cap.
    def _natural_band_index(x):
        for bi, b in enumerate(bands):
            if b["x0"] <= x < b["x1"]:
                return bi
        return len(bands) - 1

    # Off-spine nodes get the SAME phase-boundary text clamp spine nodes
    # got above, but only now — the sweep just above can drift a node's x
    # (sibling spread, or the rightward collision push) far enough to
    # land inside a NEIGHBOURING phase's territory, so only the node's
    # FINAL x (not its anchor's) says which band it actually belongs to
    # — reusing the SAME _natural_band_index() the widening pass just
    # used (see its own comment above), then reading that band's now-
    # final (post-widening) x1. Rendering-only: deliberately NOT fed
    # back into local_max_h/row_gap above (which already sized every row
    # using each off-spine card's un-clamped, wider width) — narrowing
    # only ever ADDS wrapped lines, it never removes any the row-gap
    # pass already accounted for, so a clamped card can occasionally run
    # slightly closer to the row below it than an un-clamped one would,
    # but never past a routing lane or another row's own shapes (the
    # 40px clearances baked into row_gap aren't fully consumed by any
    # real card in practice).
    for node_id in off_spine_ids:
        n = out_nodes[node_id]
        x1 = bands[_natural_band_index(n["x"])]["x1"]
        room = x1 - (n["x"] + svg_gen.CARD_TEXT_OFFSET) - BOUNDARY_MARGIN
        n["availW"] = max(MIN_CARD_AVAIL_W, min(svg_gen.CARD_AVAIL_W, room))

    # A node whose declared phase's OWN band doesn't actually contain its
    # rendered card — either a residual case the widening pass above
    # couldn't resolve (drifted backward — see that pass's own comment),
    # or one of the structural "decision lives in phase N, its outcome
    # branches are categorised under phase N+1+" cases (a real, common,
    # intentional modelling choice confirmed across this corpus — a
    # decision's resolution routinely belongs to a different business
    # phase than the decision itself; see README) — gets its true phase
    # name shown directly on its own card (see svg_gen.py's
    # node_card_svg() "phaseLabel" handling) so the tint colour behind it
    # and the card's own text can never disagree about which phase a node
    # actually belongs to, regardless of why the two diverge.
    for node_id in off_spine_ids:
        n = out_nodes[node_id]
        own_phase = nid[node_id].get("phase", 0)
        if own_phase >= len(bands) or own_phase >= len(phases):
            continue
        own_band = bands[own_phase]
        card_x0, card_x1 = n["x"] + CARD_L, n["x"] + CARD_L + n["availW"]
        if card_x0 < own_band["x0"] - 1 or card_x1 > own_band["x1"] + 1:
            n["phaseLabel"] = phases[own_phase]

    # `bands`/`phase_indices` were already computed above, right after
    # spine_x — they only ever depend on spine node x (fixed then), so
    # out_nodes[node_id]["x"] here (spine nodes never move after spine_x)
    # would just reproduce the identical result. Only what genuinely
    # depends on the now-finished out_nodes/max_card_h is computed here.
    all_max_y = max((out_nodes[nid_]["y"] + out_nodes[nid_]["r"] for nid_ in out_nodes), default=SPINE_Y)
    band_bottom = all_max_y + _row_gap(max_card_h, BOTTOM_CHANNEL_LANES)

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
        # Global fallback only — svg_gen.py::connectors_svg() reads each
        # edge's own SOURCE node's "rowGap"/"maxCardH" (out_nodes[id],
        # above) for its actual lane-zone math; these two are the default
        # for the rare node that has neither (shouldn't happen, but keeps
        # the router from crashing on a KeyError).
        "rowGap": fallback_row_gap,
        "maxCardH": max_card_h,
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
