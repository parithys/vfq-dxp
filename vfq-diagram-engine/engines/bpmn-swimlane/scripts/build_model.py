#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_model.py  —  Source workbook  ->  model.json  (domain-agnostic)

Reads an "agent-ecosystem" style workbook (the kind produced by the companion
documentation step) and derives EVERY node, lane, phase, label, relationship,
description and matrix row purely from the workbook's own cells. Nothing about
any particular business, industry or dataset is hard-coded here.

Recognised sheets (all optional; the builder degrades gracefully):
  - an "Agents" master  (columns incl. AgentID, Agent Type, Name, Parent Portal,
                          Relationship, Purpose / Feature)
  - a "Portals"/lanes list (portalId, name, role)            [optional]
  - "Integration Contracts" (Contract ID, Name, Producer..., Consumer..., Event, SLA, Rule)
  - "Capability Data Flows" (Source ID, Target ID, Data Flow)
  - "Capability Detail" (capId/id, Portal, Feature, Purpose, Data Source, Data Consumer, Data Flow ...)
  - "Connectivity Summary"                                    [optional, passed through]

Note: "Edges (Unified Graph)" and "Source Traceability" sheets, if present, are no longer
read — both fed the now-removed Data Flow Matrix / Source Traceability tabs and have no
other consumer in this skill.

Usage:  python build_model.py <workbook.xlsx> [model.json] [--title "..."] [--date YYYY-MM-DD]
"""
import sys, os, json, re
import openpyxl

# ----------------------------------------------------------------- workbook IO
def load_sheets(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    sheets = {}
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        sheets[ws.title] = rows
    wb.close()
    return sheets

def find_sheet(sheets, *keywords):
    """Return (title, rows) for the first sheet whose name contains all keywords (case-insensitive)."""
    for title, rows in sheets.items():
        t = title.lower()
        if all(k.lower() in t for k in keywords):
            return title, rows
    return None, None

def header_row_index(rows):
    """Heuristic: the header row is the first row with >=2 non-empty string cells."""
    for i, r in enumerate(rows[:8]):
        strs = [c for c in r if isinstance(c, str) and c.strip()]
        if len(strs) >= 2:
            return i
    return 0

def as_records(rows):
    if not rows:
        return []
    hi = header_row_index(rows)
    hdr = [("" if c is None else str(c).strip()) for c in rows[hi]]
    out = []
    for r in rows[hi + 1:]:
        if all(c is None for c in r):
            continue
        rec = {}
        for j, h in enumerate(hdr):
            if h:
                rec[h] = r[j] if j < len(r) else None
        out.append(rec)
    return out

def col(rec, *names):
    """First matching column value (case-insensitive, tolerant of punctuation/spacing).
    Tries exact-normalised match first, then a startswith/contains fallback for
    longer names (so 'Data Flow' matches 'Data Flow (verbatim)')."""
    norm = {re.sub(r'[^a-z0-9]', '', k.lower()): v for k, v in rec.items()}
    for n in names:
        key = re.sub(r'[^a-z0-9]', '', n.lower())
        if key in norm and norm[key] not in (None, ""):
            return norm[key]
    for n in names:
        key = re.sub(r'[^a-z0-9]', '', n.lower())
        if len(key) < 4:
            continue
        for k, v in norm.items():
            if v in (None, ""):
                continue
            if k.startswith(key) or key in k:
                return v
    return None

def short(s, sep="—"):
    s = str(s or "")
    return s.split(sep)[0].strip() if sep in s else s

# ----------------------------------------------------------------- main build
def build(path, title=None, gen_date=""):
    sheets = load_sheets(path)
    base = os.path.basename(path)

    agents_recs   = as_records(find_sheet(sheets, "agent")[1]) if find_sheet(sheets, "agent")[1] else []
    # avoid grabbing "External Actors" as the agents master: prefer a sheet literally named with "Agents"
    t, rows = find_sheet(sheets, "agents", "master")
    if rows: agents_recs = as_records(rows)
    portals_recs  = as_records(find_sheet(sheets, "portal")[1]) if find_sheet(sheets, "portal")[1] else []
    contract_recs = as_records(find_sheet(sheets, "contract")[1]) if find_sheet(sheets, "contract")[1] else []
    capflow_recs  = as_records(find_sheet(sheets, "capability", "flow")[1]) if find_sheet(sheets, "capability", "flow")[1] else []
    capdet_recs   = as_records(find_sheet(sheets, "capability", "detail")[1]) if find_sheet(sheets, "capability", "detail")[1] else []
    conn_recs     = as_records(find_sheet(sheets, "connectivity")[1]) if find_sheet(sheets, "connectivity")[1] else []
    # "Edges (Unified Graph)" and "Source Traceability" sheets are no longer parsed — both were
    # read exclusively for build_agentflows()/build_sources(), which fed the now-removed Data
    # Flow Matrix / Source Traceability tabs. If either sheet is present in a workbook, it's
    # simply ignored now rather than being read into a variable with no remaining consumer.

    # -- lanes: an Events lane + one per portal (derived from data) -------------
    portal_name_to_id = {}
    lanes = [{"key": "trigger", "name": "Events / Triggers", "hint": "Start & completion signals"}]
    if portals_recs:
        for p in portals_recs:
            pid = str(col(p, "portalId", "id", "key") or col(p, "name"))
            pnm = str(col(p, "name") or pid)
            portal_name_to_id[pnm] = pid
            lanes.append({"key": pid, "name": pnm, "hint": str(col(p, "role", "tagline") or "")})
    else:
        # derive portals from the agents' "Parent Portal" column
        seen = []
        for a in agents_recs:
            pn = str(col(a, "Parent Portal", "portal") or "").strip()
            if pn and pn != "-" and pn not in seen:
                seen.append(pn)
        for pn in seen:
            portal_name_to_id[pn] = pn
            lanes.append({"key": pn, "name": pn, "hint": ""})
    lane_keys = {l["key"] for l in lanes}
    def portal_key(pn):
        pn = str(pn or "").strip()
        return portal_name_to_id.get(pn, pn if pn in lane_keys else (lanes[1]["key"] if len(lanes) > 1 else "trigger"))

    # -- capability catalogue (nodes) from Capability Detail (fallback Agents) --
    caps = {}
    order = []
    src = capdet_recs if capdet_recs else [a for a in agents_recs if str(col(a, "Agent Type") or "").lower().startswith("cap")]
    for r in src:
        cid = str(col(r, "capId", "id", "AgentID") or "").strip()
        if not cid:
            continue
        feature = col(r, "feature", "Name") or cid
        caps[cid] = {
            "id": cid,
            "feature": str(feature),
            "portal": str(col(r, "portalName", "Portal", "Parent Portal") or ""),
            "purpose": str(col(r, "purpose", "Purpose / Feature", "Feature") or ""),
            "src":     str(col(r, "dataSource", "Data Source") or ""),
            "cons":    str(col(r, "dataConsumer", "Data Consumer") or ""),
            "flow":    str(col(r, "dataFlow", "Data Flow") or ""),
            "notes":   str(col(r, "integrationNotes", "Integration Notes") or ""),
            "rel":     str(col(r, "relationship", "Relationship") or ""),
        }
        order.append(cid)

    # -- capability->capability graph -----------------------------------------
    from collections import deque
    all_edges = set(); edge_label = {}
    for e in capflow_recs:
        s = str(col(e, "Source ID", "Source", "From") or "").strip()
        t = str(col(e, "Target ID", "Target", "To") or "").strip()
        if s in caps and t in caps and s != t:
            all_edges.add((s, t))
            lbl = str(col(e, "Data Flow", "Label") or "").strip()
            if lbl:
                edge_label[(s, t)] = (lbl[:57] + "…") if len(lbl) > 58 else lbl
    # phase ranking: break mutual 2-cycles deterministically, then longest-path layer (Kahn)
    dag = set(all_edges)
    for (s, t) in list(dag):
        if (t, s) in dag and s > t:
            dag.discard((s, t))
    adj = {c: set() for c in caps}; indeg = {c: 0 for c in caps}
    for (s, t) in dag:
        if t not in adj[s]:
            adj[s].add(t); indeg[t] += 1
    rank = {c: 0 for c in caps}
    q = deque([c for c in caps if indeg[c] == 0]); tmp = dict(indeg); guard = 0
    while q and guard < len(caps) * 4 + 8:
        guard += 1
        u = q.popleft()
        for v in adj[u]:
            if rank[v] < rank[u] + 1: rank[v] = rank[u] + 1
            tmp[v] -= 1
            if tmp[v] == 0: q.append(v)
    max_rank = max(rank.values()) if rank else 0

    # -- phases: START | Stage 1..N | END -------------------------------------
    n_stage = max_rank + 1
    phases = ["Initiate"] + [f"Stage {i+1}" for i in range(n_stage)] + ["Complete"]
    START_PH, END_PH = 0, len(phases) - 1

    # -- nodes -----------------------------------------------------------------
    N = []
    N.append({"id": "__START__", "type": "start", "lane": "trigger", "phase": START_PH,
              "label": "Process start", "sub": "", "desc": "Entry point of the process — the first inputs arrive here.",
              "inputs": [], "outputs": [], "controls": [], "agents": [], "systems": [], "contracts": [], "branches": []})
    N.append({"id": "__END__", "type": "end", "lane": "trigger", "phase": END_PH,
              "label": "Process complete", "sub": "", "desc": "The process has finished and its outputs are delivered.",
              "inputs": [], "outputs": [], "controls": [], "agents": [], "systems": [], "contracts": [], "branches": []})
    for cid in order:
        c = caps[cid]
        N.append({
            "id": cid, "type": "agent", "lane": portal_key(c["portal"]), "phase": rank[cid] + 1,
            "label": short(c["feature"]), "sub": cid, "desc": c["purpose"],
            "inputs": [c["src"]] if c["src"] else [], "outputs": [c["cons"]] if c["cons"] else [],
            "controls": [c["notes"]] if c["notes"] else [], "agents": [cid], "systems": [],
            "contracts": [], "branches": [],
        })
    NID = {n["id"]: n for n in N}

    # -- flows (draw every capability data-flow, both directions) ---------------
    F = []
    for (s, t) in sorted(all_edges):
        F.append({"from": s, "to": t, "kind": "data", "label": edge_label.get((s, t), "")})
    # bookend so nothing is orphaned
    has_in = {t for (s, t) in all_edges}
    has_out = {s for (s, t) in all_edges}
    for cid in order:
        if cid not in has_in:
            F.append({"from": "__START__", "to": cid, "kind": "seq", "label": ""})
        if cid not in has_out:
            F.append({"from": cid, "to": "__END__", "kind": "seq", "label": ""})
    if not order:
        F.append({"from": "__START__", "to": "__END__", "kind": "seq", "label": ""})

    # -- slot assignment + layout (identical geometry to the reference engine) --
    layout = compute_layout(N, lanes, phases, F)

    # -- plain-language pack (side drawer) from the workbook's own fields ------
    # `bio` feeds `biz.bio`, which the side drawer reads directly (What this does / needs /
    # produces / For example) — this is the ONLY consumer now that the Inputs & Outputs tab
    # (which used to read a parallel `bio_matrix` list built alongside this) has been removed;
    # `bio_matrix` itself was deleted along with it rather than computed and left unused.
    bio = {}
    for cid in order:
        c = caps[cid]
        bio[cid] = {"title": short(c["feature"]),
             "does": c["purpose"] or short(c["feature"]),
             "needs": c["src"] or "—",
             "makes": c["cons"] or c["flow"] or "—",
             "example": c["flow"] or ""}
    bio["__START__"] = {"title": "Process start", "does": NID["__START__"]["desc"], "needs": "", "makes": "", "example": ""}
    bio["__END__"]   = {"title": "Process complete", "does": NID["__END__"]["desc"], "needs": "", "makes": "", "example": ""}

    # -- name map (codes -> friendly names) ------------------------------------
    name_map = {}
    for a in agents_recs:
        aid = str(col(a, "AgentID", "id") or "").strip()
        if aid:
            name_map[aid] = str(col(a, "Name") or aid)
    for cid, c in caps.items():
        name_map.setdefault(cid, short(c["feature"]))
    for p in portals_recs:
        pid = str(col(p, "portalId", "id") or "").strip()
        if pid:
            name_map[pid] = str(col(p, "name") or pid)

    # -- contracts (plain, composed from the workbook's own cells) -------------
    contract_plain = {}
    for ct in contract_recs:
        cid = str(col(ct, "Contract ID", "intId", "id") or "").strip()
        if not cid:
            continue
        prod = str(col(ct, "Producer (Source)", "producer") or "")
        cons = str(col(ct, "Consumer (Target)", "consumer") or "")
        ev   = str(col(ct, "Event") or col(ct, "Name") or "")
        sla  = str(col(ct, "SLA") or "")
        rule = str(col(ct, "Rule / Governance", "Rule", "rule") or "")
        s = f"{prod} shares “{ev}” with {cons}".strip()
        if sla:  s += f" — {sla}"
        if rule: s += f". {rule}"
        contract_plain[cid] = s.strip(" .") + "."

    # -- agent catalogue: the ONLY `model` field the engine still reads (the side drawer's
    # "Agents involved" section resolves a node's `agents` ids against this). `agentflows` and
    # `sources` (and the matching Data Flow Matrix / Source Traceability tabs) were removed
    # entirely — this skill's single source of truth is the diagram plus its side drawer, not
    # a set of separate reference tables that duplicated the same underlying data.
    def rec_list(recs): return [dict(r) for r in recs]
    model = {
        "agents": rec_list(agents_recs),
        "contracts": rec_list(contract_recs),
        "connectivity": rec_list(conn_recs),
    }

    blob = {
        "model": model,
        "nodes": N,
        "flows": F,
        "layout": layout,
        "biz": {"bio": bio, "contractPlain": contract_plain, "nameMap": name_map},
        "meta": {
            "title": title or "Agent Ecosystem — Business Process Diagram",
            "subtitle": f"End-to-end process · generated from <span class=\"mono\">{base}</span>" + (f" · {gen_date}" if gen_date else ""),
            "generated": gen_date, "source": base,
        },
    }
    return blob

# ----------------------------------------------------------------- layout (geometry identical to the reference engine)
def _barycenter_reorder(N, F, lane_rows_keys):
    """Reduce total connector vertical travel by reordering each (lane, phase) bucket's row
    order (the `slot` index) to track the average position of each node's already-placed
    neighbours in the adjacent phase — the standard Sugiyama-style barycenter heuristic,
    applied here purely to ROW ORDER WITHIN A LANE (lanes themselves never change; a node
    never leaves the lane its data assigned it to). This is what "reposition nodes to reduce
    connector length" and "minimise vertical travel distance" mean at the engine level: the
    lane/phase grid a node lives in is data-driven and untouched, but WHICH ROW it occupies
    among its lane-mates at the same phase is a free layout variable the engine controls, and
    the previous behaviour (raw insertion order from the source sheet/script) had no
    relationship to which rows would keep connectors short and orthogonal.

    Runs two passes (a left-to-right pass keyed on predecessors, then a right-to-left pass
    keyed on successors) — the standard two-direction sweep, since a single direction only
    ever accounts for half of each interior node's connections. Nodes with no adjacent-phase
    neighbours keep their existing relative order (stable sort on their prior slot), so an
    isolated node is never shuffled arbitrarily just because its bucket-mates moved.
    Entirely data-driven: nothing about node count, lane count, or phase count is assumed.
    """
    if not F:
        return
    NID = {n["id"]: n for n in N}
    preds, succs = {}, {}
    for f in F:
        a, b = f.get("from"), f.get("to")
        if a not in NID or b not in NID:
            continue
        succs.setdefault(a, []).append(b)
        preds.setdefault(b, []).append(a)
    buckets = {}
    for n in N:
        buckets.setdefault((n["lane"], n["phase"]), []).append(n)

    def approx_row(node):
        # Row order is the only thing being optimised here — absolute pixel y isn't known yet
        # (lane_y hasn't been computed), but relative order within a bucket is exactly what
        # `slot` already encodes, so it doubles as a stand-in "position" for barycenter maths.
        return node["slot"]

    def sweep(neighbor_map, phase_order):
        for p in phase_order:
            for lane_key in lane_rows_keys:
                bucket = buckets.get((lane_key, p))
                if not bucket or len(bucket) < 2:
                    continue
                scored = []
                for n in bucket:
                    nbs = neighbor_map.get(n["id"], [])
                    rows = [approx_row(NID[nb]) for nb in nbs if nb in NID]
                    score = (sum(rows) / len(rows)) if rows else n["slot"]
                    scored.append((score, n["slot"], n))
                scored.sort(key=lambda t: (t[0], t[1]))   # ties keep prior relative order
                for i, (_, _, n) in enumerate(scored):
                    n["slot"] = i

    phases_present = sorted({n["phase"] for n in N})
    for _ in range(2):   # two full forward+backward iterations converge well in practice
        sweep(preds, phases_present)                # left -> right, keyed on predecessors already placed
        sweep(succs, list(reversed(phases_present)))  # right -> left, keyed on successors already placed


def _estimate_label_lines(label, eff_w, max_lines, avg_char_px=7.6):
    """Rough word-wrap line count for node-sizing purposes only — mirrors
    engine_template.html's wrapTextPx() closely enough to size the box, without
    real canvas text measurement (Python has none available at build time).
    Used so compute_layout() can grow a node's height to fit a label that
    wraps to more than one line, instead of leaving every node at its type's
    flat base height and letting a multi-line label + sub-code line overflow
    the shape's top/bottom edge."""
    if not label:
        return 1
    words = str(label).split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if not cur or len(test) * avg_char_px <= eff_w:
            cur = test
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return max(1, min(max_lines, len(lines) or 1))


def _circle_label_fits(label, eff_w, avg_char_px, max_lines=2):
    """Whether a start/end circle's label fits at its CURRENT size — i.e. wraps to
    no more than `max_lines` lines AND no single wrapped line's estimated width
    exceeds the circle's own usable chord width (`eff_w`). Circles fail differently
    than rects do: a rect's problem is usually too many lines; a circle's is more
    often a single word/phrase (e.g. "Number/SIM/CPE") that's wider than the
    circle's chord even alone, wrap or no wrap — this checks for that case too,
    not just the line count engine_template.html's own maxLines caps at 2."""
    if not label:
        return True
    words = str(label).split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if not cur or len(test) * avg_char_px <= eff_w:
            cur = test
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    if len(lines) > max_lines:
        return False
    return all(len(ln) * avg_char_px <= eff_w for ln in lines)


def _wrap_line_count(text, avail_len, avg_char_px, max_lines):
    """Estimated wrapped-line count for a given string at a given available length
    — the same greedy word-wrap approximation as _estimate_label_lines(), factored
    out so the lane-gutter sizing below (which wraps two DIFFERENT strings — name
    and hint — at two different font weights) doesn't duplicate it."""
    if not text:
        return 0
    words = str(text).split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if not cur or len(test) * avg_char_px <= avail_len:
            cur = test
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return max(1, min(max_lines, len(lines) or 1))


def _lane_gutter_columns(name, hint, avail_len, hint_max_lines):
    """Estimated total rotated columns (name lines + hint lines) a single lane's
    gutter entry will need at a given available length (governed by the lane's own
    height — a taller lane fits more characters per rotated line, so needs fewer
    columns for the same text). Mirrors engine_template.html's own wrapTextPx caps:
    up to 2 columns for the name, up to `hint_max_lines` for the hint. Both must
    agree on the same cap or the gutter Python allocates width for and the gutter
    the browser actually wraps into can disagree — see LANE_LABEL_W below."""
    name_only = str(name or "").split("·")[0].strip()
    hint_parts = []
    if name and "·" in str(name):
        hint_parts.append(str(name).split("·")[1].strip())
    if hint:
        hint_parts.append(str(hint))
    hint_text = " · ".join(p for p in hint_parts if p)
    name_avg_px, hint_avg_px = 7.8, 7.0   # bold 14px vs regular 14px — bold renders slightly wider per character
    return (_wrap_line_count(name_only, avail_len, name_avg_px, 2)
            + (_wrap_line_count(hint_text, avail_len, hint_avg_px, hint_max_lines) if hint_text else 0))


def compute_layout(N, LANES, PHASES, F=None):
    # MIN_PAD: the minimum clear whitespace (px, diagram-internal coordinate space — the
    # same units as every x/y/w/h in this file) required on every side of every node,
    # relative to the next node, lane boundary, or the canvas's own edge — an explicit
    # "100px minimum padding on all sides" requirement, not a target/typical value. Every
    # spacing constant below that governs a node's clearance is DERIVED from it (not an
    # independent guess), so the guarantee holds even at the worst case (two MULTILINE_H,
    # 100px-tall nodes stacked back to back) rather than just in the common case.
    MIN_PAD = 100
    # ROW (the vertical spacing between stacked same-lane/same-phase node slots) was 140 —
    # tuned only against the 12px-bare-minimum failure mode (two MULTILINE_H/100px-tall
    # stacked nodes almost touching), not against any specific padding floor. The actual
    # worst-case gap a flat ROW produces between two stacked nodes of height h1/h2 is
    # `ROW - (h1+h2)/2` (each node is centred within its own ROW-tall slot, so half of
    # each node's height eats into the gap from its own side) — for ROW=140 and two
    # MULTILINE_H(100) nodes that's 140-100=40px, well under a 100px floor. Solving
    # `ROW - (100+100)/2 >= MIN_PAD` for the worst case (both nodes at MULTILINE_H, the
    # tallest a rect/circle ever grows to — defined further down as MULTILINE_H=100, but
    # inlined here as a literal since it's needed before that point in the function) gives
    # ROW >= MIN_PAD + 100 = 200; +20 on top keeps a small safety margin above that exact
    # floor rather than landing on it (guards against float-accumulation from the JS-side
    # dynamic widening pass, further downstream, ever nudging a real gap a fraction under
    # the nominal 100).
    ROW = MIN_PAD + 100 + 20
    TOPBAR, COLW, PAD = 70, 252, 20
    sizes = {"start": (84, 84), "end": (84, 84), "decision": (150, 84), "validation": (176, 70),
             "system": (190, 56), "external": (176, 54), "agent": (206, 60), "control": (206, 60),
             "error": (190, 58), "escalation": (190, 58)}
    # slot per (lane, phase) — initial order (insertion order from the source data), later
    # optimised in place by _barycenter_reorder() below when a flow list is available.
    # This (and the lane_rows it feeds) is computed BEFORE LANE_LABEL_W/X0 below,
    # earlier than it strictly needs to be for node placement — because the gutter-
    # width estimate now needs each lane's own row count (-> lane height -> how many
    # characters fit per rotated line) to know how many hint columns to allocate for.
    slot_counter = {}
    for n in N:
        k = (n["lane"], n["phase"])
        n["slot"] = slot_counter.get(k, 0)
        slot_counter[k] = n["slot"] + 1
    lane_keys = [L["key"] for L in LANES]
    _barycenter_reorder(N, F, lane_keys)
    lanecount = {}
    for n in N:
        lanecount.setdefault(n["lane"], {})
        lanecount[n["lane"]][n["phase"]] = max(lanecount[n["lane"]].get(n["phase"], 0), n["slot"] + 1)
    lane_rows = {lk: max([1] + list(v.values())) for lk, v in lanecount.items()}

    # Lane labels render rotated 90° (vertical, reading bottom-to-top) instead of horizontal
    # wrapped text — a narrower gutter is needed since the label's rendered "length" runs
    # along the lane's HEIGHT, not the gutter's width. LANE_LABEL_W used to be a flat 100 —
    # enough for up to ~3 side-by-side columns (up to 2 for the wrapped name, 1 for a
    # TRUNCATED hint line) — but a truncated hint discards real content with no way to
    # recover it on-canvas, which is exactly what a "don't truncate, wrap instead" reader
    # requirement rules out. LANE_LABEL_W is now sized dynamically: for every lane, estimate
    # how many rotated columns its name+hint will need (name capped at 2 columns, hint at
    # HINT_MAX_LINES, both matching engine_template.html's own wrapTextPx caps exactly — see
    # the hint-column rendering there), take the worst lane across the whole diagram, and
    # size the shared gutter to fit it. Down from a prior 190 (horizontal wrapped text,
    # pre-rotation); briefly 60, then 80, at earlier points in the rotation's own history
    # before hints were added back in as a rendered column at all. If a hand-authored model
    # still needs a wider gutter for some other reason, `layout.laneLabelW` in model.json
    # overrides this computed value exactly as it always could — nothing about the override
    # mechanism changed, only how the default is derived.
    HINT_MAX_LINES = 12
    COL_GAP = 20   # kept in sync with engine_template.html's own COL_GAP constant
    max_cols = 1
    for L in LANES:
        lane_h = lane_rows.get(L["key"], 1) * ROW + PAD * 2
        avail_len = max(40, lane_h - 24)
        max_cols = max(max_cols, _lane_gutter_columns(L.get("name", ""), L.get("hint", ""), avail_len, HINT_MAX_LINES))
    LANE_LABEL_W = max(100, max_cols * COL_GAP + 20)
    X0_MARGIN = MIN_PAD   # minimum clear gap between the gutter's right edge and the first
                          # phase column's own left edge, beyond LANE_LABEL_W itself — a
                          # container-boundary case of the same MIN_PAD floor every other
                          # node-to-node/node-to-edge gap in this function now derives from
    # X0 (where the first phase column begins) is DERIVED from LANE_LABEL_W, not a second,
    # independent constant. It used to be a hardcoded 150 sitting alongside a hardcoded
    # LANE_LABEL_W of 150 — the two only stayed consistent by coincidence, and when
    # LANE_LABEL_W was later widened to 190 to fit longer lane names, X0 was never revisited,
    # leaving it at 150. Every node type wider than ~100px placed in phase 0 (agent, control,
    # system, error, escalation, validation, external — 7 of 10 node types) is centred in a
    # cell that starts at X0=150, giving it a left edge BELOW 190 — i.e. physically underneath
    # the lane-label gutter. In the live view the gutter is a `position:sticky` HTML overlay
    # (z-index:5) layered above the ENTIRE SVG canvas, independent of any SVG-internal paint
    # order — so this isn't something a z-order fix inside the SVG can solve; the node's own
    # geometry has to keep clear of the gutter's width in the first place. Tying X0 to
    # LANE_LABEL_W with a fixed margin means the two can never drift out of sync again,
    # regardless of what LANE_LABEL_W is set to (including a hand-authored script's own
    # widened gutter — see SKILL.md's "if any lane name or hint is longer than..." guidance,
    # which already shifts every node's x/cx when it widens the gutter; that logic remains
    # correct and unaffected by this change since it operates on whatever x0 it's given).
    X0 = LANE_LABEL_W + X0_MARGIN
    # LANE_GAP: empty vertical space inserted BETWEEN adjacent lanes (not added to any lane's
    # own height) so lane ownership reads at a glance instead of requiring the reader to trace
    # the divider line carefully — two lanes' nodes previously abutted right up against that one
    # thin 1.5px line with zero breathing room on either side, which read as ambiguous exactly
    # where a node from a taller lane extended close to the boundary (worse once phase columns
    # gained their own tinted backgrounds, which made the lack of any horizontal gap between
    # lanes more visually obvious than it was against a plain white canvas). Went 16 -> 20px per
    # an explicit follow-up request that also replaced the old thin #E3E3E3 divider LINE with a
    # solid #FFFFFF filled band spanning this exact gap (see engine_template.html's own lane-loop
    # comment) — sized to exactly fill the gap, not float within it, so the two values can never
    # drift out of sync. This is pure inter-lane whitespace, not a change to any lane's own row
    # count/height or to any node's position WITHIN its lane — every node, connector, and label
    # downstream of `lane_y` picks up the shift automatically since nothing here is hardcoded
    # elsewhere.
    LANE_GAP = 20
    lane_y = {}
    y = TOPBAR
    for L in LANES:
        h = lane_rows.get(L["key"], 1) * ROW + PAD * 2
        lane_y[L["key"]] = (y, h); y += h + LANE_GAP
    total_h = y + 120     # already exceeds MIN_PAD on its own (this band also carries the
                          # backward/loop-connector "bus" routing space — see
                          # engine_template.html's own comment on that shared band — so it
                          # isn't reduced to a bare MIN_PAD floor)
    total_w = X0 + len(PHASES) * COLW + MIN_PAD   # right-edge container-boundary clearance
    # Vertical text-fit sizing: a node's box height is a flat per-type constant from
    # `sizes` above, but the label it has to hold isn't — a label that wraps to 2-3
    # lines (plus a sub-code line, most nodes have one) needs more vertical room than
    # a one-line label does, and the flat constant was sized for the one-line case.
    # Without this, a long label's text simply overflows the box's top/bottom edge —
    # the box never grows to match what it's actually holding.
    #
    # MULTILINE_H is a single FLAT height (100), not a size that scales with line
    # count — every node whose content needs 2+ total lines (wrapped label lines
    # plus an optional sub-code line) gets the same generous box, whether it ends up
    # holding 2, 3, or 4 lines. A tiered/proportional size was tried first and
    # rejected: it made otherwise-similar nodes visually inconsistent (a 2-line node
    # noticeably smaller than a 4-line node right next to it) for a height difference
    # that isn't actually meaningful to a reader. One flat size reads as "this is the
    # multi-line node shape" the same way start/end circles read as "this is the
    # terminal shape" — a recognisable category, not a proportional measurement.
    #
    # Text is vertically centred within whatever height a node ends up with entirely
    # by construction, not by any logic added here: engine_template.html positions
    # every label/sub line relative to `n.cy` (`n.cy = n.y + h/2`, set below from
    # whatever `h` this loop lands on), using an offset derived purely from the
    # node's own line count — never from `h` itself. So centring already works for
    # any height this loop produces; this loop only has to get `h` right.
    MULTILINE_H = 100
    # Circles (start/end) fail the same underlying way rects do — a flat per-type
    # size that was never checked against what the label actually needs — but the
    # fix has to be a fit-CHECK rather than a line-count trigger, since a circle's
    # chord is much narrower than its diameter (engine_template.html's own
    # effW = n.w*0.72) and a single long word can overflow even a "2 lines is fine"
    # label. Reuses MULTILINE_H as the grown diameter (not a separate constant) so
    # a grown circle is never taller than the ROW spacing already proven safe for
    # grown rects — see the ROW comment above.
    # 6.5, not the originally-derived 5.7 (7.6 * 10.5/14, scaling the rect-label calibration
    # down proportionally by font size) — that scaled estimate under-predicted real rendered
    # width by enough to matter: real canvas-measured text for a label like "End of Order
    # Capture Journey" wrapped to 4 lines in the browser while the 5.7 estimate confidently
    # (and wrongly) predicted 3 would fit, so the circle never grew past MULTILINE_H and the
    # 4th line got silently merged + ellipsis-truncated by wrapTextPx's own overflow handling.
    # 6.5 is calibrated to the tightest real observed constraint from that same word ("End of
    # Order" wrapping onto 2 lines rather than fitting 1) rather than a pure proportional
    # scale-down, which is apparently NOT how these two font sizes actually relate in practice.
    CIRCLE_AVG_CHAR_PX = 6.5
    for n in N:
        w, h = sizes.get(n["type"], (206, 60))
        is_circle = n["type"] in ("start", "end")
        is_decision = n["type"] == "decision"
        if is_circle:
            # max_lines=4 here, not 3 — circles need MORE lines than rects/decisions for
            # equally-long text, not the same, because their usable chord width (w*0.72) is
            # narrower per line than a rect's (w-18) at a comparable diameter. Matched by the
            # same max_lines=4 in engine_template.html's own isCircle branch — the two MUST
            # agree, or this sizing decision and what the browser actually allows disagree.
            if not _circle_label_fits(n.get("label", ""), w * 0.72, CIRCLE_AVG_CHAR_PX, max_lines=4):
                w = h = MULTILINE_H
        else:
            # The sub-code no longer renders at all (engine_template.html's node-label
            # loop has no sub-code text output any more — "reference code should no
            # longer be displayed on any node"), so it no longer factors into how much
            # height a node needs either. Height now grows only for a wrapped LABEL —
            # a node whose label is a single line stays at its base size, matching
            # what's actually drawn.
            eff_w = w * 0.62 if is_decision else w - 18
            label_lines = _estimate_label_lines(n.get("label", ""), eff_w, max_lines=3)
            if label_lines >= 2:
                h = MULTILINE_H
        n["w"], n["h"] = w, h
        cellx = X0 + n["phase"] * COLW
        n["x"] = cellx + (COLW - w) / 2
        ly, _ = lane_y.get(n["lane"], (TOPBAR, ROW))
        n["y"] = ly + PAD + n["slot"] * ROW + (ROW - h) / 2
        n["cx"] = n["x"] + w / 2; n["cy"] = n["y"] + h / 2
    return {"x0": X0, "topbar": TOPBAR, "colw": COLW, "totalW": total_w, "totalH": total_h,
            "laneLabelW": LANE_LABEL_W,
            "lanes": [{**L, "y": lane_y[L["key"]][0], "h": lane_y[L["key"]][1]} for L in LANES if L["key"] in lane_y],
            "phases": PHASES}

# ----------------------------------------------------------------- CLI
if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print("usage: python build_model.py <workbook.xlsx> [model.json] [--title ...] [--date YYYY-MM-DD]"); sys.exit(1)
    wb = args[0]
    out = "model.json"
    title = None; date = ""
    rest = args[1:]
    i = 0
    while i < len(rest):
        if rest[i] == "--title": title = rest[i + 1]; i += 2
        elif rest[i] == "--date": date = rest[i + 1]; i += 2
        else: out = rest[i]; i += 1
    blob = build(wb, title=title, gen_date=date)
    json.dump(blob, open(out, "w"), indent=1, default=str)
    print("WROTE", out, "| nodes", len(blob["nodes"]), "flows", len(blob["flows"]),
          "agents", len(blob["model"]["agents"]))
