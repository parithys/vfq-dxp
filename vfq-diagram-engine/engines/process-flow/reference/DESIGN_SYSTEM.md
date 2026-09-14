# Design system — `process-flow`

This engine's look is modelled on a hand-built reference file the project
maintainer supplied (`vfq-mobile-postpaid-activation-complete-flow_10.html`)
— a light-theme, single-spine flowchart, distinct from `bpmn-swimlane`'s
own actor-lane grid (see `../../bpmn-swimlane/reference/DESIGN_SYSTEM.md`,
which remains completely separate and untouched). Every colour/shape/
spacing rule below was read directly off that reference's own rendered
SVG output, not off its CSS legend (which has its own drift from what's
actually painted — noted where relevant). See `MODEL_SCHEMA.md` for how
each rule is *derived from data*, not hardcoded.

## Architecture

Unlike `bpmn-swimlane` (inject raw JSON, render entirely client-side in
JS), this engine bakes the SVG shapes **server-side, in Python**
(`scripts/svg_gen.py`) — the same construction method the reference file
itself used. Only search, phase-jump, and export stay client-side JS
(`reference/engine_template.html`'s `<script>` block) — the only genuinely
interactive behaviours the reference has. There is no side drawer, no
zoom/pan, no Happy Flow playback, no "View Details" mode — this engine
does not have bpmn-swimlane's feature set, by design; it replicates the
reference's own, smaller interaction surface.

## Colour palette

| Colour | Hex | Used for |
|---|---|---|
| Navy | `#2A1B9E` | spine line; start/end/primary/on-spine-decision node fill or stroke |
| Teal | `#0F9B8E` | milestone nodes |
| Red | `#F01010` | error/rejection nodes and their connectors |
| Amber | `#C07800` | recovery/retry nodes, off-spine decision nodes, and most explicit branch connectors |
| Violet | `#7A2BD6` | escalation/approval-task nodes and their connectors |
| Green | `#12A038` | happy-path branch label text only (no connector drawn) |
| Blue | `#3B7DD8` | data-flow connectors (dashed) |
| Ink `#111` / Mute `#5A5A66` / Code-grey `#8A8A9B` | title / description / code-line text |

Header chrome: dark charcoal gradient (`#25282b` → `#1a1c1e`), matching
the reference exactly — this is the one part of the page that stays dark
while the canvas itself is light, same as the reference.

## Node shapes

| Category | Shape | Size |
|---|---|---|
| start | filled circle | r=16 |
| primary (ordinary spine step) | filled circle | r=14 |
| end | double-ring circle (stroke r=21 + fill r=16) | |
| milestone | double-ring circle, teal | r=21/16 |
| decision (on or off spine) | diamond (rotated square path) | half-diagonal 18 |
| error (off-spine only) | filled circle + white X mark | r=13 |
| escalation (off-spine only) | rounded square | 26×26, rx=6 |
| recovery (off-spine only) | filled circle, amber | r=12 |

Every spine node (start/end/milestone/primary/on-spine-decision) carries
its sequence number (`01`..`NN`) centred inside the shape, white on filled
shapes and navy on the white-filled decision diamond. Off-spine nodes
carry no number.

## Node card layout

Every node — spine or off-spine — gets the same card, anchored 26px to the
right of its shape's centre:
1. **Title** — 15px bold, `label` verbatim.
2. **Code line** (if `sub` is present) — 11.5px bold, grey, uppercased
   (e.g. `MPAR_001_JSM_01` or `BR-002 · BR-010`).
3. **Description** — 12.5px regular, muted, the first sentence of `desc`
   (numbered-requirement prefixes like `"1. "` stripped), word-wrapped to
   at most 2 lines with the last line ellipsised if it still overflows.
4. **Actor pill** — bold caps on a tinted rounded-rect background, the
   node's lane's friendly name.
5. **System tag pills** (0+) — smaller, dotted-icon pills, flowing
   left-to-right and wrapping to a new row only once a row's accumulated
   width would exceed the card's available width (not one per row) — see
   `MODEL_SCHEMA.md` "System / actor tag pills" for where these come from.

## Phase bands

One vertical band per business phase (`blob.layout.phases`, unchanged from
the shared data), each with a `17px` bold uppercase header on a shared
grey (`#BFC4CB`) top bar, alternating a light tint (`#F8F8FB`) on every
other band — matching the reference's own zebra pattern, applied to
columns here instead of `bpmn-swimlane`'s row-zebra.

## Header chrome (all replicated near-verbatim from the reference)

- **Eyebrow**: "BPMN Process Flow" (kept identical to the reference — this
  is a *different* label from `bpmn-swimlane`'s own "BPMN Swimlane"
  eyebrow, so the two outputs are never confusable even side by side).
- **Title/subtitle**: `meta.title` split on the first em dash, same
  convention `bpmn-swimlane`'s own header shim uses.
- **Phase-jump dropdown**: populated from the computed phase bands;
  selecting one smooth-scrolls the canvas horizontally to that phase's
  left edge.
- **Search**: substring match (2+ chars) against a lowercased index of
  each node's sequence number + label + code + description + lane name;
  matches get a red highlight ring, Enter/Shift+Enter cycle
  forward/backward, hit count shown top-right.
- **Export menu**: SVG (direct blob download), PNG (rendered via canvas at
  0.5× scale — a very wide canvas can exceed browser canvas-size limits at
  1×, same reasoning and same mitigation the reference uses), PDF (A3) and
  PDF (A4) (both via `window.print()`, no external library, works
  offline). Both PDF variants tile the SVG's viewBox into a 2-D grid of
  print-page-sized cells — row and column, not just column strips — sized
  so the diagram's smallest text (`SYS_TAG_FONT_PX` in `svg_gen.py`) never
  prints below an ~8pt floor; A3 and A4 use the same floor, so A3 just
  needs fewer pages to cover the same content rather than printing larger
  text. Exports that would need more than 60 pages to hold that floor
  prompt for confirmation first (that count already excludes blank tiles —
  see below). Pages print edge-to-edge (`@page` margin is 0) with no
  per-page header — only a small corner tag
  (`R{row}/{rows} · C{col}/{cols} · {n}/{total}`) — so a full print run can
  be trimmed and taped together into one continuous wall poster rather
  than a stack of individually-framed sheets. Tiles with zero drawn ink
  (every SVG shape's bbox tested against the tile rect via
  `_computeContentRects`/`_tileHasContent`) are dropped from the printed
  page list entirely, but `(row, col, n, total)` in a kept tile's corner
  tag is always its position in the full, un-pruned grid — never
  renumbered after skipping — so the tag still identifies the correct
  physical cell for reassembly regardless of which neighbours were blank.
  See `exportPDF()` in `engine_template.html` for the exact scale/tiling/
  blank-skip math.

## What this engine deliberately does NOT have

No side drawer, no click-to-detail panel, no zoom/pan controls, no Happy
Flow playback/toggle, no "View Details" persistent mode. These are real
`bpmn-swimlane` features this engine does not replicate, because the
reference file this engine is modelled on doesn't have them either — see
"Architecture" above.
