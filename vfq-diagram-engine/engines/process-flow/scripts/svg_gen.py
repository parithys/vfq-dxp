#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
svg_gen.py — renders the actual SVG markup (phase bands, spine, node
shapes/cards, connector paths) plus the NODES/PHASES search-index arrays,
from the shared bpmn-swimlane.model.json data and the geometry
layout_process.py::compute_process_layout() computes from it.

Architecture note: unlike bpmn-swimlane's own engine (inject raw JSON,
render entirely client-side in JS), this engine bakes the SVG shapes
server-side in Python — the same construction method the hand-built
reference file this engine's design is modelled on used. Only search,
phase-jump, and export stay client-side JS (see reference/engine_template.html)
since those are the only genuinely interactive behaviours the reference
has; everything else is static once rendered, exactly like the reference.
"""
import html as _html_mod
import re

XMLNS = "http://www.w3.org/2000/svg"

# ----------------------------------------------------------------- colour vocabulary
# Every value below was read directly off the reference file's own rendered
# SVG (grep'd fill/stroke attributes), NOT off its CSS legend swatches —
# the legend's own swatch colours don't always match what's actually
# painted (e.g. its "escalation" swatch says #9B5CFF, every real escalation
# shape in the file is #7A2BD6). Actual paint colour is treated as the
# ground truth throughout this engine.
NAVY = "#2A1B9E"
TEAL = "#0F9B8E"
RED = "#F01010"
AMBER = "#C07800"
VIOLET = "#7A2BD6"
GREEN = "#12A038"
BLUE = "#3B7DD8"
INK = "#111111"
MUTE = "#5A5A66"

TAG_FILL_ACTOR = "#E4EBF6"
TAG_TEXT_ACTOR = "#2F4A6B"
TAG_FILL_SYS = "#E7E8F5"
TAG_TEXT_SYS = "#3A3E7A"

ARROW_MARKERS = {RED: "ahr", AMBER: "aha", VIOLET: "ahv", GREEN: "ahg", BLUE: "ahb"}


def esc(s):
    return _html_mod.escape(str(s or ""), quote=True)


# ----------------------------------------------------------------- text measurement (no canvas server-side — same
# estimate-then-wrap approach bpmn-swimlane/scripts/build_model.py already uses elsewhere in this codebase)
def wrap_lines(text, avg_char_px, max_width, max_lines=None):
    """Word-wraps `text` to `max_width`. With `max_lines=None` (the
    default) every word is kept — no line cap, no ellipsis — since
    card_metrics()/card_height() below size the card to however many lines
    that turns out to be. Pass an explicit `max_lines` only where a hard
    cap is actually wanted; the truncate-and-ellipsize behaviour below only
    triggers in that case."""
    text = re.sub(r"\s+", " ", str(text or "")).strip()
    if not text:
        return []
    words = text.split(" ")
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if not cur or len(test) * avg_char_px <= max_width:
            cur = test
        else:
            lines.append(cur)
            cur = w
            if max_lines is not None and len(lines) == max_lines:
                cur = ""
                break
    if cur:
        lines.append(cur)
    if max_lines is None:
        return lines
    if len(lines) > max_lines:
        lines = lines[:max_lines]
    if lines and len(text) > sum(len(l) for l in lines) + len(lines):
        last = lines[-1]
        while len(last) * avg_char_px > max_width - 3 * avg_char_px and len(last) > 4:
            last = last[:-1]
        lines[-1] = last.rstrip() + "…"
    return lines


def text_width(s, avg_char_px):
    return len(str(s)) * avg_char_px


# ----------------------------------------------------------------- shape drawing
def _clean_desc(desc):
    """Strips a leading requirement-numbering prefix ("1. The system
    shall…") but otherwise returns the description text as-is — the full
    text, not just its first sentence. Cards show the whole description,
    word-wrapped to as many lines as it needs (see wrap_lines() above and
    its max_lines=None default); there is no drawer/tooltip elsewhere in
    this engine where a reader could recover text cut here, so nothing
    gets clipped."""
    desc = re.sub(r"\s+", " ", str(desc or "")).strip()
    m = re.match(r"^\d+[\.\)]\s*", desc)
    if m:
        desc = desc[m.end():]
    return desc


def node_shape_svg(n):
    """Returns (svg_snippet, number_text_or_None). Colour/shape per category
    and onSpine — see layout_process.py::classify()'s own docstring for the
    reasoning behind each rule; colour for off-spine categories mirrors the
    connector colour that would lead to that category (red=error,
    violet=escalation, amber=recovery/off-spine-decision)."""
    x, y, r, cat, on_spine = n["x"], n["y"], n["r"], n["category"], n["onSpine"]
    if cat == "start":
        return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{NAVY}"/>', str(n["st"]).zfill(2)
    if cat == "end":
        return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="none" stroke="{NAVY}" stroke-width="3"/>'
                f'<circle cx="{x}" cy="{y}" r="{r - 5}" fill="{NAVY}"/>', str(n["st"]).zfill(2))
    if cat == "milestone":
        return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="none" stroke="{TEAL}" stroke-width="2"/>'
                f'<circle cx="{x}" cy="{y}" r="{r - 5}" fill="{TEAL}"/>', str(n["st"]).zfill(2))
    if cat == "decision":
        stroke = NAVY if on_spine else AMBER
        d = f"M {x} {y - r} L {x + r} {y} L {x} {y + r} L {x - r} {y} Z"
        num = str(n["st"]).zfill(2) if on_spine else None
        return f'<path d="{d}" fill="#fff" stroke="{stroke}" stroke-width="2.4"/>', num
    if cat == "primary":
        return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{NAVY}"/>', str(n["st"]).zfill(2)
    if cat == "error":
        d = (f'<circle cx="{x}" cy="{y}" r="{r}" fill="{RED}"/>'
             f'<path d="M {x - 5} {y - 5} L {x + 5} {y + 5} M {x + 5} {y - 5} L {x - 5} {y + 5}" '
             f'stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>')
        return d, None
    if cat == "escalation":
        s = r * 2
        return f'<rect x="{x - r}" y="{y - r}" width="{s}" height="{s}" rx="6" fill="{VIOLET}"/>', None
    # recovery
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{AMBER}"/>', None


def _shape_color(n):
    cat, on_spine = n["category"], n["onSpine"]
    if cat in ("start", "end", "primary"):
        return NAVY
    if cat == "milestone":
        return TEAL
    if cat == "decision":
        return NAVY if on_spine else AMBER
    if cat == "error":
        return RED
    if cat == "escalation":
        return VIOLET
    return AMBER


# ----------------------------------------------------------------- system-tag heuristic
# `n.systems`/`n.inputs`/`n.outputs` are frequently empty in this BRSD corpus
# (see ../reference/MODEL_SCHEMA.md "System tags" for the full rationale) —
# where they ARE populated they're used directly (a real declared value);
# where they aren't, a modest heuristic pulls likely system-name mentions
# out of the node's own description text, so a node still gets a
# reasonable tag rather than none at all. Deliberately conservative (short
# ALL-CAPS tokens, or Capitalised words immediately followed by a known
# system-ish noun) to avoid tagging ordinary sentence words.
_SYS_NOUN_SUFFIX = re.compile(
    r"\b([A-Z][A-Za-z0-9]{1,14})\s+(?:system|gateway|repository|service|inventory)\b")
_SYS_ACRONYM = re.compile(r"\b([A-Z]{2,6})\b")
# Common English determiners/pronouns/verbs that happen to start a sentence
# (and so get capitalised) must never be mistaken for a proper-noun system
# name by _SYS_NOUN_SUFFIX — "The system shall..." is the single most
# common sentence shape across this whole BRSD corpus, and "The" sits
# directly in front of "system", exactly the pattern that regex looks for.
_COMMON_WORDS = {"the", "a", "an", "this", "that", "these", "those", "such", "any", "all",
                 "each", "every", "no", "if", "when", "where", "once", "before", "after",
                 "following", "then", "final", "existing", "new", "same", "one", "two", "three"}
_STOPWORDS = {"THE", "AND", "FOR", "ARE", "NOT", "ALL", "ANY", "ONE", "TWO", "ID", "MB", "QID"}


def system_tags(node):
    declared = []
    for field in ("systems", "inputs", "outputs"):
        v = node.get(field)
        if v:
            declared.extend(str(x) for x in v if x and str(x).strip() and str(x).strip() != "-")
    if declared:
        seen, out = set(), []
        for d in declared:
            if d.lower() not in seen:
                seen.add(d.lower())
                out.append(d)
        return out[:3]
    desc = str(node.get("desc") or "")
    found = []
    for m in _SYS_NOUN_SUFFIX.finditer(desc):
        if m.group(1).lower() in _COMMON_WORDS:
            continue
        found.append(m.group(1))
    for m in _SYS_ACRONYM.finditer(desc):
        tok = m.group(1)
        if tok not in _STOPWORDS and tok not in found:
            found.append(tok)
    seen, out = set(), []
    for f in found:
        if f.lower() not in seen:
            seen.add(f.lower())
            out.append(f)
    return out[:2]


# ----------------------------------------------------------------- node card (title/code/desc/tags)
TITLE_FONT_PX, CODE_FONT_PX, DESC_FONT_PX, TAG_FONT_PX = 15.0, 11.5, 12.5, 10
TITLE_AVG_CHAR, DESC_AVG_CHAR, TAG_AVG_CHAR = 8.6, 6.3, 6.8
CARD_TEXT_OFFSET = 26
CARD_AVAIL_W = 330
SYS_TAG_FONT_PX = 9.5
SYS_TAG_H = 19   # system-tag pill height (actor tag pill uses its own literal 20 — see node_card_svg())

# Cap-height as a fraction of font-size — used everywhere below that a
# baseline-positioned SVG <text> needs to be aligned (top- or centre-)
# against something measured by its actual glyph extent rather than its
# baseline. ~0.72 is the standard approximation for the sans-serif stack
# this engine draws with (Inter/system-ui/Helvetica/Arial all cluster
# close to this). One shared constant so every alignment below agrees.
CAP_HEIGHT_RATIO = 0.72

# Default node radius for card_height()'s own pre-pass call (see its own
# docstring) — layout_process.py calls that before any node's real shape
# category (and therefore radius) has been decided, so there's no true `r`
# yet to top-align against. R_PRIMARY's own value (14, the most common
# on-spine category) stands in; the few-px difference against another
# category's real radius is inconsequential next to the 168px of
# clearance/lane buffer _row_gap() already reserves beyond max_card_h.
DEFAULT_CARD_R = 14

# On-spine nodes sit ON the shared horizontal spine line (y = SPINE_Y,
# stroke-width 2.4 — so its own ink spans roughly SPINE_Y-1.2..SPINE_Y+1.2),
# and a decision node's happy-path branch label is drawn immediately above
# that same line (see connectors_svg()'s happy_branch_label handling: its
# own text baseline is node.y - 11, so its glyph ink occupies roughly
# node.y - 22 .. node.y - 11). Off-spine nodes have neither — no line runs
# through them and nothing is ever drawn above them — so only on-spine
# title_y is floored. The floor isn't just "clear the line/label" (that
# alone would allow the title to sit almost flush against the line) — it
# also has to leave a real, comfortable reading gap between the connector
# and the card text below it, matching the deliberate spacing a
# maintainer-supplied reference mockup showed. Off-spine nodes still get
# the raw, closely top-aligned value — there's no line for them to keep
# clear of, so a tight gap there reads as intentional, not cramped.
TITLE_Y_ONSPINE_FLOOR = 30


def _centered_baseline(rect_y, rect_h, font_px):
    """Baseline y for text vertically centred within a rect of height
    rect_h starting at rect_y. SVG positions text by baseline, not by a
    glyph's own vertical centre, so naively using rect_y + rect_h/2 sits
    text visibly too high — this offsets by half the cap-height to
    actually centre the glyphs themselves. Used for every tag/badge pill
    below so they stay consistent with each other."""
    return rect_y + (rect_h + font_px * CAP_HEIGHT_RATIO) / 2


def card_metrics(node_data, lane_name, r=DEFAULT_CARD_R, on_spine=True):
    """Pure layout computation for one node's card — no SVG, just the Y
    cursor positions node_card_svg() below would place each element at,
    ending in `bottom` (the card's own lowest extent, relative to the
    node's own y). Split out from node_card_svg() so BOTH the renderer AND
    layout_process.py's row-spacing math (which has to know how much
    vertical room a card actually needs, to keep connector routing lanes
    the 40px clear of card text — see layout_process.py's ROW_GAP_MIN
    derivation) read from exactly one implementation of "how tall is this
    card," rather than two that could quietly drift apart.

    `r` is the node's own drawn shape radius (node_card_svg() passes its
    real n["r"]; layout_process.py's pre-pass call uses DEFAULT_CARD_R —
    see that function's own docstring) — title_y is derived from it so the
    shape's own TOP edge (node.y - r, true for every category: circles,
    the decision diamond's top vertex, and the escalation square all sit
    r above their own centre) lines up with the title text's top edge,
    rather than the shape being roughly centred on a block that starts
    well below it. `on_spine` floors that alignment at
    TITLE_Y_ONSPINE_FLOOR (see its own comment) so a decision node's title
    never climbs into its own happy-path branch label sitting just above
    the spine line — off-spine nodes have no such label to protect
    against, so they get the raw, fully top-aligned value."""
    sub = node_data.get("sub")
    desc_line = _clean_desc(node_data.get("desc"))
    desc_lines = wrap_lines(desc_line, DESC_AVG_CHAR, CARD_AVAIL_W)

    raw_title_y = CAP_HEIGHT_RATIO * TITLE_FONT_PX - r
    title_y = max(raw_title_y, TITLE_Y_ONSPINE_FLOOR) if on_spine else raw_title_y
    sub_y = None
    cursor = title_y
    if sub:
        cursor += 26
        sub_y = cursor
        cursor += 24
    else:
        cursor += 26
    desc_ys = []
    for i, _dl in enumerate(desc_lines):
        desc_ys.append(cursor)
        cursor += 18 if i == 0 else 21

    tag_row_y = cursor + (0 if desc_lines else -3)
    actor_tag_y = None
    if lane_name:
        actor_tag_y = tag_row_y
        tag_row_y += 26

    sys_tags = system_tags(node_data)
    sys_tag_rows = 0
    if sys_tags:
        # mirrors the same row-wrap accumulation node_card_svg() does, but
        # only needs the resulting ROW COUNT here, not each tag's own x
        row_w = 0
        sys_tag_rows = 1
        for tag in sys_tags:
            w = int(text_width(tag, TAG_AVG_CHAR)) + 22 + 8
            if row_w and (row_w + w) > CARD_AVAIL_W:
                sys_tag_rows += 1
                row_w = 0
            row_w += w
        tag_row_y += 24 * sys_tag_rows

    return {"titleY": title_y, "subY": sub_y, "descYs": desc_ys, "actorTagY": actor_tag_y,
            "descLines": desc_lines, "sysTags": sys_tags, "bottom": tag_row_y}


def card_height(node_data, lane_name, r=DEFAULT_CARD_R, on_spine=True):
    """Just the `bottom` figure from card_metrics() — how far below its own
    node.y this card's content extends. Used by layout_process.py in a
    pre-pass (before node y-positions — or shape categories, and so
    radii — are even assigned) to size row gaps with real card heights
    instead of a guessed constant — see compute_process_layout()'s own
    ROW_GAP_MIN derivation. `r` defaults to DEFAULT_CARD_R there; the real
    per-node radius is what node_card_svg() below actually renders with."""
    return card_metrics(node_data, lane_name, r, on_spine)["bottom"]


def node_card_svg(n, node_data, lane_name):
    x, y = n["x"], n["y"]
    color = _shape_color(n)
    tx = x + CARD_TEXT_OFFSET
    label = node_data.get("label") or n["id"]
    m = card_metrics(node_data, lane_name, n["r"], n["onSpine"])

    parts = []
    parts.append(f'<text x="{tx}" y="{y + m["titleY"]}" font-size="{TITLE_FONT_PX}" font-weight="700" '
                 f'fill="{INK}">{esc(label)}</text>')
    if m["subY"] is not None:
        parts.append(f'<text x="{tx}" y="{y + m["subY"]}" font-size="{CODE_FONT_PX}" font-weight="400" '
                     f'font-style="italic" fill="{INK}">{esc(str(node_data.get("sub")).upper())}</text>')
    for dy, dl in zip(m["descYs"], m["descLines"]):
        parts.append(f'<text x="{tx}" y="{y + dy}" font-size="{DESC_FONT_PX}" fill="{MUTE}">{esc(dl)}</text>')

    tag_row_y = y + (m["actorTagY"] if m["actorTagY"] is not None else m["bottom"])
    if m["actorTagY"] is not None:
        w = int(text_width(lane_name.upper(), TAG_AVG_CHAR)) + 20
        actor_tag_h = 20
        parts.append(f'<rect x="{tx}" y="{tag_row_y}" width="{w}" height="{actor_tag_h}" rx="5" fill="{TAG_FILL_ACTOR}"/>')
        parts.append(f'<text x="{tx + 10}" y="{_centered_baseline(tag_row_y, actor_tag_h, TAG_FONT_PX)}" '
                     f'font-size="{TAG_FONT_PX}" font-weight="700" '
                     f'fill="{TAG_TEXT_ACTOR}" letter-spacing="0.9">{esc(lane_name.upper())}</text>')
        tag_row_y += 26

    # System tags flow left-to-right on one row (matching the reference's own
    # Qnomy/CTI/Email layout), wrapping to a new row only once a row's
    # accumulated width would exceed CARD_AVAIL_W — not one tag per row.
    sys_tag_x, sys_tag_y = tx, tag_row_y
    row_started = False
    for tag in m["sysTags"]:
        w = int(text_width(tag, TAG_AVG_CHAR)) + 22
        if row_started and (sys_tag_x - tx + w) > CARD_AVAIL_W:
            sys_tag_x = tx
            sys_tag_y += 24
        parts.append(f'<rect x="{sys_tag_x}" y="{sys_tag_y}" width="{w}" height="{SYS_TAG_H}" rx="4" '
                     f'fill="{TAG_FILL_SYS}" stroke="#B9C2D4"/>')
        parts.append(f'<circle cx="{sys_tag_x + 9}" cy="{sys_tag_y + SYS_TAG_H / 2}" r="2.6" fill="{TAG_TEXT_SYS}"/>')
        parts.append(f'<text x="{sys_tag_x + 17}" y="{_centered_baseline(sys_tag_y, SYS_TAG_H, SYS_TAG_FONT_PX)}" '
                     f'font-size="{SYS_TAG_FONT_PX}" font-weight="700" '
                     f'fill="{TAG_TEXT_SYS}" letter-spacing="0.5">{esc(tag)}</text>')
        sys_tag_x += w + 8
        row_started = True

    shape_svg, number = node_shape_svg(n)
    parts.insert(0, shape_svg)
    if number:
        num_color = "#fff" if n["category"] not in ("decision",) else color
        parts.insert(1, f'<text x="{x}" y="{y + 3.6}" font-size="10.5" font-weight="700" '
                        f'fill="{num_color}" text-anchor="middle">{number}</text>')
    return "".join(parts), y + m["bottom"]


# ----------------------------------------------------------------- connectors
# Minimum required clearance between any two adjacent connector lines (and
# between a connector and card text) and the pitch between successive
# routing lanes. MUST agree with layout_process.py's own ROW_TEXT_CLEARANCE
# / LANE_PITCH — that module sizes every row-to-row gap specifically to fit
# N_ROUTING_LANES lanes at this exact pitch, so a mismatch here would mean
# the "guaranteed clear" lanes this router picks from are no longer
# actually guaranteed. (Not imported from there to avoid a circular import
# — layout_process.py already imports this module for card_height() — the
# same "intentionally mirrored constant" pattern this codebase already uses
# elsewhere, e.g. engine_template.html's own MIN_PAD mirroring
# build_model.py's.)
MIN_CLEARANCE = 40
LANE_PITCH = 44


def edge_color(flow, target_node):
    if target_node["category"] == "error":
        return RED
    if target_node["category"] == "escalation":
        return VIOLET
    if flow.get("kind") == "data":
        return BLUE
    return AMBER


class _LaneRouter:
    """Allocates each connector's horizontal jog a y that's guaranteed
    >=MIN_CLEARANCE px from every other jog it x-overlaps with, and
    guaranteed clear of every node's card text by construction (see
    layout_process.py's row_gap derivation — every row-to-row gap already
    reserves enough room for `n_lanes` lanes at LANE_PITCH, past
    max_card_h + MIN_CLEARANCE below any row's own card).

    Replaces an earlier version that interpolated one fixed midpoint per
    edge independently of every other edge — the direct cause of the
    audit's confirmed violation (two jogs measured 35px apart, under the
    40px floor). This router instead always routes through the safe strip
    immediately after the source (or immediately before it, for an
    upward-going edge), picking the first lane in that strip that doesn't
    x-overlap anything already placed there; only once every in-gap lane
    is taken does it fall back to the shared bottom overflow channel
    (itself lane-allocated the same way, not a single fixed y) — this also
    subsumes the old "long-distance connector" special case entirely: a
    jog placed in the gap right after its own source is, by the same
    row_gap construction, automatically clear of every OTHER row's shapes
    and card text too, however far away the target ends up being."""

    def __init__(self, total_h, row_gap, max_card_h, n_lanes, bottom_lanes):
        self.total_h = total_h
        self.row_gap = row_gap
        self.max_card_h = max_card_h
        self.n_lanes = n_lanes
        self.bottom_lanes = bottom_lanes
        self.placed_h = []   # (y, x_lo, x_hi)
        self.placed_v = []   # (x, y_lo, y_hi)

    def _row_index(self, y):
        return round((y - SPINE_Y_FALLBACK) / self.row_gap) if self.row_gap else 0

    def _h_free(self, y, x_lo, x_hi):
        return all(abs(y - py) >= MIN_CLEARANCE or x_hi < px_lo - 1 or x_lo > px_hi + 1
                   for (py, px_lo, px_hi) in self.placed_h)

    def _v_free(self, x, y_lo, y_hi):
        return all(abs(x - px) >= MIN_CLEARANCE or y_hi < py_lo - 1 or y_lo > py_hi + 1
                   for (px, py_lo, py_hi) in self.placed_v)

    def _gap_lane_y(self, gap_idx, lane):
        return SPINE_Y_FALLBACK + gap_idx * self.row_gap + self.max_card_h + MIN_CLEARANCE + lane * LANE_PITCH

    def route(self, x1, y1, x2, y2):
        """Returns an SVG path `d` string for one connector, registering
        whatever lanes it claims so later calls route around it."""
        x_lo, x_hi = (x1, x2) if x1 <= x2 else (x2, x1)
        if abs(y1 - y2) < 1:
            self._claim_v(x1, y1, y1)
            self._claim_v(x2, y2, y2)
            return f"M {x1} {y1} L {x2} {y2}"

        going_down = y2 > y1
        source_row = self._row_index(y1)
        gap_idx = source_row if going_down else source_row - 1

        jog_y = None
        for lane in range(self.n_lanes):
            candidate = self._gap_lane_y(gap_idx, lane) if going_down else \
                (self._gap_lane_y(gap_idx, self.n_lanes - 1 - lane))
            if self._h_free(candidate, x_lo, x_hi):
                jog_y = candidate
                break
        if jog_y is None:
            for lane in range(self.bottom_lanes):
                candidate = self.total_h - MIN_CLEARANCE + 16 - lane * LANE_PITCH
                if self._h_free(candidate, x_lo, x_hi):
                    jog_y = candidate
                    break
        if jog_y is None:   # every lane exhausted (extreme edge case) — stack one more below the last
            jog_y = self.total_h - MIN_CLEARANCE + 16 - self.bottom_lanes * LANE_PITCH

        self.placed_h.append((jog_y, x_lo, x_hi))
        self._claim_v(x1, min(y1, jog_y), max(y1, jog_y))
        self._claim_v(x2, min(y2, jog_y), max(y2, jog_y))
        return f"M {x1} {y1} L {x1} {jog_y} L {x2} {jog_y} L {x2} {y2}"

    def _claim_v(self, x, y_lo, y_hi):
        self.placed_v.append((x, y_lo, y_hi))


SPINE_Y_FALLBACK = 215   # must equal layout_process.py's own SPINE_Y — see _LaneRouter._row_index()


def connectors_svg(flows, nodes_by_id, total_h, row_gap, max_card_h,
                    n_lanes=2, bottom_lanes=6):
    """Returns SVG for every flow that needs an EXPLICIT drawn connector —
    a plain consecutive spine hop (st(to)==st(from)+1, happy, unlabelled)
    is already covered by the single continuous spine line and is skipped
    here, matching the reference's own construction (it never draws a
    separate line for those either)."""
    out = []
    router = _LaneRouter(total_h, row_gap, max_card_h, n_lanes, bottom_lanes)
    # A rotated branch label's position (lx, ly) depends only on the SOURCE
    # node's x and this one edge's own y-span — with no awareness of any
    # OTHER label from that same source. A node with 3+ off-spine branches
    # whose targets land at similar depths (a common shape: several
    # exception/retry outcomes off one decision) previously produced
    # several labels at the exact same (lx, ly), rendering as illegible
    # stacked text (found on Mobile Postpaid Activation: "Draft available
    # for resume" / "Supervisor reassigns draft" / "Retention period
    # elapses", all from node jsm05, all at (2049, 408)). Tracked per
    # SOURCE node (not globally) since two labels from unrelated sources
    # landing near the same point is not the failure mode this guards
    # against, and re-flagging them would just fan out labels that were
    # never actually colliding.
    placed_label_y_by_source = {}
    LABEL_COLLIDE_PX = 30   # closer than this (rotated-text is ~11px tall
                             # per line but frequently much longer once
                             # rotated, so this is a "would visually
                             # overlap" margin, not a bare font-height one)
    LABEL_FAN_PX = 14        # horizontal stagger applied per colliding label
    for f in flows:
        a, b = nodes_by_id.get(f.get("from")), nodes_by_id.get(f.get("to"))
        if not a or not b:
            continue
        trivial_spine_hop = (a["onSpine"] and b["onSpine"] and a["st"] is not None and b["st"] is not None
                              and b["st"] == a["st"] + 1 and f.get("happy") is not False
                              and f.get("kind") not in ("esc", "err") and not f.get("label"))
        if trivial_spine_hop:
            continue

        happy_branch_label = (a["onSpine"] and b["onSpine"] and f.get("happy") is True and f.get("label"))
        if happy_branch_label:
            # Left-aligned, a consistent 40px in from the source node's own
            # edge — not centred between source and target — so the label
            # reads as clearly "belonging to" the connector leaving THIS
            # node, regardless of how far away the target sits.
            lx = a["x"] + a["r"] + MIN_CLEARANCE
            out.append(f'<text x="{lx}" y="{a["y"] - 11}" font-size="11" font-weight="700" fill="{GREEN}" '
                       f'text-anchor="start">{esc(f["label"])}</text>')
            continue

        color = edge_color(f, b)
        marker = ARROW_MARKERS[color]
        dash = ' stroke-dasharray="6 5"' if color == BLUE else ""
        y1 = a["y"] + (a["r"] if b["y"] >= a["y"] else -a["r"])
        y2 = b["y"] + (-b["r"] if b["y"] >= a["y"] else b["r"])
        d = router.route(a["x"], y1, b["x"], y2)
        out.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="2.2"{dash} '
                   f'marker-end="url(#{marker})"/>')
        if f.get("label"):
            lx, ly = a["x"] - 11, (y1 + y2) / 2
            prior_ys = placed_label_y_by_source.setdefault(a["id"], [])
            lane = sum(1 for py in prior_ys if abs(py - ly) < LABEL_COLLIDE_PX)
            prior_ys.append(ly)
            if lane:
                lx -= LABEL_FAN_PX * lane
            out.append(f'<text x="{lx}" y="{ly}" font-size="11" font-weight="700" fill="{color}" '
                       f'transform="rotate(-90 {lx} {ly})" text-anchor="middle">{esc(f["label"])}</text>')
    return "".join(out)


# ----------------------------------------------------------------- phase bands
def phase_bands_svg(bands, total_h):
    out = [f'<rect x="0" y="0" width="{bands[-1]["x1"] if bands else 0}" height="64" fill="#BFC4CB"/>']
    for b in bands:
        if b["tint"]:
            out.append(f'<rect x="{b["x0"]}" y="64" width="{b["x1"] - b["x0"]}" height="{total_h - 64}" '
                       f'fill="#F8F8FB"/>')
        out.append(f'<line x1="{b["x0"]}" y1="64" x2="{b["x0"]}" y2="{total_h}" stroke="#E3E3EC"/>')
        out.append(f'<line x1="{b["x0"]}" y1="0" x2="{b["x0"]}" y2="64" stroke="#D9DDE2" stroke-width="2"/>')
        out.append(f'<text x="{b["x0"] + 18}" y="38" font-size="17" font-weight="700" fill="#15181D" '
                   f'letter-spacing="1.4">{esc(str(b["name"]).upper())}</text>')
    return "".join(out)


# ----------------------------------------------------------------- top-level entry point
DEFS = (
    f'<defs>'
    f'<marker id="ahr" markerWidth="9" markerHeight="9" refX="7.5" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="{RED}"/></marker>'
    f'<marker id="aha" markerWidth="9" markerHeight="9" refX="7.5" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="{AMBER}"/></marker>'
    f'<marker id="ahv" markerWidth="9" markerHeight="9" refX="7.5" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="{VIOLET}"/></marker>'
    f'<marker id="ahg" markerWidth="9" markerHeight="9" refX="7.5" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="{GREEN}"/></marker>'
    f'<marker id="ahb" markerWidth="9" markerHeight="9" refX="7.5" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="{BLUE}"/></marker>'
    f'</defs>'
)


def build(blob, pf_layout):
    nodes_by_id = pf_layout["nodes"]
    node_data_by_id = {n["id"]: n for n in blob["nodes"]}
    lane_name_by_key = {l["key"]: l["name"] for l in blob["layout"]["lanes"]}
    total_w, total_h = pf_layout["totalW"], pf_layout["totalH"]

    parts = [DEFS, f'<rect width="{total_w}" height="{total_h}" fill="#ffffff"/>']
    parts.append(phase_bands_svg(pf_layout["phaseBands"], total_h))
    sp = pf_layout["spine"]
    parts.append(f'<line x1="{sp["x1"]}" y1="{sp["y"]}" x2="{sp["x2"]}" y2="{sp["y"]}" '
                 f'stroke="{NAVY}" stroke-width="2.4"/>')

    node_svgs = []
    search_index = []
    for nid, n in nodes_by_id.items():
        nd = node_data_by_id.get(nid, {})
        lane_name = lane_name_by_key.get(nd.get("lane"), "")
        card_svg, _bottom = node_card_svg(n, nd, lane_name)
        # tabindex="-1": not in the page's natural Tab order (108 nodes all
        # tab-stopping would be worse for keyboard users, not better) but
        # programmatically focusable — search's goto_() calls .focus() on
        # this exact element for its current match, so a screen reader or
        # keyboard user gets real DOM focus, not just a visual highlight
        # ring (see engine_template.html's goto_()).
        node_svgs.append(f'<g id="node-{esc(nid)}" tabindex="-1">{card_svg}</g>')
        search_text = " ".join(str(x) for x in [
            n.get("st") or "", nd.get("label"), nd.get("sub"), nd.get("desc"), lane_name] if x).lower()
        search_index.append({"id": nid, "x": n["x"], "y": n["y"], "r": n["r"] + 6,
                              "lb": nd.get("label") or nid, "t": search_text})
    parts.append("".join(node_svgs))
    # row_gap/max_card_h come straight from layout_process.py's own
    # computation (see compute_process_layout()'s "rowGap"/"maxCardH") —
    # the SAME values that sized every row-to-row gap, so the lane
    # allocator's "safe zone" math agrees exactly with what the layout
    # actually reserved.
    parts.append(connectors_svg(blob.get("flows", []), nodes_by_id, total_h,
                                 pf_layout["rowGap"], pf_layout["maxCardH"]))
    parts.append('<g id="hl"></g>')  # search-highlight rings are appended here at runtime (see engine_template.html)

    svg_body = "".join(parts)
    phases_js = [{"n": b["name"], "x": b["x0"]} for b in pf_layout["phaseBands"]]
    return svg_body, search_index, phases_js
