#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
render.py  —  bpmn-swimlane.model.json (read-only) + process-flow's own
engine_template.html  ->  standalone HTML

Reads the SAME data/{slug}/bpmn-swimlane.model.json file bpmn-swimlane's own
render.py reads — never a separate process-flow.model.json, never the
rendered bpmn-swimlane HTML (see ../reference/MODEL_SCHEMA.md for why one
shared file is the whole point of this engine's design). Never writes back
to that file, and — unlike an earlier version of this engine — never even
mutates a copy of its nodes[]/layout: compute_process_layout() returns an
entirely separate geometry structure, so the source blob is validated and
read completely as-is.

Usage:  python render.py <model.json> <output.html> [engine_template.html] [--skip-validate]

Same CLI shape as bpmn-swimlane/scripts/render.py so render-all.js's
renderProcessFlow() can spawn this identically to renderBpmnSwimlane().
"""
import sys, json, os

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
sys.path.insert(0, os.path.join(_HERE, '..', '..', 'bpmn-swimlane', 'scripts'))

from layout_process import compute_process_layout  # noqa: E402
import svg_gen  # noqa: E402


def _validate(model_path):
    # Imported, not copied — see ../reference/MODEL_SCHEMA.md "Validation"
    # for why this is an intentional, permanent cross-engine dependency.
    import validate_model
    return validate_model.validate(model_path)


def render(model_path, out_path, template_path=None, skip_validate=False):
    if not skip_validate:
        # The source file is validated AS-IS — this engine no longer writes
        # a transformed copy anywhere before rendering (see module
        # docstring), so there's nothing to stage into a temp file first.
        errors, warnings = _validate(model_path)
        if errors:
            raise SystemExit(
                f"ABORTED: {len(errors)} connector-integrity error(s) found for {model_path} "
                f"(process-flow render) — see above. Fix the shared model and re-run, or pass "
                f"--skip-validate to force a render anyway (not recommended).")

    blob = json.load(open(model_path, encoding="utf-8"))
    pf_layout = compute_process_layout(blob["nodes"], blob.get("flows", []),
                                        blob["layout"]["lanes"], blob["layout"]["phases"])
    svg_body, search_index, phases_js = svg_gen.build(blob, pf_layout)

    meta = blob.get("meta", {})
    title = str(meta.get("title") or "Process Flow")
    parts = [p.strip() for p in title.split("—", 1)]
    h1_main = parts[0].strip() if parts else title
    h1_sub = parts[1].strip() if len(parts) > 1 else "Process Flow"

    # A subtle header stats line — "N nodes (X primary + Y exception &
    # recovery) · M flows · P phases" — entirely computed from the same
    # data everything else on the page reads from, never hand-maintained.
    spine_count = sum(1 for n in pf_layout["nodes"].values() if n["onSpine"])
    off_spine_count = len(pf_layout["nodes"]) - spine_count
    stats_line = (
        f'<b>{len(pf_layout["nodes"])}</b> nodes ({spine_count} primary path + {off_spine_count} exception &amp; recovery)'
        f'<span class="sep">&middot;</span><b>{len(blob.get("flows", []))}</b> flows'
        f'<span class="sep">&middot;</span><b>{len(pf_layout["phaseBands"])}</b> phases'
    )

    template_path = template_path or os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "reference", "engine_template.html")
    tpl = open(template_path, encoding="utf-8").read()

    export_base = meta.get("brsdId", "process-flow") + "-process-flow"
    html = (tpl
            .replace("__TITLE__", svg_gen.esc(title))
            .replace("__H1_MAIN__", svg_gen.esc(h1_main))
            .replace("__H1_SUB__", svg_gen.esc(h1_sub))
            .replace("__STATS_LINE__", stats_line)
            .replace("__TOTAL_W__", str(pf_layout["totalW"]))
            .replace("__TOTAL_H__", str(pf_layout["totalH"]))
            .replace("__SVG_BODY__", svg_body)
            .replace("__NODES_JSON__", json.dumps(search_index))
            .replace("__PHASES_JSON__", json.dumps(phases_js))
            .replace("__EXPORT_BASENAME__", export_base))
    open(out_path, "w", encoding="utf-8").write(html)
    return out_path, len(html)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: python render.py <model.json> <output.html> [engine_template.html] [--skip-validate]")
        sys.exit(1)
    skip = "--skip-validate" in sys.argv
    positional = [a for a in sys.argv[1:] if a != "--skip-validate"]
    tpl = positional[2] if len(positional) > 2 else None
    p, n = render(positional[0], positional[1], tpl, skip_validate=skip)
    print("WROTE", p, n, "bytes")
