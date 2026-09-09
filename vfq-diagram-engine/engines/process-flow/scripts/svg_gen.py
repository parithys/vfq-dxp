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
CODE_GREY = "#8A8A9B"

TAG_FILL_ACTOR = "#E4EBF6"
TAG_TEXT_ACTOR = "#2F4A6B"
TAG_FILL_SYS = "#E7E8F5"
TAG_TEXT_SYS = "#3A3E7A"

ARROW_MARKERS = {RED: "ahr", AMBER: "aha", VIOLET: "ahv", GREEN: "ahg", BLUE: "ahb"}


def esc(s):
    return _html_mod.escape(str(s or ""), quote=True)


# ----------------------------------------------------------------- text measurement (no canvas server-side — same
# estimate-then-wrap approach bpmn-swimlane/scripts/build_model.py already uses elsewhere in this codebase)
def wrap_lines(text, avg_char_px, max_width, max_lines):
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
            if len(lines) == max_lines:
                cur = ""
                break
    if cur:
        lines.append(cur)
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
def _first_sentence(desc):
    desc = re.sub(r"\s+", " ", str(desc or "")).strip()
    m = re.match(r"^\d+[\.\)]\s*", desc)  # a numbered-requirement desc ("1. The system shall…")
    if m:
        desc = desc[m.end():]
    m = re.search(r"[.;](?:\s|$)", desc)
    return desc[:m.start()].strip() if m else desc


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


def node_card_svg(n, node_data, lane_name):
    x, y = n["x"], n["y"]
    color = _shape_color(n)
    tx = x + CARD_TEXT_OFFSET
    label = node_data.get("label") or n["id"]
    sub = node_data.get("sub")
    desc_line = _first_sentence(node_data.get("desc"))

    parts = []
    cursor = y + 34
    parts.append(f'<text x="{tx}" y="{cursor}" font-size="{TITLE_FONT_PX}" font-weight="700" '
                 f'fill="{INK if n["onSpine"] or n["category"] != "recovery" else INK}">{esc(label)}</text>')
    if sub:
        cursor += 26
        parts.append(f'<text x="{tx}" y="{cursor}" font-size="{CODE_FONT_PX}" font-weight="700" '
                     f'fill="{CODE_GREY}" letter-spacing="0.6">{esc(str(sub).upper())}</text>')
        cursor += 24
    else:
        cursor += 26
    desc_lines = wrap_lines(desc_line, DESC_AVG_CHAR, CARD_AVAIL_W, 2)
    for i, dl in enumerate(desc_lines):
        parts.append(f'<text x="{tx}" y="{cursor}" font-size="{DESC_FONT_PX}" fill="{MUTE}">{esc(dl)}</text>')
        cursor += 18 if i == 0 else 21

    tag_row_y = cursor + (0 if desc_lines else -3)
    if lane_name:
        w = int(text_width(lane_name.upper(), TAG_AVG_CHAR)) + 20
        parts.append(f'<rect x="{tx}" y="{tag_row_y}" width="{w}" height="20" rx="5" fill="{TAG_FILL_ACTOR}"/>')
        parts.append(f'<text x="{tx + 10}" y="{tag_row_y + 14}" font-size="{TAG_FONT_PX}" font-weight="700" '
                     f'fill="{TAG_TEXT_ACTOR}" letter-spacing="0.9">{esc(lane_name.upper())}</text>')
        tag_row_y += 26

    # System tags flow left-to-right on one row (matching the reference's own
    # Qnomy/CTI/Email layout), wrapping to a new row only once a row's
    # accumulated width would exceed CARD_AVAIL_W — not one tag per row.
    sys_tag_x, sys_tag_y = tx, tag_row_y
    row_started = False
    for tag in system_tags(node_data):
        w = int(text_width(tag, TAG_AVG_CHAR)) + 22
        if row_started and (sys_tag_x - tx + w) > CARD_AVAIL_W:
            sys_tag_x = tx
            sys_tag_y += 24
        parts.append(f'<rect x="{sys_tag_x}" y="{sys_tag_y}" width="{w}" height="19" rx="4" '
                     f'fill="{TAG_FILL_SYS}" stroke="#B9C2D4"/>')
        parts.append(f'<circle cx="{sys_tag_x + 9}" cy="{sys_tag_y + 9.5}" r="2.6" fill="{TAG_TEXT_SYS}"/>')
        parts.append(f'<text x="{sys_tag_x + 17}" y="{sys_tag_y + 14}" font-size="9.5" font-weight="700" '
                     f'fill="{TAG_TEXT_SYS}" letter-spacing="0.5">{esc(tag)}</text>')
        sys_tag_x += w + 8
        row_started = True
    if row_started:
        tag_row_y = sys_tag_y + 24

    shape_svg, number = node_shape_svg(n)
    parts.insert(0, shape_svg)
    if number:
        num_color = "#fff" if n["category"] not in ("decision",) else color
        parts.insert(1, f'<text x="{x}" y="{y + 3.6}" font-size="10.5" font-weight="700" '
                        f'fill="{num_color}" text-anchor="middle">{number}</text>')
    return "".join(parts), tag_row_y


# ----------------------------------------------------------------- connectors
# A connector whose two endpoints are many columns apart (a long-distance
# branch — e.g. a data-flow edge from an early spine node to a late
# off-spine one) can't use a simple interpolated-midpoint elbow: for a
# large x AND y gap, the horizontal jog invariably lands at some y that
# cuts straight through OTHER, unrelated nodes' card text sitting between
# the two endpoints — found on Fibre & Fixed Wireless Access, where a
# ~11,600px-wide horizontal jog sliced through several intermediate cards.
# Past LONG_SPAN_X, route the horizontal jog through a reserved channel
# below every node's content instead (the same "reserved bus" idea
# build_model.py's own compute_layout() uses for bpmn-swimlane's backward
# loops) — longer path, but guaranteed clear of card content regardless of
# how far apart the two endpoints are.
LONG_SPAN_X = 2400


def _elbow_path(x1, y1, x2, y2, total_h=None):
    if abs(x1 - x2) < 1:
        return f"M {x1} {y1} L {x2} {y2}"
    if total_h is not None and abs(x1 - x2) > LONG_SPAN_X:
        channel_y = total_h - 24
        return f"M {x1} {y1} L {x1} {channel_y} L {x2} {channel_y} L {x2} {y2}"
    mid_y = y1 + (y2 - y1) * 0.55
    return f"M {x1} {y1} L {x1} {mid_y} L {x2} {mid_y} L {x2} {y2}"


def edge_color(flow, target_node):
    if target_node["category"] == "error":
        return RED
    if target_node["category"] == "escalation":
        return VIOLET
    if flow.get("kind") == "data":
        return BLUE
    return AMBER


def connectors_svg(flows, nodes_by_id, total_h):
    """Returns SVG for every flow that needs an EXPLICIT drawn connector —
    a plain consecutive spine hop (st(to)==st(from)+1, happy, unlabelled)
    is already covered by the single continuous spine line and is skipped
    here, matching the reference's own construction (it never draws a
    separate line for those either)."""
    out = []
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
            mx = (a["x"] + a["r"] + b["x"] - b["r"]) / 2
            out.append(f'<text x="{mx}" y="{a["y"] - 11}" font-size="11" font-weight="700" fill="{GREEN}" '
                       f'text-anchor="middle">{esc(f["label"])}</text>')
            continue

        color = edge_color(f, b)
        marker = ARROW_MARKERS[color]
        dash = ' stroke-dasharray="6 5"' if color == BLUE else ""
        y1 = a["y"] + (a["r"] if b["y"] >= a["y"] else -a["r"])
        y2 = b["y"] + (-b["r"] if b["y"] >= a["y"] else b["r"])
        d = _elbow_path(a["x"], y1, b["x"], y2, total_h)
        out.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="2.2"{dash} '
                   f'marker-end="url(#{marker})"/>')
        if f.get("label"):
            lx, ly = a["x"] - 11, (y1 + y2) / 2
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
        card_svg, _ = node_card_svg(n, nd, lane_name)
        node_svgs.append(card_svg)
        search_text = " ".join(str(x) for x in [
            n.get("st") or "", nd.get("label"), nd.get("sub"), nd.get("desc"), lane_name] if x).lower()
        search_index.append({"id": nid, "x": n["x"], "y": n["y"], "r": n["r"] + 6,
                              "lb": nd.get("label") or nid, "t": search_text})
    parts.append("".join(node_svgs))
    parts.append(connectors_svg(blob.get("flows", []), nodes_by_id, total_h))
    parts.append('<g id="hl"></g>')  # search-highlight rings are appended here at runtime (see engine_template.html)

    svg_body = "".join(parts)
    phases_js = [{"n": b["name"], "x": b["x0"]} for b in pf_layout["phaseBands"]]
    return svg_body, search_index, phases_js
