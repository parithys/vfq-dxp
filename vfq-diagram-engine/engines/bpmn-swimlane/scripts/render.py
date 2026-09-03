#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
render.py  —  model.json + engine_template.html  ->  standalone HTML

The engine template holds the ENTIRE design system and interaction layer
(layout, node/connector styling, side-drawer, filtering, highlighting, zoom,
selection, export, responsive behaviour). This step only injects the data.
Nothing domain-specific lives in the engine.

Validates connector integrity (dangling from/to ids, missing phase fields —
see validate_model.py's docstring for why these matter) before writing the
output, regardless of whether the model.json came from the workbook pipeline
(path A, which already validates via generate.py) or a hand-authored script
(path B, which calls this directly) — so a broken model.json is caught here
either way, not just in one of the two paths.

Usage:  python render.py <model.json> <output.html> [engine_template.html] [--skip-validate]
"""
import sys, json, os

def render(model_path, out_path, template_path=None, skip_validate=False):
    if not skip_validate:
        here = os.path.dirname(os.path.abspath(__file__))
        sys.path.insert(0, here)
        import validate_model
        errors, warnings = validate_model.validate(model_path)
        if errors:
            raise SystemExit(f"ABORTED: {len(errors)} connector-integrity error(s) in {model_path} "
                              f"— see above. Fix the model and re-run, or pass --skip-validate to "
                              f"force a render anyway (not recommended).")
    template_path = template_path or os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "reference", "engine_template.html")
    tpl = open(template_path, encoding="utf-8").read()
    blob = json.load(open(model_path, encoding="utf-8"))
    html = tpl.replace("__MODEL_JSON__", json.dumps(blob), 1)
    open(out_path, "w", encoding="utf-8").write(html)
    return out_path, len(html)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: python render.py <model.json> <output.html> [engine_template.html] [--skip-validate]"); sys.exit(1)
    skip = "--skip-validate" in sys.argv
    positional = [a for a in sys.argv[1:] if a != "--skip-validate"]
    tpl = positional[2] if len(positional) > 2 else None
    p, n = render(positional[0], positional[1], tpl, skip_validate=skip)
    print("WROTE", p, n, "bytes")

