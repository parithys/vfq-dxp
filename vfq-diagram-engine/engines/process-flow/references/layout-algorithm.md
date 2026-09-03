# process-flow — Layout & Routing Algorithm

Derived from the four reference exemplars. This is **coordinate-free**: it computes every position from
the dataset, so no reference coordinate is ever hardcoded. `scripts/generate.js` implements it; hand-
authoring should follow the same steps.

## Fixed constants (design system, never data-dependent)
```
NODE_W = 160   NODE_H = 80   NODE_RX = 8   NODE_SW = 1.5
COL_STRIDE = 220 (= NODE_W 160 + 60 channel)
ROW_STRIDE = 260  → row box-top y = 140, 400, 660, 920, …   baseline = top + 40
MARGIN = 30   GRID = 40×40   PILL = 140×60 (start) / 160×60 (end) rx20 sw2
VIEWPORT_SAFE_MARGIN = 120
```

## Phase 1 — Build the graph from data (domain-agnostic)
1. Parse the source into **nodes** and **directed edges**. Each node → `{ id, type, role, title, desc[], edgeLabel? }`.
2. Resolve **type** by what the node does: human/committee → `manual` (emerald 👤); system/engine → `automated` (violet ⚡); bus/message/contract → `integration` (amber 🔗); a yes/no gate → `decision` (rose); lifecycle bookend → `terminal` (cyan).
3. Order nodes along the主 narrative (topological / given order). Assign the `id: role` label; number badges sequentially.

## Phase 2 — Row distribution (greedy fit → viewport-constrained wrap)
```
maxRowWidth = viewportWidth − VIEWPORT_SAFE_MARGIN − 2·MARGIN
row = []; x = MARGIN
for node in ordered:
    need = (row empty ? NODE_W : COL_STRIDE)
    if x + need + MARGIN ≤ maxRowWidth: place in current row; x += need
    else: start new row; place; x = MARGIN + NODE_W
```
This yields N rows with no horizontal overflow, adapting to any node count and any `viewportWidth`
(1600 for ≤6 columns, 1820 for 7). Decisions consume one column slot.

## Phase 3 — Coordinate assignment
- Column x within a row: `MARGIN + i·COL_STRIDE` (or centre-distribute for balance).
- Row baseline y: `MARGIN + r·ROW_STRIDE + NODE_H/2`; box-top = baseline − 40.
- Badge circle at box top-left `(x, top−5) r12`; role label at `(x, top−12)` size 8 accent; title lines centred from `top+28` (or `+24` for 3 lines); meta line at `top+60` size 7.

## Phase 4 — Collision + viewport validation
- Test node rectangles for overlap; if any, increase `ROW_STRIDE` and recompute (never overlap).
- Assert every node’s right edge ≤ `viewBox.W − MARGIN`; compute `viewBox = [0,0, contentW, contentH]`, `svg min-width = contentW`, `container max-width = contentW + 48`.

## Phase 5 — Connector routing
- **Same-row hop:** straight `<line>` on the baseline, `sw1.5 opacity .75`, coloured by the **source** node’s type, ending in the matching arrowhead; payload label size 8 centred above midpoint.
- **Row-wrap (“continue”):** dashed slate `6,3 sw1.5` elbow from the last node’s right → right-margin channel (`W−200`, staggered +20 per wrap) → down → left to `x 160` → down into the next row’s first node; label “continue”.
- **Decision:** Yes continues in-lane (source colour); No drops to a rose terminal; both labelled.
- **Loops (context-specific):** cycle = cyan `6,3`; revision = emerald `4,3` (no marker, open bracket); exception/remediation = rose `4,3`; route over/under; label the trigger.

## Phase 6 — Chrome
- Draw order: grid rect → nodes → connectors → loops → legend.
- Legend lists **only** styles used (type swatches + the loop/wrap styles present).
- Rail phase-band tags at far left **iff** the flow has named phases; otherwise a single “Process Flow” tag.

## Phase 7 — Cards & export
- Emit the **Input → Output Transformation table** (one row per transformation stage) as the default card; three-context-card mode only when no `ioTable` is supplied.
- Emit the fixed export toolbar + `capture/PNG/PDF` script and SRI-pinned deps verbatim.
