#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
layout_model.py — fills in node/lane pixel geometry (x, y, w, h, cx, cy, slot,
layout.totalW, layout.totalH) on a structurally-complete model.json, using the
exact same compute_layout() function build_model.py's workbook pipeline (path
A) uses. This is what makes a hand-authored/extracted model.json (path B —
nodes[].id/type/lane/phase/label already set, layout.lanes[].key/name/hint and
layout.phases[] already set, but no pixel geometry) renderable without asking
a human to hand-place coordinates: run this once after extraction, before
render.py.

Usage:  python layout_model.py <model.json> [output.json]
        (in-place if output.json is omitted)
"""
import sys, os, json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_model import compute_layout  # noqa: E402  (path insert must precede this import)


def main():
    if len(sys.argv) < 2:
        print("usage: python layout_model.py <model.json> [output.json]")
        sys.exit(1)
    in_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else in_path

    blob = json.load(open(in_path, encoding="utf-8"))
    layout = compute_layout(blob["nodes"], blob["layout"]["lanes"], blob["layout"]["phases"],
                             blob.get("flows"))
    blob["layout"] = layout
    json.dump(blob, open(out_path, "w", encoding="utf-8"), indent=1)
    print(f"WROTE {out_path} | totalW {layout['totalW']} totalH {layout['totalH']} "
          f"| lanes {len(layout['lanes'])} | nodes {len(blob['nodes'])}")


if __name__ == "__main__":
    main()
