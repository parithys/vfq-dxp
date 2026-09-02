# Process Flow Diagram — Design Spec

The authoritative visual/behavioural standard. The generator encodes all of this; read this file
when hand-authoring from `assets/template.html`, when a diagram must deviate from the generator's
single-lane layout, or when you need an exact token value.

## Table of contents
1. What the output is
2. Semantic colour system (the core)
3. Node types, shapes & metrics
4. Connectors & arrowheads
5. Coordinate grid, bands & spacing
6. Typography
7. Design tokens (copy-paste)
8. Behaviour: present vs. absent
9. Accessibility
10. Hand-authoring checklist

---

## 1. What the output is
One standalone `.html` file. The flow is **hand-authored inline SVG** on a dark 40px grid canvas —
nodes and connectors are static elements at absolute coordinates. No runtime diagram engine. The only
dependencies load at export time (`html2canvas` + `jsPDF` from a CDN) to power Copy / PNG / PDF.
Structure: header (pulse dot + title + subtitle + export toolbar) → diagram panel (SVG) → three info
cards (Prerequisites / Inputs→Outputs / Tools & Integrations) → footer.

## 2. Semantic colour system
Each node **type** owns one hue, used consistently for its border, translucent fill, role label,
outgoing connector, that connector's arrowhead, and its legend swatch. **Colour is never decorative.**

| Type | Accent (stroke/text) | Fill | Meaning | Glyph |
|---|---|---|---|---|
| Manual / human-in-loop | `#2e9e6b` emerald | `#eafaf2` | a person does the work | 👤 |
| Automated | `#7c5cd6` violet | `#f3eefc` | a system/engine runs it | ⚡ |
| Integration / API | `#9e7513` amber | `#fdf6e0` | external service call | 🔗 |
| Decision | `#d4667f` rose | `#fdeef2` | branch / gate (diamond) | — |
| Start / End | `#16829a` cyan | `#e2f6fb` | terminal pill | — |
| Prerequisite / neutral | `#6b7280` / `#6b7280` slate | `#080d1e` | context, wrap connectors | — |

Negative terminals (e.g. "Rejected") reuse the cyan pill shape but with a **rose** stroke.
Supporting greys: primary text `white`; secondary `#6b7280`; tertiary/prereq `#6b7280`; faint/footer
`#6b7280`; panel border & grid `#A4D3FF`.

## 3. Node types, shapes & metrics (SVG user units)
- **Process step** — `rect` 160×80 `rx 8`, stroke 1.5 (narrow variant 150×85). A step badge (`circle
  r 12`, fill `#A4D3FF`, stroke = accent) sits at the box's top-left corner with the step number. A
  role label (accent colour, size 8, `👤/⚡/🔗` + owner) sits ~12px above. Inside: 1 title line (size
  11, weight 600, white, centred) + up to 3 description lines (size 9, `#6b7280`, centred).
- **Decision** — a `<g transform="translate(cx,cy)">` wrapping `rect` 80×80 `rx 4`
  `transform="rotate(45)"` (a diamond). Fill rose, stroke 1.5. Tips sit at centre ±57
  (80·√2/2 ≈ 56.6) — connectors attach there.
- **Start / End pill** — `rect` 100–120 × 40, `rx 18–20` (≥ half-height ⇒ full pill), stroke **2**
  (heavier than steps), cyan.
- **Prerequisites band** — full-width `rect` (x 30, width W−60) × 70, `rx 8`, fill `#080d1e`,
  stroke `#6b7280`, **`stroke-dasharray="6,4"`** (dashed = context, not a step). Holds a
  `PREREQUISITES` heading + `•`-prefixed items spaced across the width.
- **Legend** — in-canvas key mirroring the exact fills/strokes used (16×10 swatches `rx 2`, a rotated
  10×10 for decision, `rx 5` for the pill, short dashed lines for loop styles).

## 4. Connectors & arrowheads
Six `<marker>`s in `<defs>`, all `10×7`, `refX 9 refY 3.5`, `orient auto`, polygon `0 0, 10 3.5, 0 7`,
differing only by fill: `arrowhead` `#6b7280`, `-emerald` `#2e9e6b`, `-violet` `#7c5cd6`, `-amber`
`#9e7513`, `-rose` `#d4667f`, `-slate` `#6b7280`.

- **Primary flow** — straight `<line>`, stroke-width 1.5, coloured by the **source** node's hue, ending
  in the matching arrowhead. Horizontal on the node mid-line (`y = box_y + 40`).
- **Decision branches** — primary/"Yes" exits right (emerald); "No" drops down to a terminal (rose).
- **Loop-back (cycle)** — dashed cyan `stroke-dasharray="6,3"`, routed over the top or under the flow;
  labelled with its trigger.
- **Exception/failure** — dashed rose, thinner (width 1, dash `4,3`).
- **Row-wrap** — dashed slate (width 1.5, dash `6,3`) with `arrowhead-slate`, carrying flow from the
  end of one row down to the start of the next.
- **Labels** — short lowercase payload on the wire (size 8, `#6b7280`, centred above midpoint), e.g.
  `intake form`, `risk tier`, `ASN`. Branch labels (`Yes`/`No`) use the branch colour at weight 600.

## 5. Coordinate grid, bands & spacing
Absolute SVG user-space grid; `viewBox="0 0 W H"`. The 40×40 `<pattern id="grid">` (stroke `#A4D3FF`
@ 0.5) stays declared in `<defs>` as the alignment reference but is **not painted** — the canvas is the
bare `#E9F2FE` ground. Paint a full-canvas rect with it only when a visible backdrop is wanted.

Canonical single-row bands: prereq band `y 20` h 70; role labels `y ≈ 128`; step badges `cy ≈ 135`;
step boxes `y 140` h 80 (flow **baseline `y = 180`**); down-routes/terminals `y ≈ 270–370`; loop band
`y ≈ 380–425`; legend `y ≈ 445–475`. Second row (multi-row wrap) baseline `y ≈ 440–480`.

Horizontal rhythm: left/right margin `x = 30`; full-width band `width = W−60`; **step stride 220**
(box 160 + 60px channel ⇒ connector ≈ 55, centred). Decision consumes one stride; tips at ±57.

Canvas trimming & container: the `viewBox` is trimmed to the content bounds with a **10-unit gutter**
left and right (no dead space); `svg{min-width}` equals that trimmed width; `.container{max-width}` is a
fixed **1920px** ceiling so the SVG (`width:100%`) scales *up* on wide displays and scrolls horizontally
below its floor. `.diagram-container` carries **no background, border, or padding**. Allow ≥ 48 above the
topmost box for the role label (`boxTop − 12`) and payload label (`boxTop − 32`).

Node text rhythm: title→title **15**, title→meta **17**, meta→meta **12**, block centred in the 80px box —
first baseline `boxTop + (80 − block)/2 + 4`.

## 6. Typography
`'JetBrains Mono', monospace` for **everything** (HTML + SVG), weights 400/500/600/700. Hierarchy comes
from size/weight/spacing, not from mixing families. HTML: `h1` 1.5rem/700 (ls −0.025em), subtitle
0.875rem `#6b7280`, card `h3` 0.875rem/600, card `li` 0.75rem. SVG: node title 11 (10 narrow)/600;
description 9 (8); role 8; badge number 10/600; connector label 8 (7); Yes/No 9/600; section labels 10/600.

## 7. Design tokens (copy-paste)
```
--bg-page:#E9F2FE;  --bg-panel:#ffffff;  --bg-prereq:#080d1e;
--border:#A4D3FF;  --btn-border:#334155;  --btn-border-hi:#6b7280;
--text:#ffffff;  --text-2:#6b7280;  --text-3:#6b7280;  --text-4:#6b7280;
manual #2e9e6b / #eafaf2      automated #7c5cd6 / #f3eefc
integration #9e7513 / #fdf6e0   decision #d4667f / #fdeef2
terminal #16829a / #e2f6fb
step 160x80 rx8 sw1.5 | badge r12 | decision 80x80 rx4 rotate45 tips±57 | pill 120x40 rx20 sw2
prereq (W-60)x70 rx8 dash6,4 | grid 40x40 @0.5 (defs only, unpainted) | arrowhead 10x7 refX9 poly "0 0,10 3.5,0 7"
text line-height 15/17/12 centred | payload label boxTop-32 | gutters 10 | container max-width 1920
radii: diagram 1rem · card .75rem · button .375rem | capture: html2canvas scale2 bg#E9F2FE pad32
```

## 8. Behaviour: present vs. absent
**Present:** export toolbar (`⋯` toggles Copy/PNG/PDF), Copy image + PNG + PDF at 2× scale, horizontal
scroll of a wide canvas, button hover + inline status feedback, print handling (`@media print` hides
toolbar), fluid fit-to-width scaling.
**Not present (by design):** interactive zoom/pan/reset, node click & drill-down, tooltips/pop-ups,
search/filter/selection, side panels/drawers, runtime data binding. Detail that a drill-down would
hide is surfaced statically in the three cards, the always-on role/connector labels, and the legend.

## 9. Accessibility
Keep the base solid — semantic headings, list markup, `aria-label` on the toggle, high-contrast
primary text, a single reduced-motion-friendly pulse. Close the known gaps for production: add a
`title` + `desc` (or `role="img"`) to each SVG plus an off-screen text transcript of the flow; always
keep the 👤/⚡/🔗 glyphs so type is not conveyed by colour alone; add a visible focus ring on the
export buttons and guard the pulse with `prefers-reduced-motion`; verify 8–9px `#6b7280` labels hold
contrast at export scale.

## 10. Hand-authoring checklist
1. Copy `assets/template.html`; set `title`, `h1`, subtitle, footer, PNG/PDF filenames.
2. Size the canvas from the content — `viewBox W = contentRight + 10`, `svg min-width` = that width,
   `.container max-width: 1920px`; height by row count (+48 top gutter).
3. Keep the `defs` (arrowhead markers + grid pattern) verbatim; do **not** paint a background grid rect.
4. Draw the dashed prerequisites band with its items.
5. Lay the flow at baseline 180, stride 220, boxes 160×80, coloured by semantic type.
6. Add badges, role labels, and up to three description lines per step — baselines from the
   15/17/12 line-height rhythm, block centred in the box.
7. Draw connectors coloured by source, with lowercase payload labels.
8. Place decisions — Yes right, No down to a rose-stroked reject pill.
9. Route loops/exceptions/wraps as dashed paths with trigger labels; wrap to a second row if wide.
10. Add the legend, the three cards, and run the accessibility pass in §9.
