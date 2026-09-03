#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate.py  —  one-shot:  workbook.xlsx  ->  standalone HTML

Convenience wrapper that runs build_model.py, then validate_model.py (fails
fast on connector-integrity errors — dangling from/to ids, missing phase
fields — before ever reaching the browser), then render.py. The workbook
(Excel / exported dataset) is the ONLY input; everything shown is derived
from it. The design, layout and interactions come from the fixed engine
template and are never altered.

Usage:
  python generate.py <workbook.xlsx> [output.html] [--title "..."] [--date YYYY-MM-DD]
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_model, render, validate_model

def main():
    args = sys.argv[1:]
    if not args:
        print("usage: python generate.py <workbook.xlsx> [output.html] [--title ...] [--date YYYY-MM-DD]"); sys.exit(1)
    wb = args[0]
    out = None; title = None; date = ""
    rest = args[1:]; i = 0
    while i < len(rest):
        if rest[i] == "--title": title = rest[i + 1]; i += 2
        elif rest[i] == "--date": date = rest[i + 1]; i += 2
        else: out = rest[i]; i += 1
    out = out or (os.path.splitext(os.path.basename(wb))[0] + "_Business_Process.html")
    blob = build_model.build(wb, title=title, gen_date=date)
    model_tmp = out + ".model.json"
    json.dump(blob, open(model_tmp, "w"), indent=1, default=str)
    print("--- validating connector integrity before render ---")
    errors, warnings = validate_model.validate(model_tmp)
    if errors:
        print(f"\nABORTED: {len(errors)} connector-integrity error(s) found — see above. "
              f"Fix the source workbook (or the sheet-matching in build_model.py) and re-run. "
              f"{model_tmp} was left in place for inspection.")
        sys.exit(1)
    print("--- validation passed, rendering ---")
    p, n = render.render(model_tmp, out, skip_validate=True)   # already validated above; avoid re-printing the report
    os.remove(model_tmp)
    print("WROTE", p, "(", n, "bytes ) | nodes", len(blob["nodes"]),
          "| agents", len(blob["model"]["agents"]))

if __name__ == "__main__":
    main()

