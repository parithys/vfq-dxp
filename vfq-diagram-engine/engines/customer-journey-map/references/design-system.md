# Customer Journey Map — Visual Design System (Normative)

Single source of truth for how every generated map looks. Extracted from the Vodafone-style reference
exemplars (`examples/`). The design system is fixed — 15 rows, this palette, this typography — only the
journey content changes between runs. This is not a spreadsheet with colored headers; every choice
below exists to keep it reading as a designed artifact, and at 15 rows that intent matters more, not
less — see §2's format table.

## 1. Page & canvas

- Single self-contained `.html` file, no external requests, system font stack only.
- Page background light neutral grey (`--bg:#EFEFEF`), content on a white canvas (`--canvas:#FFFFFF`)
  with a soft shadow. **Full-width, not centered with a max-width cap.** `#app` uses a fixed 20px outer
  margin on all sides (`margin:20px`) and no `max-width` — a block element with `width:auto` fills its
  parent minus that margin automatically, so the canvas occupies the full browser width at any viewport
  size. An earlier version capped this at `max-width:1400px; margin:24px auto`, which centered a
  1400px-wide card inside wider browser windows and left large unused grey margins on both sides — that
  is the exact failure this rule exists to prevent. Do not reintroduce a `max-width` cap on `#app`.
- Grid: one fixed left rail column (row labels, ~170px) + N equal stage columns
  (`grid-template-columns: 170px repeat(N, 1fr)`). Equal stage width is non-negotiable — never let one
  stage's content stretch its column wider than its neighbors. Because the canvas itself is now
  full-width, stage columns get proportionally wider on large monitors too — this is correct and
  intended, not a bug to constrain back down with a max-width.

## 2. The 15 rows — fixed order, fixed labels, fixed format per row

| # | Row label | Format |
|---|---|---|
| 1 | Stage | header card |
| 2 | Goals | prose |
| 3 | Customer / Agent Actions | prose |
| 4 | Touchpoints & Channels | prose |
| 5 | Supporting Systems | comma list |
| 6 | Thoughts | quote |
| 7 | Emotional Journey | **visual** (§5) |
| 8 | Customer Experience | prose |
| 9 | Pain Points | fact lines (ID) |
| 10 | Current Responses | fact lines (ID) |
| 11 | Opportunities | fact lines (ID) |
| 12 | KPIs / Key Metrics | fact lines (no ID) |
| 13 | Business Goals | prose |
| 14 | Teams / Responsible Parties | comma list |
| 15 | Structural Metrics | **visual** (§4.3) |

Never render a row in a format other than the one assigned to it in this table — in particular, never
turn a prose row into bullets, and never turn rows 9–12 into a wall of prose. The format variety across
the 15 rows (header / prose / list / quote / fact-lines / visual) is what keeps a 15-row map reading as
a designed document instead of a spreadsheet; collapsing that variety back to one uniform treatment is
the single easiest way to regress this skill, whatever the row count.

## 3. Typography

| Role | Size | Weight | Color |
|---|---|---|---|
| Title | 26–28px | 700 | `#1A1A2E` |
| Subtitle | 12–13px | 400, italic optional | `#6B7280` |
| Row label (left rail) | 12px | 700, uppercase | `#1F2937` |
| Stage header name | 15–16px | 700 | white on stage color |
| Cell prose (rows 2, 3, 4, 8, 13) | 12.5px | 400 | `#1F2937`, line-height 1.5 |
| Cell comma list (rows 5, 14) | 12.5px | 400 | `#1F2937`, line-height 1.5 |
| Quote text (row 6) | 12.5px | 400 italic | `#374151` |
| Quote source tag (row 6) | 10px | 600 | `#6B7280` |
| Fact line (rows 9–12) | 12.5px | 400 | `#1F2937` |
| Fact ID tag (rows 9–11) | 10px | 600 monospace | `#6B7280` |
| Emotion state word (peaks only) | 11px | 700 | matches category color |
| Emotion milestone label | 11.5px | 700 | `#1F2937` |
| Metric card stage label | 12.5px | 700 | `#1F2937` |
| Metric card value | 11px | 400 | `#6B7280` |
| Footer / legend | 10–11px | 400 | `#6B7280` |

Never below 10px anywhere.

## 4. Color system

### 4.1 Stage header palette (qualitative, sequential)

```
--stage-1: #B9A6DA;  --stage-2: #6C3FA6;  --stage-3: #3B1F6B;  --stage-4: #D32F2F;
--stage-5: #F2811D;  --stage-6: #12777F;  --stage-7: #5E9C33;  --stage-8: #A9D08E;
--stage-9: #8E6BAE;  --stage-10:#2F5D8A;
```
Extend by cycling/interpolating for >10 stages; never repeat adjacent colors. Each stage's column gets
a 3px top-border accent in its stage color on every row below the header, so the eye can trace a column
all the way down without re-reading the header — this matters more at 15 rows than it did at 8.

### 4.2 Emotion system — 4 states (fixed; do not add or drop a state)

```
--emotion-positive: #2E7D32;  /* green  */
--emotion-neutral:  #6B7280;  /* grey   */
--emotion-friction: #C62828;  /* red    */
--emotion-delight:  #1565C0;  /* blue   */
```
`delight` is distinct from `positive` — reserve it for moments that exceed expectation (a surprise
upgrade, a faster-than-promised install), not just "things went fine" (that's `positive` or `neutral`
depending on whether it was actively good or simply uneventful). The connecting line between dots is
drawn in a neutral dark grey/red blend regardless of the segment's endpoints — it represents the
throughline, not a per-segment gradient.

### 4.3 Structural metrics (row 15)

- Per-stage card: white rounded card, a small ascending 3–4 bar icon (decorative, grey gradient,
  tallest bar last), the stage's short label (bold), `"{n} manual"` (muted, below).
- Lifecycle banner: full-width bar directly above the cards. Text is centered:
  `"Total Lifecycle Steps: {sum} ({manualSum} manual / {pct}%)"`. Behind the text, a horizontal fill
  shows the manual percentage as a proportion of the banner width.
- Distinct from row 12 (KPIs/Key Metrics), which is stage-level experiential/business metrics —
  structural metrics are mechanical step counts, never mixed into the same row.

## 5. Emotional Journey row anatomy

SVG spanning the full content width (grid-column 2/-1), **fixed height 154px — this number is load-
bearing, not decorative.** One dot per stage, horizontally centered under its stage column using
**native SVG percentage coordinates with no `viewBox`** — this is a hard rule, not a style preference
(see box below).

```
padTop = 38, bandH = 58, rowH = 154
y(positive) = padTop          y(delight)  = padTop            (both top band; delight sits marginally
y(neutral)  = padTop + bandH*0.5                                above positive if both appear adjacent)
y(friction) = padTop + bandH
stateWord   = y - 20           (colored callout above the dot, top band only, single line)
milestone line 1 = y + 22      (bold label below the dot, every dot — always 2 lines, see below)
milestone line 2 = y + 36
```

**These margins exist because the labels, not the dots, define the row's real vertical footprint.**
The dot sits mid-row, but a `stateWord` reads 20px above it and a two-line `milestoneLabel` extends to
36px below it, each with its own font ascent/descent on top of that offset. A row height sized to the
dot band alone (an earlier version used 110px with a 26/62 split) leaves only ~2px of clearance above
the top band and none below the bottom band. If you ever change `padTop`, `bandH`, or the label
offsets, re-derive `rowH` from them rather than picking a height independently.

**Milestone labels always wrap to 2 lines, split at the `Label (CODE)` boundary — never rendered as
one line.** With enough stages (5+) or long labels at moderate widths, adjacent single-line labels
collide into each other or run past the row's outer edges. Splitting at the parenthetical — a boundary
every label in the schema already has — roughly halves each line's width and fixes both problems at
once. This split is unconditional, not triggered by a width check, for the same reason the row avoids
`viewBox`: a condition that only fires "when needed" is a condition that wasn't tested at the width
that actually needed it.

**A shrink-to-fit pass still runs after that**, because even two half-width lines can collide at high
stage counts and narrow widths (verified failure case: 6 stages at 700px, "Document Upload" and
"Manual Review" touching). This pass uses real `getComputedTextLength()` on the rendered `<text>`
elements — safe here, unlike the pixel-position bug this row had before, because it only scales
`font-size` down (floor 8.5px) for labels that overflow their column, never repositions anything. The
one accepted tradeoff: it runs once at load, so a label sized for a wide viewport won't re-shrink if
the window is later resized narrower without a reload — a cosmetic edge case, not a misalignment.

Above the dot (only for stateWord peaks/troughs): the colored state word. Below the dot: the bold
milestone label, always split into 2 lines. Connecting segments are `<line>` elements (percentage x,
absolute y) between consecutive dots — never a `<path>` (path data does not support percentage units,
which is exactly the bug that broke this row before).

> **Why no viewBox, ever, on this row.** A `viewBox`-scaled SVG requires either (a) a one-time JS
> pixel measurement of the container — which goes stale the instant the container is viewed at a
> different width than it was measured at (e.g. a narrower preview pane), silently drifting every dot
> off-center — or (b) a non-uniform x/y scale via `preserveAspectRatio="none"`, which distorts circle
> radii and font sizes into ellipses and oversized text. Native percentage coordinates on `cx`, `cy`
> *(cy is not a percentage here — see below)*, `x1`, `x2`, `y1`, `y2`, and text `x` resolve against the
> SVG's actual rendered size on every layout pass, with no JS and no distortion. Only x-axis values are
> percentages here (dots align to stage columns, which are fluid `fr` widths); y-axis values are fixed
> pixel numbers because the row height itself is fixed — mixing a percentage x with an absolute y on
> the same element is valid SVG and is exactly what this row should do.

## 6. Row anatomy (general)

Every row is `display:grid` on the same column template as the header, `padding:14px 12px` per cell,
light bottom border (`#E5E7EB`) separating rows, top-aligned text.

## 7. Footer

One bar: `Emotion: ● Positive ● Neutral ● Friction ● Delight | {methodology note} | {traceability note}`.

## 8. Accessibility & print

- Stage header fills must hold ≥4.5:1 contrast against white text.
- `@media print`: white background, no outer shadow, `break-inside: avoid` per stage column group.
