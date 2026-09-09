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
import bisect
import collections
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
SUB_CODE_INK = "#2D1AA5"

# Actor and system tags used to differ only by a near-identical pale
# blue-vs-lavender fill (#E4EBF6 vs #E7E8F5) and near-identical dark-blue
# text (#2F4A6B vs #3A3E7A) — indistinguishable at a glance, confirmed by
# a reader unable to tell "RETAIL AGENT" from "BR"/"GCC" apart by colour
# alone. Differentiated now by WEIGHT as well as hue, not hue alone (so it
# doesn't rely on colour vision to read): actor is a solid dark slate
# badge with white text (>8:1 contrast — a role/identity marker, "who");
# system stays a light outlined chip but shifted to a teal family, clearly
# apart from actor's blue-slate and from every category legend colour
# (NAVY/TEAL-milestone/RED/AMBER/VIOLET/GREEN/BLUE already carry their own
# distinct meaning, so neither tag reuses one of those exactly — TAG_TEXT_SYS
# is a darker, less saturated teal than the milestone TEAL above it).
TAG_FILL_ACTOR = "#334361"
TAG_TEXT_ACTOR = "#FFFFFF"
TAG_FILL_SYS = "#E1F5F2"
TAG_TEXT_SYS = "#0B6E63"
TAG_BORDER_SYS = "#8FCFC4"

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
TITLE_LINE_H = 20   # gap between two wrapped title lines — same ratio to TITLE_FONT_PX(15) as
                     # DESC_FONT_PX(12.5)'s own established 21px inter-line gap uses (~1.68x font size)
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

# The single trailing gap used between every pair of distinct card
# elements (title, actor tag, system tags, description, sub code) — see
# card_metrics()'s own comment on why this has to be one shared constant
# rather than a per-transition value.
CARD_ELEMENT_GAP = 14

# Below a text baseline, ~22% of the font size is a reasonable allowance
# for descenders (CAP_HEIGHT_RATIO above already models the ascent side
# of the same font stack). Needed because CARD_ELEMENT_GAP has to mean
# the same VISUAL whitespace whether it's measured from a box element
# (whose rect bottom/top are exact) or a baseline-text element (whose
# baseline sits inside its own glyph ink, not at its visual edge) —
# without this, a text-to-text transition (description -> sub code)
# ends up looking tighter or looser than a box-to-box one for the same
# raw pixel delta.
DESCENT_RATIO = 0.22


def _text_bottom(baseline, font_px):
    return baseline + DESCENT_RATIO * font_px


def _text_top(baseline, font_px):
    return baseline - CAP_HEIGHT_RATIO * font_px


def _centered_baseline(rect_y, rect_h, font_px):
    """Baseline y for text vertically centred within a rect of height
    rect_h starting at rect_y. SVG positions text by baseline, not by a
    glyph's own vertical centre, so naively using rect_y + rect_h/2 sits
    text visibly too high — this offsets by half the cap-height to
    actually centre the glyphs themselves. Used for every tag/badge pill
    below so they stay consistent with each other."""
    return rect_y + (rect_h + font_px * CAP_HEIGHT_RATIO) / 2


def card_metrics(node_data, lane_name, r=DEFAULT_CARD_R, on_spine=True, avail_w=CARD_AVAIL_W):
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
    against, so they get the raw, fully top-aligned value.

    `avail_w` is the actual usable text width for THIS node — CARD_AVAIL_W
    by default, but narrower for a spine node sitting right up against its
    own phase's boundary (see layout_process.py's avail_w_by_node): title,
    description, and system tags all wrap to it, so nothing in the card
    ever renders past whatever width this node actually has room for."""
    sub = node_data.get("sub")
    desc_line = _clean_desc(node_data.get("desc"))
    desc_lines = wrap_lines(desc_line, DESC_AVG_CHAR, avail_w)
    title_text = node_data.get("label") or node_data.get("id") or ""
    title_lines = wrap_lines(title_text, TITLE_AVG_CHAR, avail_w) or [""]

    raw_title_y = CAP_HEIGHT_RATIO * TITLE_FONT_PX - r
    title_y = max(raw_title_y, TITLE_Y_ONSPINE_FLOOR) if on_spine else raw_title_y
    title_ys = [title_y + i * TITLE_LINE_H for i in range(len(title_lines))]

    # Rendering order: title -> actor tag -> system tags -> description ->
    # sub code. `bottom` tracks the lowest VISUALLY INKED pixel used so
    # far (not a baseline or a raw cursor) — every element below computes
    # its own position as bottom + CARD_ELEMENT_GAP, then converts that
    # back into whatever coordinate its own type actually needs (a rect's
    # top edge is already its visual top, no conversion needed; a text
    # baseline sits CAP_HEIGHT_RATIO*font above its own visual top, so it
    # needs that added back in). Without this conversion, the exact same
    # CARD_ELEMENT_GAP produces visibly different whitespace depending on
    # whether the elements on either side are boxes or baseline text —
    # confirmed on description -> sub code, both baseline text, where an
    # earlier version of this function measured the gap in raw baseline
    # units and it read as a noticeably bigger gap than every other
    # transition in the same card.
    bottom = _text_bottom(title_ys[-1], TITLE_FONT_PX)

    actor_tag_y = None
    if lane_name:
        actor_tag_y = bottom + CARD_ELEMENT_GAP
        bottom = actor_tag_y + 20   # 20px tag height

    # System tags sit under the actor tag (or directly under the title
    # when there's none).
    sys_tags = system_tags(node_data)
    sys_tag_y = None
    if sys_tags:
        sys_tag_y = bottom + CARD_ELEMENT_GAP
        # mirrors the same row-wrap accumulation node_card_svg() does, but
        # only needs the resulting ROW COUNT here, not each tag's own x
        row_w = 0
        sys_tag_rows = 1
        for tag in sys_tags:
            w = int(text_width(tag, TAG_AVG_CHAR)) + 22 + 8
            if row_w and (row_w + w) > avail_w:
                sys_tag_rows += 1
                row_w = 0
            row_w += w
        bottom = sys_tag_y + 24 * (sys_tag_rows - 1) + SYS_TAG_H

    desc_ys = []
    if desc_lines:
        dcursor = bottom + CARD_ELEMENT_GAP + CAP_HEIGHT_RATIO * DESC_FONT_PX
        for i, _dl in enumerate(desc_lines):
            desc_ys.append(dcursor)
            dcursor += 18 if i == 0 else 21
        bottom = _text_bottom(desc_ys[-1], DESC_FONT_PX)

    sub_y = None
    if sub:
        sub_y = bottom + CARD_ELEMENT_GAP + CAP_HEIGHT_RATIO * CODE_FONT_PX
        bottom = _text_bottom(sub_y, CODE_FONT_PX)

    return {"titleLines": title_lines, "titleYs": title_ys, "subY": sub_y, "descYs": desc_ys,
            "actorTagY": actor_tag_y, "descLines": desc_lines, "sysTags": sys_tags, "sysTagY": sys_tag_y,
            "bottom": bottom}


def card_height(node_data, lane_name, r=DEFAULT_CARD_R, on_spine=True, avail_w=CARD_AVAIL_W):
    """Just the `bottom` figure from card_metrics() — how far below its own
    node.y this card's content extends. Used by layout_process.py in a
    pre-pass (before node y-positions — or shape categories, and so
    radii — are even assigned) to size row gaps with real card heights
    instead of a guessed constant — see compute_process_layout()'s own
    ROW_GAP_MIN derivation. `r` defaults to DEFAULT_CARD_R there; the real
    per-node radius is what node_card_svg() below actually renders with."""
    return card_metrics(node_data, lane_name, r, on_spine, avail_w)["bottom"]


def node_card_svg(n, node_data, lane_name):
    x, y = n["x"], n["y"]
    color = _shape_color(n)
    tx = x + CARD_TEXT_OFFSET
    avail_w = n.get("availW", CARD_AVAIL_W)
    m = card_metrics(node_data, lane_name, n["r"], n["onSpine"], avail_w)

    # Rendering order: title(s) -> actor tag -> system tags -> description
    # -> sub code — see card_metrics()'s own Y math.
    parts = []
    for ty, tl in zip(m["titleYs"], m["titleLines"]):
        parts.append(f'<text x="{tx}" y="{y + ty}" font-size="{TITLE_FONT_PX}" font-weight="700" '
                     f'fill="{INK}">{esc(tl)}</text>')

    if m["actorTagY"] is not None:
        actor_tag_y = y + m["actorTagY"]
        w = int(text_width(lane_name.upper(), TAG_AVG_CHAR)) + 20
        actor_tag_h = 20
        parts.append(f'<rect x="{tx}" y="{actor_tag_y}" width="{w}" height="{actor_tag_h}" rx="5" fill="{TAG_FILL_ACTOR}"/>')
        parts.append(f'<text x="{tx + 10}" y="{_centered_baseline(actor_tag_y, actor_tag_h, TAG_FONT_PX)}" '
                     f'font-size="{TAG_FONT_PX}" font-weight="700" '
                     f'fill="{TAG_TEXT_ACTOR}" letter-spacing="0.9">{esc(lane_name.upper())}</text>')

    # System tags flow left-to-right on one row (matching the reference's own
    # Qnomy/CTI/Email layout), wrapping to a new row only once a row's
    # accumulated width would exceed this node's own avail_w — not one tag
    # per row.
    if m["sysTagY"] is not None:
        sys_tag_x, sys_tag_y = tx, y + m["sysTagY"]
        row_started = False
        for tag in m["sysTags"]:
            w = int(text_width(tag, TAG_AVG_CHAR)) + 22
            if row_started and (sys_tag_x - tx + w) > avail_w:
                sys_tag_x = tx
                sys_tag_y += 24
            parts.append(f'<rect x="{sys_tag_x}" y="{sys_tag_y}" width="{w}" height="{SYS_TAG_H}" rx="4" '
                         f'fill="{TAG_FILL_SYS}" stroke="{TAG_BORDER_SYS}"/>')
            parts.append(f'<circle cx="{sys_tag_x + 9}" cy="{sys_tag_y + SYS_TAG_H / 2}" r="2.6" fill="{TAG_TEXT_SYS}"/>')
            parts.append(f'<text x="{sys_tag_x + 17}" y="{_centered_baseline(sys_tag_y, SYS_TAG_H, SYS_TAG_FONT_PX)}" '
                         f'font-size="{SYS_TAG_FONT_PX}" font-weight="700" '
                         f'fill="{TAG_TEXT_SYS}" letter-spacing="0.5">{esc(tag)}</text>')
            sys_tag_x += w + 8
            row_started = True

    for dy, dl in zip(m["descYs"], m["descLines"]):
        parts.append(f'<text x="{tx}" y="{y + dy}" font-size="{DESC_FONT_PX}" fill="{MUTE}">{esc(dl)}</text>')

    if m["subY"] is not None:
        parts.append(f'<text x="{tx}" y="{y + m["subY"]}" font-size="{CODE_FONT_PX}" font-weight="400" '
                     f'font-style="italic" fill="{SUB_CODE_INK}">{esc(str(node_data.get("sub")).upper())}</text>')

    # A node whose declared business phase doesn't match the tint band it
    # actually renders under (see layout_process.py's own phaseLabel
    # assignment — either a residual boundary case, or the common,
    # intentional "decision in phase N, outcome categorised under phase
    # N+1" pattern) gets its TRUE phase named directly on the card, styled
    # deliberately unlike both tag types above (dashed outline, italic,
    # neutral grey — reads as a meta note, not a category) so a reader is
    # never misled by tint colour alone about which phase a node belongs
    # to. Anchored at the card's real bottom (after description/sub, not
    # just after the system tags now sitting higher up).
    if n.get("phaseLabel"):
        phase_y = y + m["bottom"]
        ptxt = f"Phase: {n['phaseLabel']}"
        pw = int(text_width(ptxt, TAG_AVG_CHAR)) + 16
        parts.append(f'<rect x="{tx}" y="{phase_y}" width="{pw}" height="{SYS_TAG_H}" rx="4" '
                     f'fill="none" stroke="{MUTE}" stroke-dasharray="3 2"/>')
        parts.append(f'<text x="{tx + 8}" y="{_centered_baseline(phase_y, SYS_TAG_H, SYS_TAG_FONT_PX)}" '
                     f'font-size="{SYS_TAG_FONT_PX}" font-weight="700" font-style="italic" '
                     f'fill="{MUTE}" letter-spacing="0.3">{esc(ptxt)}</text>')

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
LANE_PITCH = 60   # >MIN_CLEARANCE(40) on purpose — MIN_CLEARANCE is the enforced floor between any two
                   # elements, LANE_PITCH is the actual spacing BETWEEN two stacked routing lanes, which
                   # reads as visually cramped at a bare 44px once 3+ lanes stack in a dense cluster (every
                   # jog's own line, its rotated label, and the next jog's line all crowding the same
                   # ~40px band) — see layout_process.py's own LANE_PITCH for why both copies move together.
LABEL_GAP = 18   # base perpendicular gap between ANY connector label (rotated off-spine branch label,
                  # or the horizontal happy-branch label) and the line it's attached to — 16-24px per this
                  # engine's own minimum-clearance standard for label spacing (MIN_CLEARANCE=40 is the
                  # floor for node/card/shape/connector clearance, a different, larger standard; this one
                  # is specifically "label to its own line," which reads as visually crowded at a bare
                  # 11px, this constant's own previous value). Shared by both label styles via this ONE
                  # constant — an earlier version hardcoded -11 separately in each of the two call sites,
                  # which is exactly how they drifted out of sync before (see git history) and is why this
                  # is a single named constant, not two literals that happen to agree today.
                  #
                  # Measured from the line's actual x (which sits at the SOURCE node's own x for a straight
                  # vertical drop — confirmed against connectors_svg()'s own y1/y2 computation just below,
                  # which offsets y by the node radius but never x), not from the node's radius: an earlier
                  # version subtracted a["r"] here too, which made the gap balloon for large-radius
                  # categories (e.g. R_DECISION=18) while the horizontal label's gap stayed flat regardless
                  # of category — exactly the cross-label inconsistency this constant exists to remove.
                  # Genuine overlap with the source shape (only possible when ly lands close to the node's
                  # own y, e.g. a short edge) is still caught and corrected by _clear_of_every_shape below,
                  # which pushes ly (not lx) clear — so dropping the r term here doesn't reopen the "label
                  # drawn through the diamond" bug that originally motivated it.
                  #
                  # Kept separate from MIN_CLEARANCE (40px), which stays in use everywhere this label is
                  # pushed to actually CLEAR a card/shape/sibling-label collision below — this constant
                  # only sets the default, no-collision starting gap.
ROTATED_LABEL_GAP = LABEL_GAP   # kept as an alias — see LABEL_GAP above; renaming every call site below
                                 # to the new shared name is unnecessary churn for a value that's identical


def is_trivial_spine_hop(f, a, b):
    """True for a plain consecutive spine hop (st(to)==st(from)+1, happy,
    unlabelled) — already covered by the single continuous spine line, so
    connectors_svg() draws nothing for it at all."""
    return (a["onSpine"] and b["onSpine"] and a["st"] is not None and b["st"] is not None
            and b["st"] == a["st"] + 1 and f.get("happy") is not False
            and f.get("kind") not in ("esc", "err") and not f.get("label"))


def is_happy_branch_label(f, a, b):
    """True for an on-spine happy-path branch flow that continues to the
    IMMEDIATE next spine step — drawn as a plain inline text label (see
    connectors_svg()'s happy_branch_label handling) anchored purely to the
    SOURCE's own position, never as a routed path, so it never consumes a
    _LaneRouter lane.

    Requires b["st"] == a["st"] + 1 (mirrors is_trivial_spine_hop()'s own
    adjacency check): a decision can have TWO happy outcomes — one
    continuing to the next step, another skipping several steps ahead
    (e.g. Mobile Postpaid Activation's cam01_match: "Existing customer
    matched" -> cam02, immediate; "New customer created" -> cam06, skips
    cam03-05). Both used to qualify here, and since this label's position
    depends ONLY on the source (not the target), they landed at the
    EXACT same (x, y) — illegible. A non-adjacent happy branch has
    nothing about it that makes "just write text near the source" a safe
    assumption once a second flow can share that same anchor, so it
    falls through to the normal routed-connector path instead, which
    positions its label from the ACTUAL jog geometry and naturally can't
    collide with a sibling label the same way."""
    return (a["onSpine"] and b["onSpine"] and f.get("happy") is True and bool(f.get("label"))
            and a.get("st") is not None and b.get("st") is not None and b["st"] == a["st"] + 1)


def needs_lane(f, a, b):
    """True iff this flow is drawn as an explicit routed connector in
    connectors_svg() — i.e. it will consume one of _LaneRouter's jog lanes.
    Shared with layout_process.py, which uses it (via lightweight prelim
    node dicts, before final layout is known) to size each spine anchor's
    own row_gap to the ACTUAL number of jogs that anchor needs to route,
    instead of a flat guess — see N_ROUTING_LANES there."""
    return not is_trivial_spine_hop(f, a, b) and not is_happy_branch_label(f, a, b)


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
    (itself lane-allocated the same way, not a single fixed y).

    A jog placed in the gap right after its own source is, by the same
    row_gap construction, clear of every card whose OWN row that gap
    belongs to — but NOT automatically clear of every other node's card
    anywhere else the horizontal run happens to pass through: a long jog
    can span many STEP columns, and nothing about "this y is free of other
    JOGS" (_h_free below) says anything about a card sitting in that same
    x-range at a totally different row. Confirmed on Mobile Postpaid
    Activation: a jog sourced from a node at x=3260 chose jog_y=654 (a
    lane that's genuinely clear of every OTHER jog), then ran horizontally
    all the way back to x=2460 — cutting straight through an unrelated
    "Scan Identity Document" card's own system-tag row sitting at
    y=636-655 in that x-range, a card _h_free never even looks at. See
    _clear_of_cards() below, which every lane candidate is now also
    checked against.

    row_gap/max_card_h are no longer fixed at construction — each route()
    call takes its own (see connectors_svg() below, which passes the
    SOURCE node's own local values: layout_process.py sizes row_gap per
    spine-anchor branch now, not once for the whole diagram, so a branch
    near short cards stays compact even if some other node far away has a
    much longer description). This is safe for the shared collision-
    avoidance below: _h_free()/_v_free()/placed_h/placed_v all compare
    actual x/y coordinates, never row_gap-relative units, so different
    calls using different row_gap values still correctly avoid every lane
    already claimed by any earlier call."""

    def __init__(self, total_h, n_lanes, bottom_lanes, card_boxes=None):
        self.total_h = total_h
        self.n_lanes = n_lanes
        self.bottom_lanes = bottom_lanes
        self.placed_h = []   # (y, x_lo, x_hi)
        self.placed_v = []   # (x, y_lo, y_hi)
        self.card_boxes = card_boxes or []   # (x0, x1, y0, y1) per node — see class docstring

    def _row_index(self, y, row_gap):
        return round((y - SPINE_Y_FALLBACK) / row_gap) if row_gap else 0

    def _h_free(self, y, x_lo, x_hi):
        return all(abs(y - py) >= MIN_CLEARANCE or x_hi < px_lo - 1 or x_lo > px_hi + 1
                   for (py, px_lo, px_hi) in self.placed_h)

    def _v_free(self, x, y_lo, y_hi):
        return all(abs(x - px) >= MIN_CLEARANCE or y_hi < py_lo - 1 or y_lo > py_hi + 1
                   for (px, py_lo, py_hi) in self.placed_v)

    def _clear_of_cards(self, y, x_lo, x_hi):
        """True iff a horizontal jog at `y` spanning [x_lo, x_hi] stays
        MIN_CLEARANCE(40px) clear of every node's real card footprint —
        not just its own source/target's, every node's, since the jog's
        horizontal run can cross paths with any card that happens to sit
        in its x-span at an unrelated row (see class docstring)."""
        return all(y < y0 - MIN_CLEARANCE or y > y1 + MIN_CLEARANCE or x_hi < x0 - 1 or x_lo > x1 + 1
                   for (x0, x1, y0, y1) in self.card_boxes)

    def _gap_lane_y(self, gap_idx, lane, row_gap, max_card_h):
        return SPINE_Y_FALLBACK + gap_idx * row_gap + max_card_h + MIN_CLEARANCE + lane * LANE_PITCH

    def route(self, x1, y1, x2, y2, row_gap, max_card_h, n_lanes=None):
        """Returns (d, jog_y, x_lo, x_hi): the SVG path `d` string for one
        connector, the exact y its horizontal jog landed on, and the x-span
        that jog covers — the caller uses jog_y/x_lo/x_hi to place this
        edge's label directly along its own routed corridor (see
        connectors_svg()) instead of guessing a position independently, so
        a label can never end up floating somewhere other than where its
        own line actually runs. Registers whatever lanes it claims so later
        calls route around it. row_gap/max_card_h/n_lanes should be the
        SOURCE node's own (local) values — see class docstring. n_lanes
        defaults to self.n_lanes (the diagram-wide fallback) when the
        caller has no better per-node value — see layout_process.py's
        local_lane_count, which sizes row_gap itself to match whatever
        n_lanes is passed here, so the two always agree for a given source
        node."""
        n_lanes = self.n_lanes if n_lanes is None else n_lanes
        x_lo, x_hi = (x1, x2) if x1 <= x2 else (x2, x1)
        if abs(y1 - y2) < 1:
            self._claim_v(x1, y1, y1)
            self._claim_v(x2, y2, y2)
            return f"M {x1} {y1} L {x2} {y2}", y1, x_lo, x_hi

        going_down = y2 > y1
        source_row = self._row_index(y1, row_gap)
        gap_idx = source_row if going_down else source_row - 1

        jog_y = None
        for lane in range(n_lanes):
            candidate = self._gap_lane_y(gap_idx, lane, row_gap, max_card_h) if going_down else \
                (self._gap_lane_y(gap_idx, n_lanes - 1 - lane, row_gap, max_card_h))
            if self._h_free(candidate, x_lo, x_hi) and self._clear_of_cards(candidate, x_lo, x_hi):
                jog_y = candidate
                break
        if jog_y is None:
            for lane in range(self.bottom_lanes):
                candidate = self.total_h - MIN_CLEARANCE + 16 - lane * LANE_PITCH
                if self._h_free(candidate, x_lo, x_hi) and self._clear_of_cards(candidate, x_lo, x_hi):
                    jog_y = candidate
                    break
        if jog_y is None:
            # Every one of the reserved bottom_lanes slots was already
            # taken by an x-overlapping edge — a single FIXED fallback
            # here (this used to just return one hardcoded y) means every
            # edge past that point collapses onto the exact same line
            # regardless of its own x-range, however many of them there
            # are (confirmed on Bill Formatter: 8 entirely unrelated
            # connectors, several with real x-overlap between each other,
            # all landed on one shared y). Keep extending past
            # bottom_lanes, one LANE_PITCH at a time, re-running the same
            # clearance checks — this is the last-resort channel, so
            # there's no fixed cap on how far it can grow; layout_process
            # reserves generous headroom below the diagram's own content
            # for exactly this.
            lane = self.bottom_lanes
            while True:
                candidate = self.total_h - MIN_CLEARANCE + 16 - lane * LANE_PITCH
                if self._h_free(candidate, x_lo, x_hi) and self._clear_of_cards(candidate, x_lo, x_hi):
                    jog_y = candidate
                    break
                lane += 1

        self.placed_h.append((jog_y, x_lo, x_hi))
        self._claim_v(x1, min(y1, jog_y), max(y1, jog_y))
        self._claim_v(x2, min(y2, jog_y), max(y2, jog_y))
        return f"M {x1} {y1} L {x1} {jog_y} L {x2} {jog_y} L {x2} {y2}", jog_y, x_lo, x_hi

    def route_under(self, x1, y1, x2, y2, min_jog_y, n_lanes=None):
        """Same-row bottom-to-bottom connector (see connectors_svg()'s own
        same_row case): y1 and y2 are usually numerically EQUAL (both
        endpoints are "this row's own bottom edge"), which would hit
        route()'s trivial same-y shortcut — a dead-straight line with NO
        lane search, and so no _clear_of_cards() check at all. That's fine
        for two ADJACENT nodes but not in general: a third node's card can
        sit x-between the source and target at that exact height, and the
        straight line would run right through its text uncontested. This
        forces a below-row lane search like route()'s own going_down case,
        just with both ends anchored to their own bottom edge instead of
        one exiting bottom/entering top.

        Unlike route(), the starting depth isn't derived from the tier's
        own row_gap/max_card_h (those size the gap to the NEXT full tier,
        which is usually far more clearance than two SIBLINGS in the same
        row need just to duck under their own two cards) — the caller
        passes min_jog_y directly, typically just past the deeper of the
        two participating cards' own real bottoms. Lanes still step by
        LANE_PITCH from there so multiple same-row connectors don't
        collide with each other."""
        n_lanes = self.n_lanes if n_lanes is None else n_lanes
        x_lo, x_hi = (x1, x2) if x1 <= x2 else (x2, x1)

        jog_y = None
        for lane in range(n_lanes):
            candidate = min_jog_y + lane * LANE_PITCH
            if self._h_free(candidate, x_lo, x_hi) and self._clear_of_cards(candidate, x_lo, x_hi):
                jog_y = candidate
                break
        if jog_y is None:
            for lane in range(self.bottom_lanes):
                candidate = self.total_h - MIN_CLEARANCE + 16 - lane * LANE_PITCH
                if self._h_free(candidate, x_lo, x_hi) and self._clear_of_cards(candidate, x_lo, x_hi):
                    jog_y = candidate
                    break
        if jog_y is None:
            jog_y = min_jog_y + n_lanes * LANE_PITCH

        self.placed_h.append((jog_y, x_lo, x_hi))
        self._claim_v(x1, min(y1, jog_y), max(y1, jog_y))
        self._claim_v(x2, min(y2, jog_y), max(y2, jog_y))
        return f"M {x1} {y1} L {x1} {jog_y} L {x2} {jog_y} L {x2} {y2}", jog_y, x_lo, x_hi

    def _claim_v(self, x, y_lo, y_hi):
        self.placed_v.append((x, y_lo, y_hi))


SPINE_Y_FALLBACK = 215   # must equal layout_process.py's own SPINE_Y — see _LaneRouter._row_index()


def connectors_svg(flows, nodes_by_id, total_h, row_gap, max_card_h,
                    n_lanes=2, bottom_lanes=6, card_boxes=None, card_bottom_by_id=None):
    """Returns SVG for every flow that needs an EXPLICIT drawn connector —
    a plain consecutive spine hop (st(to)==st(from)+1, happy, unlabelled)
    is already covered by the single continuous spine line and is skipped
    here, matching the reference's own construction (it never draws a
    separate line for those either).

    row_gap/max_card_h here are only the diagram-wide FALLBACK (used if a
    node somehow lacks its own — see layout_process.py's out_nodes[id]
    "rowGap"/"maxCardH"). Each edge instead routes using its own SOURCE
    node's local values, so a branch near short cards stays compact even
    when some other node far away in the diagram has a much longer one.

    card_boxes — every node's real (x0, x1, y0, y1) card footprint — lets
    the router refuse a candidate lane that would cut through UNRELATED
    card content it happens to pass over on its way across the diagram
    (see _LaneRouter._clear_of_cards())."""
    out = []
    router = _LaneRouter(total_h, n_lanes, bottom_lanes, card_boxes)
    card_bottom_by_id = card_bottom_by_id or {}
    # A rotated branch label's position (lx, ly) depends only on the SOURCE
    # node's x and this one edge's own y-span. Two distinct failure modes
    # land labels at the same (lx, ly):
    #   1. A node with 3+ off-spine branches whose targets land at similar
    #      depths (several exception/retry outcomes off one decision) —
    #      several labels from the SAME source, at the same point (found on
    #      Mobile Postpaid Activation: "Draft available for resume" /
    #      "Supervisor reassigns draft" / "Retention period elapses", all
    #      from node jsm05, all at (2049, 408)).
    #   2. A forward edge and its own backward/loop-back edge between the
    #      SAME two nodes (e.g. ecc05 -> ecc06 "Exceeds threshold" and
    #      ecc06 -> ecc05 "Re-check after settlement") — lx is identical
    #      (both derived from the same shared x, since the two nodes sit in
    #      the same column) and ly is identical too (the midpoint between
    #      two fixed y's is the same regardless of which end is "from"),
    #      so the two labels render fully stacked on top of each other,
    #      illegible. This is a DIFFERENT source per edge, so tracking
    #      collisions per-source (an earlier version of this code did,
    #      reasoning that "two labels from unrelated sources landing near
    #      the same point isn't the failure mode this guards against") misses
    #      it entirely — confirmed on Mobile Postpaid Activation's ecc05/
    #      ecc06 pair. Tracking by actual (lx, ly) proximity instead of by
    #      source id catches both cases uniformly.
    placed_labels = []   # every (lx, ly, text) placed so far, regardless of source
    LABEL_CHAR_PX = 7.0      # ~character width for the 11px bold branch-label font — used both to size how
                              # much vertical room a label's own printed (rotated) length actually needs, and
                              # (below) to size how far apart two labels' CENTRES must be: text-anchor="middle"
                              # means a label extends its own half-length on EITHER side of (lx, ly), so a flat
                              # collision margin (this code's own earlier version used 30px regardless of text
                              # length) still lets two long labels' printed extents overlap even when their
                              # centres are placed hundreds of px apart — confirmed on Trouble Ticket
                              # Lifecycle's "Automated Port-Out resolution feeds closure" (44 chars) and
                              # "Automation failure escalated to back-office, then feedback on eventual
                              # Resolved" (82 chars), whose centres were 341px apart yet still visibly crossed.
    LABEL_MIN_COLLIDE_PX = 30   # floor under the length-aware threshold below, for two very short labels
    LABEL_X_TOLERANCE = 12   # lx is (some node's x) - (that node's own r) -
                             # MIN_CLEARANCE — two labels anchored to the
                             # same column can still differ by up to ~9px
                             # (the biggest r spread between categories,
                             # e.g. R_END_OUTER(21) vs R_RECOVERY(12)) even
                             # though they share the same physical x, so
                             # the tolerance has to clear that; a
                             # genuinely different column sits STEP (400px)
                             # or more away, nowhere near this either way
    LABEL_FAN_PX = LANE_PITCH   # 44px stagger per colliding label — the
                                 # same MIN_CLEARANCE(40)-plus-a-few-px pitch
                                 # every other spacing decision in this file
                                 # already uses (see _LaneRouter above)

    # A label's baseline position needs to clear TWO things it previously
    # ignored: its own SOURCE shape (a flat "x - 11" sits inside any shape
    # whose radius exceeds 11 — true for every category except the very
    # smallest — confirmed on Mobile MACD Journey 1's decision node, where
    # branch labels rendered directly through the diamond itself) and the
    # PRECEDING spine node's card-text reserve (STEP - CARD_TEXT_OFFSET -
    # CARD_AVAIL_W leaves only 44px between one card's right edge and the
    # next node's own x — not enough room once a label is also pulled
    # MIN_CLEARANCE past its own source shape; confirmed on the same
    # node's 4 branch labels running straight through the PRECEDING
    # "MACD Journey Triggered" card's paragraph text). Horizontal fanning
    # alone (the label-vs-label fix above) has no awareness of either.
    # Checked against EVERY node's card interval, not just whichever one
    # sits nearest to the left — "nearest left" missed a case on Trouble
    # Ticket Lifecycle where an off-spine node's label, once pushed right
    # to clear a genuinely-preceding card, landed inside a DIFFERENT
    # node's card (an on-spine sibling only ~50px away in x, close enough
    # for its own reserve to still catch the pushed position, despite not
    # being the nearest-left neighbour by the strict definition). Pushing
    # past every interval it currently falls inside, and repeating (since
    # escaping one card can land inside the next one over), is what
    # actually guarantees clearance rather than just handling the most
    # common single-neighbour case. Confirmed necessary for off-spine
    # sources too, not just on-spine ones — this same diagram's
    # "Automatic Resolution for Port-Out Verification" (off-spine) ran
    # its own branch labels straight through the on-spine
    # "Validate Credentials" card, which an on-spine-only check (an
    # earlier version of this fix) never even considered.
    card_intervals = sorted(
        (n["x"] + CARD_TEXT_OFFSET, n["x"] + CARD_TEXT_OFFSET + n.get("availW", CARD_AVAIL_W))
        for n in nodes_by_id.values()
    )

    def _clear_of_every_card(x):
        for _ in range(len(card_intervals) + 1):   # bounded: x only ever moves right, past a finite set
            moved = False
            for lo, hi in card_intervals:
                if lo <= x <= hi:
                    x = hi + MIN_CLEARANCE
                    moved = True
            if not moved:
                return x
        return x

    # Same principle as _clear_of_every_card, for shapes instead of card
    # text: checking only the label's OWN source shape (an earlier version
    # of this fix) missed cases where a label ends up passing near a
    # DIFFERENT nearby node's shape — confirmed on Mobile MACD Journey 1
    # ("New plan/add-on exceeds credit limit") and Mobile Postpaid
    # Activation ("Supervisor reassigns draft"), both landing on some
    # other node's circle, not their own source's.
    node_shapes = [(n["x"], n["y"], n["r"]) for n in nodes_by_id.values()]

    def _clear_of_every_shape(x, y, half_len):
        for _ in range(len(node_shapes) + 1):   # bounded: y only ever moves down, past a finite set
            moved = False
            for cx, cy, r in node_shapes:
                if cx - r <= x <= cx + r:
                    shape_top, shape_bottom = cy - r, cy + r
                    if y - half_len <= shape_bottom and y + half_len >= shape_top:
                        y = shape_bottom + MIN_CLEARANCE + half_len
                        moved = True
            if not moved:
                return y
        return y

    card_right_edges = sorted(hi for _lo, hi in card_intervals)

    def _room_to_fan_left(x):
        # how far x could move left before reaching the nearest card
        # already behind (to the left of) it — bounds how many horizontal
        # fan lanes are actually usable before a collision has to stack
        # vertically instead.
        i = bisect.bisect_right(card_right_edges, x) - 1
        return (x - card_right_edges[i] - MIN_CLEARANCE) if i >= 0 else float("inf")

    vert_cursor_by_x = {}   # rounded x -> lowest y-edge used so far by a label stacked at that x (see below)

    def _label_len(txt):
        return text_width(txt, LABEL_CHAR_PX)

    # Downward-direction edges are processed before upward ones, regardless
    # of their original declaration order. A downward edge always claims
    # its dead-centre exit/entry column outright; an upward edge checks
    # that column first and dodges to a left-vertex entry if it's already
    # claimed (see the left_vertex_exit branch below) — but that check
    # only works if the downward claim was already made. Sorting by
    # direction (Python's sort is stable, so relative order within each
    # direction is unchanged) guarantees it always is, instead of only
    # working when the model happens to declare the downward edge first.
    def _flow_dir_key(f):
        a, b = nodes_by_id.get(f.get("from")), nodes_by_id.get(f.get("to"))
        return 1 if a and b and b["y"] < a["y"] else 0

    # 2+ routed edges sharing one source, both dead-centre exiting
    # downward (same_row/left_vertex_exit edges use a different exit
    # point, so they're never part of this), share that source's exit
    # column for at least their FIRST segment — a branch-group trunk,
    # same as the reference's own fan-out style. Each one still needs its
    # OWN direction readable at that shared segment, not just at its own
    # unique end far downstream, so any edge counted here gets an extra
    # marker-mid arrow at the corner where its own unique jog begins.
    # dead_center_down_users additionally tracks a node's dead-centre
    # column from the ENTRY side too — a node can be the target of a
    # down-direction edge that ISN'T its own trunk at all (e.g. some
    # other, earlier node skipping several steps ahead into it), which
    # still occupies its dead-centre column exactly the same way a real
    # trunk would (confirmed: Bill Formatter's "end_delivered" sources no
    # trunk of its own — it's a terminal node — but IS the target of a
    # long skip-ahead edge dead-centring the same column an unrelated
    # up-going loop-back also needed to enter through).
    trunk_share_count = collections.Counter()
    dead_center_down_users = collections.Counter()
    dodge_count = collections.Counter()   # how many up-edges have already dodged INTO a given target
    for f in flows:
        a, b = nodes_by_id.get(f.get("from")), nodes_by_id.get(f.get("to"))
        if not a or not b or is_trivial_spine_hop(f, a, b) or is_happy_branch_label(f, a, b):
            continue
        going_down = b["y"] >= a["y"]
        same_row = not a["onSpine"] and not b["onSpine"] and a["y"] == b["y"]
        if going_down and not same_row:
            trunk_share_count[f["from"]] += 1
            dead_center_down_users[f["from"]] += 1
            dead_center_down_users[f["to"]] += 1

    for f in sorted(flows, key=_flow_dir_key):
        from_id, to_id = f.get("from"), f.get("to")
        a, b = nodes_by_id.get(from_id), nodes_by_id.get(to_id)
        if not a or not b:
            continue
        if is_trivial_spine_hop(f, a, b):
            continue

        # Every explicit connector's drawn elements (path and/or label) are
        # wrapped in one <g data-from data-to> so the selection/highlight
        # feature (see engine_template.html) can find and dim/emphasise a
        # whole edge — line, arrowhead, and label together — by a single
        # DOM query, without needing per-element ids of its own.
        edge_open = f'<g class="pf-edge" data-from="{esc(from_id)}" data-to="{esc(to_id)}">'

        if is_happy_branch_label(f, a, b):
            # Left-aligned at the SAME x as the source node's own card title
            # (node_card_svg's tx = x + CARD_TEXT_OFFSET) — not offset by
            # the node's own radius/MIN_CLEARANCE, which varies per node
            # category (R_DECISION=18 vs R_PRIMARY=14, etc.) and drifted the
            # label out of alignment with the title sitting directly below
            # it. Sharing the exact same offset keeps the two vertically
            # aligned regardless of the source node's shape.
            lx = a["x"] + CARD_TEXT_OFFSET
            out.append(edge_open +
                       f'<text x="{lx}" y="{a["y"] - LABEL_GAP}" font-size="11" font-weight="700" fill="{GREEN}" '
                       f'text-anchor="start">{esc(f["label"])}</text></g>')
            continue

        color = edge_color(f, b)
        marker = ARROW_MARKERS[color]
        dash = ' stroke-dasharray="6 5"' if color == BLUE else ""
        going_down = b["y"] >= a["y"]
        same_row = not a["onSpine"] and not b["onSpine"] and a["y"] == b["y"]
        left_vertex_exit = not same_row and not going_down and not a["onSpine"]
        if same_row:
            # Off-spine siblings sitting in the exact same row — the usual
            # top/bottom convention would force an awkward loop up and OVER
            # both cards to enter the target from above. Looping under
            # instead (exit the source's bottom, enter the target's bottom)
            # is the direct, natural path when both ends are already at the
            # same height.
            x1, y1 = a["x"], a["y"] + a["r"]
            y2 = b["y"] + b["r"]
        elif going_down or a["onSpine"]:
            x1 = a["x"]
            y1 = a["y"] + (a["r"] if going_down else -a["r"])
            y2 = b["y"] + (-b["r"] if going_down else b["r"])
        else:
            # Off-spine source, upward edge (a loop-back to the spine or an
            # earlier row) — exits from the LEFT vertex rather than the top.
            # Matches the reference artefact's own mechanism for keeping a
            # loop-back visually distinct from anything else that also
            # touches this node's top point (another incoming edge, or this
            # same node's own downward continuation) — the reference's
            # actual fix for the collision an earlier bottom-entry detour
            # was built to work around.
            x1, y1 = a["x"] - a["r"], a["y"]
            y2 = b["y"] + (-b["r"] if going_down else b["r"])
        if same_row:
            # The minimum depth this jog needs is the deeper of the two
            # participating cards' own REAL bottom (not the tier's
            # aggregate maxCardH/rowGap, which sizes clearance to the NEXT
            # full tier and massively overshoots what two siblings in the
            # SAME row need to duck under just their own two cards).
            min_jog_y = max(card_bottom_by_id.get(from_id, y1), card_bottom_by_id.get(to_id, y2)) + MIN_CLEARANCE
            d, jog_y, jog_x_lo, jog_x_hi = router.route_under(x1, y1, b["x"], y2, min_jog_y, a.get("laneCount"))
        elif left_vertex_exit:
            # A connector must always leave its source moving HORIZONTALLY
            # first, never vertically, regardless of where it goes after
            # that — router.route() itself always starts with a vertical
            # climb from (x1, y1), so route from a point further left
            # instead and prepend the true origin's own horizontal lead-in
            # segment onto the front of whatever path it returns. The
            # origin-point circle (below) still marks the TRUE exit point
            # (the shape's own left vertex), not this further-left routing
            # anchor.
            #
            # This lead-in only needs to be SHORT enough to read as "moving
            # sideways first," not a full MIN_CLEARANCE(40) clear of every
            # other card — siblings on the fixed 400px grid can sit as
            # close as ~30-70px apart card-edge-to-card-edge, tighter than
            # MIN_CLEARANCE allows, so demanding full clearance here has
            # no solution at all in the tightest cases (confirmed on
            # Mobile Postpaid Activation's jsm06 -> jsm05: jsm08's own
            # card sits only 32px behind jsm06's left vertex — searching
            # for a fully-clear step just walks past every sibling on the
            # row and out the far side of the diagram). CARD_ELEMENT_GAP
            # is small enough to stay inside gaps that tight while still
            # being a real, visible horizontal step before the vertical
            # climb takes over.
            route_x1 = x1 - CARD_ELEMENT_GAP
            target_x2 = b["x"]
            true_vertex_x2, true_vertex_y2 = b["x"] - b["r"], b["y"]
            lead_out = ""

            def _dodge_x2():
                # Prefer a full LANE_PITCH of separation from the true
                # vertex (clearly a separate route, not just barely off
                # the shared column) — but an on-spine target's PRECEDING
                # neighbour can sit close enough that this lead-out
                # segment would clip straight through its card instead
                # (confirmed on Mobile MACD Activation Prepaid:
                # save_milestone_1's own preceding spine neighbour,
                # line_count_check, sits close enough that a 60px lead-out
                # ran directly through its card). Fall back to
                # CARD_ELEMENT_GAP — the same minimum already accepted as
                # safe-enough for the exit-side lead-in — if the wider
                # gap isn't actually clear.
                for offset in (LANE_PITCH, CARD_ELEMENT_GAP):
                    lo, hi = true_vertex_x2 - offset, true_vertex_x2
                    if router._clear_of_cards(true_vertex_y2, lo, hi):
                        return true_vertex_x2 - offset
                return true_vertex_x2 - CARD_ELEMENT_GAP
            # Only dodge when the TARGET node's own dead-centre column is
            # ALSO used by at least one down-direction edge — either one
            # it sources itself (a trunk) or one that terminates at it
            # from elsewhere (dead_center_down_users counts both) — i.e.
            # an actual opposite-direction conflict meeting at that SAME
            # node, never merely "some other, unrelated node's own column
            # happens to sit at the same raw x" by coincidence of the
            # 400px grid (confirmed: kyc01 has exactly one routed
            # connector of its own and must enter dead-centre; checking
            # raw geometric column occupancy instead of node identity
            # wrongly dodged kyc03_rescan -> kyc01 just because kyc01's x
            # happened to match jsm08's own dead-centre column — a
            # totally different, unrelated node). The entry side matters
            # too, not just the source side (confirmed on Bill Formatter's
            # "end_delivered": a terminal node with no trunk of its own,
            # but the TARGET of a long skip-ahead edge from elsewhere that
            # dead-centres the exact same column an unrelated up-going
            # loop-back also needed). >= 1, not >= 2 — a single
            # down-direction user of the column is already enough to
            # collide with this up-going one (confirmed on Mobile MACD
            # Activation Prepaid's save_milestone_1, sourcing only ONE
            # down-going child yet still colliding). The >= 2 threshold on
            # trunk_share_count stays reserved for the mid-path arrows
            # below — a different question (is this a visually shared
            # trunk worth calling out) from whether a dodge is required.
            # Also dodge when the target itself needs no dodge of its own
            # but this edge's OWN source coincidentally sits at the exact
            # same x as the target (common on the fixed grid) AND that
            # source column is already a down-direction user — the
            # eventual rejoin to the target's dead centre would then
            # still pass back through the source's own conflicted column
            # (confirmed on Mobile MACD Plan Change: lockin_penalty_payment
            # is both the target of an incoming down-edge and the source
            # of this up-edge; upgrade_downgrade_check needs no dodge of
            # its own, but shares lockin_penalty_payment's x exactly, so
            # rejoining dead-centre there still crossed back through it).
            if (dead_center_down_users.get(to_id, 0) >= 1
                    or (a["x"] == b["x"] and dead_center_down_users.get(from_id, 0) >= 1)):
                dodge_n = dodge_count[to_id]
                dodge_count[to_id] += 1
                if dodge_n:
                    # A second (or later) up-edge dodging into the SAME
                    # target would otherwise converge on the exact same
                    # (true_vertex_x2, true_vertex_y2) point as the
                    # first one — recreating the same kind of overlap
                    # this whole mechanism exists to avoid, just between
                    # two dodges instead of a dodge and a trunk
                    # (confirmed on Fibre: ins_detect -> cvc_checkout and
                    # ins_trigger -> cvc_checkout both dodged to the
                    # identical point). Stagger each additional one along
                    # the target's own left edge instead of every dodge
                    # landing on its single geometric vertex.
                    true_vertex_y2 += dodge_n * CARD_ELEMENT_GAP
                target_x2, y2 = _dodge_x2(), true_vertex_y2
            d, jog_y, jog_x_lo, jog_x_hi = router.route(route_x1, y1, target_x2, y2, a.get("rowGap", row_gap),
                                                         a.get("maxCardH", max_card_h), a.get("laneCount"))
            if target_x2 != b["x"]:
                lead_out = f" L {true_vertex_x2} {true_vertex_y2}"
            d = f"M {x1} {y1} L " + d[2:] + lead_out   # prepend the true origin's own horizontal
                                             # lead-in; d[2:] strips router.route()'s own leading "M "
                                             # so its first point (route_x1, y1) becomes this segment's
                                             # endpoint; lead_out (if any) appends the final cut-in to
                                             # the target's true vertex
        else:
            d, jog_y, jog_x_lo, jog_x_hi = router.route(x1, y1, b["x"], y2, a.get("rowGap", row_gap),
                                                         a.get("maxCardH", max_card_h), a.get("laneCount"))
        out.append(edge_open)
        # Invisible fat hit-path UNDER the real 2.2px-wide line — SVG's
        # click/pointer target for a fill:none path is the STROKE only, so
        # without this the actual clickable area for the click-to-select
        # feature (see engine_template.html) would be a couple of screen
        # pixels wide at typical zoom, unreasonably fiddly to hit. Purely
        # a hit-target: never painted, never exported (opacity:0 survives
        # SVG export, unlike a CSS-only rule the exported file has no
        # stylesheet for).
        out.append(f'<path d="{d}" fill="none" stroke="#000" stroke-width="14" opacity="0"/>')
        # A branch-group trunk (2+ edges sharing one source's exit column
        # — see trunk_share_count above) puts a second, smaller copy of
        # this edge's own arrowhead at every intermediate corner too, not
        # just the final destination — so this specific connector's
        # direction stays legible even where its path overlaps a sibling
        # branch's, instead of only being distinguishable once they've
        # already diverged onto their own unique jog.
        mid_marker = f' marker-mid="url(#{marker})"' if trunk_share_count.get(from_id, 0) >= 2 else ""
        out.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="2.2"{dash}{mid_marker} '
                   f'marker-end="url(#{marker})"/>')
        if dash:
            # A small filled circle at the connector's own ORIGIN point —
            # every dashed (data-flow / loop-back) connector in the
            # reference artefact marks its start this way, never just an
            # arrowhead at the target end alone. Solid connectors don't
            # get one (confirmed: none of the reference's non-dashed
            # elbow paths have a matching circle, only the dashed ones).
            out.append(f'<circle cx="{x1}" cy="{y1}" r="4.5" fill="{color}"/>')
        if f.get("label") and jog_x_lo != jog_x_hi:
            # This edge's path actually bends — a fan-out branch or a
            # loop-back's own jog toward its target. The reference artefact
            # always labels these HORIZONTALLY, centred on the exact x-span
            # the jog covers, riding just above the line itself (see
            # _LaneRouter.route()'s own docstring on jog_y/x_lo/x_hi) —
            # never a rotated label guessed independently of where the line
            # actually runs, which is how two branches from the same source
            # used to end up with indistinguishable stacked labels.
            lx, ly = (jog_x_lo + jog_x_hi) / 2, jog_y - LABEL_GAP
            placed_labels.append((lx, ly, f["label"]))
            out.append(f'<text x="{lx}" y="{ly}" font-size="11" font-weight="700" fill="{color}" '
                       f'text-anchor="middle">{esc(f["label"])}</text>')
        elif f.get("label"):
            base_lx, ly = a["x"] - ROTATED_LABEL_GAP, (y1 + y2) / 2
            this_len = _label_len(f["label"])
            lane = sum(1 for (px, py, ptxt) in placed_labels
                       if abs(px - base_lx) < LABEL_X_TOLERANCE
                       and abs(py - ly) < max(LABEL_MIN_COLLIDE_PX, this_len / 2 + _label_len(ptxt) / 2 + MIN_CLEARANCE))
            placed_labels.append((base_lx, ly, f["label"]))

            base_lx = _clear_of_every_card(base_lx)   # baseline itself may already be inside some card's reserve

            horiz_lanes = lane
            if lane:
                available = _room_to_fan_left(base_lx)
                horiz_lanes = lane if available == float("inf") else min(lane, max(0, int(available // LABEL_FAN_PX)))
            # Fanning further left can walk straight into a DIFFERENT
            # card that happens to sit further over — re-clear
            # unconditionally rather than trusting the room estimate alone.
            lx = _clear_of_every_card(base_lx - LABEL_FAN_PX * horiz_lanes)

            # Whatever x a label actually lands on, register/consult a
            # running vertical cursor for that exact x — not just when
            # THIS label ran out of horizontal room. Two different labels
            # can independently land on the same clamped x (whenever 2+
            # edges share a source that's already pinned against a card),
            # so the first label placed there has to seed the cursor too,
            # or a later one has nothing to check against and lands right
            # on top of it. The cursor tracks the
            # lowest EDGE used at that x (not a centre), so each consumer
            # adds its own half-length to find where its own centre needs
            # to land, then advances the edge by its other half — correct
            # regardless of how the current and next label's lengths
            # compare to each other.
            xkey = round(lx)
            if horiz_lanes < lane or xkey in vert_cursor_by_x:
                bottom_used = vert_cursor_by_x.get(xkey)
                if bottom_used is not None:
                    ly = max(ly, bottom_used + MIN_CLEARANCE + this_len / 2)

            # A card's clearance and the source shape's own clearance can
            # be mutually exclusive (the card demands lx stay right of
            # some x; the shape demands lx stay left of a smaller one) —
            # confirmed on Mobile MACD Journey 1's decision node, where the
            # only column with 40px of the preceding card's text clear
            # still sits inside the diamond's own x-span. When that
            # happens there's no x that clears both, so clear the shape
            # VERTICALLY instead: push ly below its bottom edge. This
            # never reintroduces the card collision the x-clamp already
            # solved — that one only depends on x, not y. Checked against
            # EVERY node's shape, not just this edge's own source — a
            # label can just as easily end up passing near some other
            # node's circle/diamond that happens to share its column. This
            # has to run LAST, after the vertical-cursor stacking above:
            # that step can itself push ly down into a shape neither step
            # had reason to check yet — confirmed on the same diagram's
            # "New plan/add-on exceeds credit limit", clear of every shape
            # at its own natural y, but landing squarely inside an
            # unrelated node's circle once the cursor pushed it down to
            # avoid a different label.
            ly = _clear_of_every_shape(lx, ly, this_len / 2)

            vert_cursor_by_x[xkey] = max(vert_cursor_by_x.get(xkey, ly), ly + this_len / 2)

            out.append(f'<text x="{lx}" y="{ly}" font-size="11" font-weight="700" fill="{color}" '
                       f'transform="rotate(-90 {lx} {ly})" text-anchor="middle">{esc(f["label"])}</text>')
        out.append('</g>')
    # The bottom-overflow channel's own last-resort search (see
    # _LaneRouter.route()) can push a jog below total_h when enough
    # x-overlapping edges exhaust every reserved lane — report the
    # deepest y actually used so the caller can grow the canvas to match,
    # instead of silently clipping content past the declared viewBox.
    max_jog_y = max((y for y, _, _ in router.placed_h), default=0)
    return "".join(out), max_jog_y


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

    sp = pf_layout["spine"]
    # Drawn as one <g data-from data-to> per consecutive spine hop, not one
    # continuous <line>, so the trivial (implicit, unlabelled) sequence
    # hops the selection feature needs to highlight (see
    # engine_template.html) have something to actually select — every
    # OTHER connector already draws its own line per edge; the spine was
    # the one exception. Purely a markup split: each segment still runs
    # exactly from one node's own radius edge to the next's, so the
    # visual result is identical to the single line it replaces (nodes
    # already sat ON TOP of that line's interior, never leaving a visible
    # gap at the join either way).
    spine_svgs = []
    spine_nodes = sorted((n for n in nodes_by_id.values() if n["onSpine"]), key=lambda n: n["st"])
    for i in range(len(spine_nodes) - 1):
        sa, sb = spine_nodes[i], spine_nodes[i + 1]
        x1, x2 = sa["x"] + sa["r"], sb["x"] - sb["r"]
        spine_svgs.append(f'<g class="pf-edge" data-from="{esc(sa["id"])}" data-to="{esc(sb["id"])}">'
                     # invisible fat hit-target — see connectors_svg()'s own comment on the same pattern
                     f'<line x1="{x1}" y1="{sp["y"]}" x2="{x2}" y2="{sp["y"]}" stroke="#000" stroke-width="14" opacity="0"/>'
                     f'<line x1="{x1}" y1="{sp["y"]}" x2="{x2}" y2="{sp["y"]}" '
                     f'stroke="{NAVY}" stroke-width="2.4"/></g>')

    node_svgs = []
    search_index = []
    card_bottom_by_id = {}
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
        card_bottom_by_id[nid] = _bottom
    # Every node's own real card footprint (x0..x1 by its own avail width,
    # y0..y1 down to the exact bottom node_card_svg() itself just
    # returned) — passed to connectors_svg() so a routed connector's
    # horizontal jog can be checked against actual card content, not just
    # against other jogs (see _LaneRouter._clear_of_cards()'s own
    # docstring for why that distinction matters).
    card_boxes = [
        (n["x"] + CARD_TEXT_OFFSET, n["x"] + CARD_TEXT_OFFSET + n.get("availW", CARD_AVAIL_W),
         n["y"], card_bottom_by_id[nid])
        for nid, n in nodes_by_id.items()
    ]
    # row_gap/max_card_h come straight from layout_process.py's own
    # computation (see compute_process_layout()'s "rowGap"/"maxCardH") —
    # the SAME values that sized every row-to-row gap, so the lane
    # allocator's "safe zone" math agrees exactly with what the layout
    # actually reserved. connectors_svg() is called BEFORE the background
    # rect/phase bands are built (even though it paints on top of them)
    # because its own last-resort bottom-overflow search can need MORE
    # vertical room than total_h originally reserved — the background and
    # bands have to know the FINAL height, which isn't known until
    # routing has actually happened (see _LaneRouter.route()'s own
    # comment on that search).
    connectors_body, max_jog_y = connectors_svg(blob.get("flows", []), nodes_by_id, total_h,
                                                 pf_layout["rowGap"], pf_layout["maxCardH"], card_boxes=card_boxes,
                                                 card_bottom_by_id=card_bottom_by_id)
    if max_jog_y + MIN_CLEARANCE > total_h:
        total_h = max_jog_y + MIN_CLEARANCE
        pf_layout["totalH"] = total_h   # render.py reads this directly for __TOTAL_H__

    parts = [DEFS, f'<rect width="{total_w}" height="{total_h}" fill="#ffffff"/>',
             phase_bands_svg(pf_layout["phaseBands"], total_h)]
    parts.extend(spine_svgs)
    parts.append("".join(node_svgs))
    parts.append(connectors_body)
    parts.append('<g id="hl"></g>')  # search-highlight rings are appended here at runtime (see engine_template.html)
    parts.append('<g id="selhl"></g>')  # click-to-select ring around the selected node — see engine_template.html

    svg_body = "".join(parts)
    phases_js = [{"n": b["name"], "x": b["x0"]} for b in pf_layout["phaseBands"]]
    return svg_body, search_index, phases_js
