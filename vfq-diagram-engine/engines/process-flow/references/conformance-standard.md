# process-flow — Conformance Standard

**Status: normative.** This is the single source of truth for the `process-flow` skill: every rule,
constraint, dependency, exception, and behaviour extracted, element‑by‑element, from the four canonical
reference diagrams in `assets/reference/` (Readiness & Go‑Live Gate, Integration Contracts, Capability
Data Flows, Agents Master). Any HTML the skill emits — by the generator (`scripts/generate.js`) or by
hand from `assets/template.html` — **MUST** conform so that outputs are visually, structurally, and
behaviourally interchangeable with the references, **regardless of the input dataset or business domain.**

`references/design-spec.md` (base single‑lane tokens) and `references/layout-algorithm.md` (the node
distribution + routing algorithm) are companions; where they overlap this document’s **stricter/more
specific** value wins.

Conformance keywords: **MUST** = required for conformance; **MUST NOT** = prohibited; **SHOULD** =
strongly recommended, deviate only with a stated reason; **MAY** = optional.

### Revision r2 — canvas & typography defaults (supersedes r1 where they differ)

Four defaults changed; the exemplars in `assets/reference/` have been re-cut to match, so the
diff-test in §14 still holds:

1. **No background grid.** The canvas is the bare `#E9F2FE` ground. The `grid` pattern stays in
   `<defs>` and MAY be painted back in as an opt-in alignment backdrop (§1).
2. **Tight horizontal gutters.** The `viewBox` is trimmed to the content bounds with a **10-unit
   gutter** each side instead of a 30-unit margin plus dead space; `svg{min-width}` tracks the
   trimmed width (§5.5).
3. **Wider page container.** `.container{max-width}` is a fixed **1920px** ceiling, no longer
   `min-width + 48`, so the SVG scales up on wide displays (§5.5).
4. **Looser node text rhythm.** Line-height inside the 80px box is title→title **15**, title→meta
   **17**, meta→meta **12**, block vertically centred (§3.1). Payload labels move to `boxTop − 32`
   so they no longer collide with the `id: role` line (§6.2).

### Revision r3 — solid fills (supersedes r2 where they differ)

Every **background fill is now a solid hex value**, never `rgba()` with an alpha. Each new value is the
exact composite of the old translucent fill over the `#E9F2FE` ground, so the rendered colour is
identical — what changes is that nothing underneath a node shows through it.

This matters wherever shapes overlap. The step badge (`r12` circle at the box's left corner) sits half
on the ground and half on the node box; with a translucent box fill the two halves of its surround
resolved to different colours and the ring read as smudged. The same applied to any loop channel or
connector passing behind a node. A fill that is a window is a bug waiting for the first overlap.

| Element | was | now |
|---|---|---|
| Manual node | `rgba(6,78,59,.4)` | `#eafaf2` |
| Automated node | `rgba(76,29,149,.4)` | `#f3eefc` |
| Integration node | `rgba(120,53,15,.3)` | `#fdf6e0` |
| Decision diamond | `rgba(136,19,55,.4)` | `#fdeef2` |
| Terminal / reject pill | `rgba(8,51,68,.4)` | `#e2f6fb` |
| Card panel | `rgba(15,23,42,.5)` | `#ffffff` |
| Rail tag | `rgba(51,65,85,.3)` | `#11182a` |
| Prerequisites band | `rgba(30,41,59,.2)` | `#080d1e` |

Stroke and connector **opacity** attributes are untouched — those de‑emphasise lines rather than paint a
background, and a connector is meant to sit visually behind the nodes it joins.

### Revision r4 — readable type, driven by tokens (supersedes r3 where they differ)

**1. A 10px readable floor.** Nothing a reader must *read* goes below 10px. These diagrams are
downscaled into slides, printed to A4, and screenshotted; html2canvas captures at 2× so the export is
sharp, but sharpness is not legibility once the image is scaled to fit a frame. The one exemption is the
step badge **numeral** — a single glyph inside a 24px ring, found by position rather than read.

**2. Three tiers, not seven ad-hoc sizes.**

| Tier | Purpose | Size | Applies to |
|---|---|---|---|
| 1 | names the thing | **12** | node title, terminal pill |
| 2 | attributes of it | **11** | meta/description lines, `id: role`, diamond text |
| 3 | annotation, read on demand | **10** | payload, branch, loop, wrap, legend labels |

**3. Sizes are TOKENS, never literals.** They live in one `TYPE_DEFAULTS` block and are overridable per
run via `spec.type` (e.g. `{"type": {"min": 11}}`). Raising `min` lifts every readable token with it.
Previously these were inline arguments at eight separate draw sites, so "make the labels bigger" meant
hunting through the renderer and missing some — which is precisely what happened. **No check may pin
itself to a literal size either**: the verifier derives its "small text" ceiling from the file.

**4. Node text wraps; it never shrinks and never truncates.** The box is fixed at 160 (§4.1) and the
floor is 10px, so a long label cannot be scaled to fit without breaking readability — the only honest
lever is a second line. Wrapping breaks on spaces **and after `.` `/` `-`**, because event names like
`adoption.metrics.published` are one unbreakable word to a space-only wrapper and are exactly what these
diagrams carry. Titles are never truncated: a clipped node name is a wrong node name.

### Revision r5 — canonical model, validation, content-fit nodes (supersedes r4 where they differ)

**1. Normalise and validate before layout.** `normaliseSpec()` runs first and guarantees the invariants
every later stage assumed but nothing enforced. Previously: a node could render with `id=""` (the
start/end pills had none), two nodes could share an id and silently collapse into one drawer entry, an
edge could carry `undefined` endpoints that `JSON.stringify` then dropped from the interactive model
entirely, and a spec missing `flow` produced a raw `TypeError` stack trace. Now every renderable node
gets a deterministic id (`n3`, `start1`), duplicates are rejected, loop endpoints must resolve, and a
malformed spec raises a `SpecError` naming the offending index and the valid values.

**2. One canonical record per node.** `recordNode()` is the single place a node becomes data. Every
consumer — SVG, drawer JSON, filters, accessible name, edge endpoints — reads it. The divergence this
fixes was live: the SVG drew badges `1,2,3,4,5` from `n.num ?? ctx.stepNo++` while the drawer JSON
carried `""` for all five, because a second loop re-derived the same fields with a different fallback.
Two producers of one truth will always drift; the question is only how long before anyone notices.

**3. Node height fits content, within limits.** Width stays **160** — the column stride, connector
anchors and channel maths all rest on it — but height now grows from the measured text between
`nodeHeight.step` and `nodeMaxHeight` (default 140). Rows advance by their tallest node plus
`rowClearance`, not a constant. Where content still exceeds the ceiling, the last line takes a visible
`…` and the build warns on stderr naming the node; the **drawer always keeps the full text**. What is no
longer possible is the old behaviour: a bare `.slice(0, 3)` discarding the fourth description line with
no marker, no warning, and no trace.

**4. Consequences of variable height, now handled.** A taller box raises its `id: role` line, so a
payload label pinned to the connector could collide with it — the payload lift is now derived from the
taller of the two flanking boxes. The verifier's band check scopes by **nearest-box ownership**, because
adjacent boxes no longer share a top edge and a proximity band caught the wrong node's labels.

**5. Domain-neutral fixtures.** The four exemplars share one shape, so passing them proves little. The
suite in `scripts/__fixtures__/matrix/` is deliberately unlike them: 3-node minimum, unbroken dotted
tokens and long labels, 16 nodes that must wrap, a decision, a rework loop, three simultaneous loop
corridors, and every node type at once. `selftest.js` runs all of them plus six malformed specs.

### Revision r6 — filter affordance, semantic reject, extensible vocabulary (supersedes r5 where they differ)

**1. The filter toolbar must read as a control, not as content.** It previously borrowed the diagram's
own visual vocabulary — rounded outlines with small coloured swatches — so it was indistinguishable at a
glance from the legend and from the nodes themselves. It now carries a `3px` violet left rule, a `Filter`
caption, and a drawn funnel glyph (`clip-path`, not an emoji, so it renders identically everywhere). An
active chip fills with `currentColor` rather than tinting, so pressed state survives a greyscale print.

**2. A negative terminal is its own semantic type.** The legend already distinguished "Rejected /
negative end" from "Start / End", but `semanticType()` collapsed both to `terminal`, so a rose reject
pill lit up under the cyan Start/End chip — the filter was coarser than the key printed beside it.
**Colour encodes type and nothing else (§2): if two things are drawn differently they must filter
differently.** `reject` is now a first-class type with its own chip, label and accent.

**3. A decision's negative branch may route to an existing node** via `no: { to: "<nodeId>" }`, instead
of always synthesising a dead-end pill. When the failure path leads somewhere the process already models
("Manual Fix"), synthesising a second node with the same name duplicated it on the canvas and filtered
it as a terminal rather than as the manual step it is. An unknown target is a `SpecError`, named.

**4. Ingestion vocabularies are caller-extensible.** The column synonyms and the type/terminal/decision
word lists are English defaults, and they decide node **colour** — so a German or Japanese table either
failed shape detection or resolved nothing, silently. `--vocab vocab.json` merges over every list. The
ingester emits `role` **verbatim**, with no glyph prefix: presentation belongs to the renderer.

### Revision r7 — export formats, label plates, no iconography (supersedes r6 where they differ)

**1. Export is a labelled menu, not a glyph.** The trigger was a bare `⋯`, which tested fine and was
still never found — discoverability is now part of the contract, and the verifier rejects a trigger
without a text label. The menu offers **SVG / JPG / PDF** (plus PNG and Copy), each with a one-line hint
naming what the format is *for*, because the right choice depends on what the reader will do next.

- **SVG is a genuine vector serialisation** of the live `<svg>`, not a raster in a wrapper, so it stays
  editable and stays sharp at any zoom. The clone gets the font stack written onto it explicitly: a
  detached SVG does not inherit the page stylesheet, so without this every label reflows in a fallback
  face and shifts off the computed geometry. The verifier rejects a raster-wrapped SVG export.
- **JPG is flattened onto the canvas ground** before encoding. JPEG has no alpha channel, so an
  un-flattened canvas writes transparent pixels as **black** — on this palette that is silent damage
  rather than an obvious bug. The verifier rejects an unflattened JPG export.
- The menu closes on outside click, on `Escape`, and on choosing a format; status is reported on the
  **trigger**, since a message written into a menu item would vanish with the menu.

**2. A payload label rides ON its connector, over a plate.** Floated above the line (r3–r5) a label
between two rows was ambiguous about which stroke owned it and competed with the role band. It is now
centred on the stroke, with a pill-shaped plate in the canvas ground knocking the line out behind the
glyphs — the standard edge-label treatment. **The plate is derived from the measured text** (width from
`textWidth`, `rx` = half its height), never a fixed rect, or it stops matching the label the moment the
wording or the type scale changes. The baseline offset stays a function of `TYPE.edgeLabel`, so raising
`spec.type` keeps the label centred instead of drifting off the line.

**3. Role labels carry no iconography.** The node's colour and its legend entry already encode
manual/automated/integration; a glyph in front of the role restated it in a form that renders
inconsistently across platforms, consumed width the role name needed, and — in the accessible name — was
**announced** ("high voltage", "bust in silhouette") ahead of the actual role. Stripping happens at
**render time**, not in the spec, because glyphs arrive from two directions: this generator's own
fallback and caller data with them already baked into `role`. Cleaning one source leaves the other to
reintroduce them on the next dataset. The verifier scans both `<text>` content and every `aria-label`.

**4. An `end` node is a sink.** The sequential connector linked every adjacent pair in `flow`, so a spec
listing two outcomes in a row (a success end and a `reject` end) drew a connector **out of a terminal**,
making the second appear to follow the first. The source is dropped at the end of the loop rather than
special-cased per branch, so the rule holds in one place: nothing is ever connected out of a terminal.

**5. A loop label sits on its own stroke.** The same-row loop label was offset 12 units *below* its
channel — harmless while nothing ran underneath, and wrong the moment something did: with a decision's No
corridor there, a `re-score` label rendered on the rose rejection path and read as naming it. Colour is
the only thing telling a reader which path a label belongs to, so a label nearer to a foreign stroke than
to its own is mis-attributed. Loop labels are now centred on their own channel like every other connector
label, and §6.3 rejects any label whose nearest competing stroke is not its own colour.

**6. The inline script must parse.** Every scripted check greps for handler names in the source text,
which a **dead** script passes perfectly: one stray token anywhere in the block throws at parse time and
the browser defines *none* of the functions, leaving export, filtering and the drawer inert on a file
just certified conformant. This happened — a `\n` inside a generated string literal was interpolated
into a raw newline. §11.0 parses the emitted script, which is the only check that distinguishes "the
handler is present in the text" from "the handler exists at runtime".

## Variance analysis across the four references (shared vs. contextual vs. data‑driven)

The four exemplars share **one identical design system**; they differ only in ways that are either
driven by the data or by the presence of a contextual feature. There are **no true inconsistencies** to
resolve — everything consolidates into the single standard below. Classify every difference as:

**SHARED (identical in all four → hard rules, never vary):** the entire `<style>` block; the `<defs>`
(6 arrowhead markers `10×7 refX9 refY3.5` polygon `0 0,10 3.5,0 7`, and the `grid` pattern `40×40`
stroke `#A4D3FF` @0.5, declared but not painted); `JetBrains Mono`; the `#E9F2FE` ground; node box `160×80 rx8 sw1.5`; the
semantic colour set; the `id: role` label convention; the numbered/badged step model; the **Input →
Output Transformation table card** (`.io-table`); the export toolbar + `capture/PNG/PDF` script; the
CDN deps with SRI; `@media print`.

**DATA‑DRIVEN (computed from the dataset → follow the formula, do not hardcode):** `viewBox` width/height
(from column/row counts); `svg{min-width}` floor and `.container{max-width}` = floor + 48; number of
nodes, rows, columns and their coordinates; the `io-table` row count (= number of transformation
stages); which arrowhead colour each connector uses (= source node type); the legend’s entries (it lists
**only** the styles the diagram actually uses); title font‑size (11 for ≤2 title lines, 9 for 3 lines);
footer text (`<Context> | <Name>`).

**CONTEXT‑SPECIFIC (present only when the modelled process has that feature → include iff applicable):**
left‑rail **phase band tags** (Capability Data Flows has 4 named bands; the others carry a single
“Process Flow” tag); the **decision diamond** + rose **No/exception** terminal + **“Remediation Loop”**
(only Readiness has a gate); the dashed **container/hub node** (only Capability’s “Training Coverage”);
the specific **loop set** — cycle/feedback/revision (each appears only where the relationships call for
it). Preserve these as valid contextual variations; never force them where the data has no such feature.

The **only** cosmetic drift observed is the footer *qualifier wording* (“Agent Ecosystem | PG Portal”
vs “Agent Ecosystem Documentation | Integration Contracts”); consolidated to the pattern in §1/§13.

The references are agent‑ecosystem diagrams, but this standard is **domain‑agnostic**: every concrete
label (AI, PG, Event, Governance, INT‑04, `readiness.assessed`) is only an *instance* of a generic slot
(role token, lane, node id, payload). Reuse the rules, swap the content.

---

## 0. Conformance quick‑checklist (gate before delivery)

A diagram conforms only if **all** of these hold:

- [ ] Single self‑contained `.html`; no local assets; only the 3 pinned CDN deps (fonts, html2canvas, jsPDF) with their SRI hashes.
- [ ] `JetBrains Mono` everywhere (HTML + SVG). Ground `#E9F2FE`, **no grid rect painted** (pattern stays in `<defs>` for opt-in use).
- [ ] Node text uses the r2 rhythm — title→title 15, title→meta 17, meta→meta 12, block centred in the 80px box (§3.1).
- [ ] Canvas trimmed to content + a **10-unit gutter** left/right; `svg{min-width}` = `viewBox` width; `.container{max-width:1920px}`; `.diagram-container` carries **no background, border, or padding** (§5.5).
- [ ] Every node’s **type → colour** is semantic and consistent across fill, stroke, role label, outgoing connector, arrowhead, and legend swatch (§2).
- [ ] Every process node carries: a **`id: role` label** above‑left, a **rounded box**, a **title**, and (where present) a **meta/annotation line** (§4, §7).
- [ ] Connectors are **coloured by their source node** and end in the matching arrowhead; loop/wrap/exception styles follow the taxonomy (§6).
- [ ] Multi‑row canvases use **fixed row/column geometry** (§5) with **row‑wrap “continue”** connectors and, when present, **left rail tags** (§5.4).
- [ ] Decisions render as **rose diamonds**; No‑branch drops to a **rose terminal**; remediation/feedback arcs use the correct loop style (§6, §8).
- [ ] Exactly **one** card block, in the correct **mode** (three‑card *or* Input→Output). For Input→Output default to **Variant A1 — the Input·Output·Example·Meaning table** (§9.1); fully populated, no placeholders.
- [ ] In‑canvas **legend** present and matches the styles actually used (§10).
- [ ] **Export toolbar** works: `⋯` toggles Copy / PNG / PDF; capture is html2canvas @2× on `#E9F2FE` with 32px pad, ignoring `.toolbar`; PDF orientation derived from aspect (§11).
- [ ] `viewBox`, `min-width`, and `container max-width` follow the breadth/height formulas (§5.5). No clipped text; arrowheads touch node edges.
- [ ] If `interactive` is set: nodes are focusable controls, the drawer pushes rather than covers, filters reset before export, motion is guarded (§11.3).
- [ ] **`node scripts/verify.js <file>.html` exits 0.** This runs the checklist above mechanically. It is not a substitute for looking at the diagram — it cannot tell you the flow is wrong — but everything on this list that a machine *can* decide, it decides.

Run the verifier before delivery, every time. The items it checks are the ones the eye is worst at:
a 30‑unit gutter looks like a 10‑unit gutter, an 18px line‑height looks like 17, and a legend entry for
a style the diagram stopped using looks like diligence.

---

## 1. Document object model & load order (structure & hierarchy)

The page **MUST** have exactly this outer structure, in this order:

```
<body>
 └ .container#report-container   (max-width per §5.5, centered)
    ├ .header
    │   ├ .header-row  →  .pulse-dot  +  h1  +  .toolbar(.toolbar-actions{Copy,PNG,PDF} + .toolbar-toggle ⋯)
    ├ .diagram-container (overflow-x:auto)  →  <svg viewBox="0 0 W H">
    ├ .cards            →  ONE .card  (mode per §9)
 └ <script>  (SLUG + capture/copy/png/pdf)
```

Rules:
- The **export toolbar MUST live inside `.header-row`** (so it is excluded from capture via the `.toolbar` ignore, and hidden in print). It **MUST NOT** be placed inside the SVG.
- `#report-container` is the capture root; nothing outside it is exported.
- Head deps load in this order and **MUST** keep their SRI `integrity` + `crossorigin`: Google Fonts (JetBrains Mono 400;500;600;700) → `html2canvas@1.4.1` → `jspdf@2.5.2`.
- The SVG is **static, hand‑placed inline geometry** — no runtime diagram/layout engine, no data binding.

### SVG internal draw order (back → front), MUST be:
1. `<defs>`: 6 arrowhead markers + `grid` pattern (+ any node container hatch patterns).
2. *(No full‑canvas grid rect — r2 default.)* The ground `#E9F2FE` shows through. To opt back in,
   paint `<rect width="100%" height="100%" fill="url(#grid)" opacity="0.5"/>` here and nowhere else.
3. Rail tags (§5.4) — optional.
4. Nodes: for each, role label → box → title lines → meta line → **step badge last**.
   The role label sits on the `boxTop − 12` line, **right‑aligned to the box's right edge**
   (`text-anchor="end"` at `boxX + width`) in generated output. The badge owns the top‑left
   corner, so a left‑anchored label has to dodge it and lands at an arbitrary offset; anchoring
   to the far edge gives every label one shared alignment whatever its length. Hand‑authored
   diagrams without badges may anchor `start` at `boxX + 2` instead — both are conformant.
   The `r12` badge is centred on the box's top-left corner, so the box overlaps its lower-right
   quadrant. Painted before the box, the corner's fill and stroke cut an arc through the ring and
   the badge reads as broken; painted after, its opaque `#A4D3FF` fill masks the corner cleanly.
5. Primary connectors + payload labels.
6. Loop / feedback / exception / wrap paths + their labels.
7. Legend block.

Later elements paint over earlier ones; this order guarantees the grid sits behind everything and labels sit above boxes.

---

## 2. Semantic colour system (visual design & colour)

**Colour encodes node type and nothing else. It is never decorative.** Each type owns one accent
(stroke + role text + outgoing connector + arrowhead + legend swatch) and one translucent fill.

| Semantic type | Accent | Fill | Arrowhead id | Legend label | Glyph |
|---|---|---|---|---|---|
| Manual / human‑in‑loop | `#2e9e6b` emerald | `#eafaf2` | `arrowhead-emerald` | “Manual / Human‑in‑loop” | 👤 |
| Automated | `#7c5cd6` violet | `#f3eefc` | `arrowhead-violet` | “Automated” | ⚡ |
| Integration / API / Event | `#9e7513` amber | `#fdf6e0` | `arrowhead-amber` | “Integration / API” | 🔗 |
| Decision | `#d4667f` rose | `#fdeef2` | `arrowhead-rose` | “Decision” | — |
| Start / End (terminal) | `#16829a` cyan | `#e2f6fb` | `arrowhead` (`#6b7280`) in / cyan pill | “Start / End” | — |
| Neutral / wrap / rail | `#6b7280` slate (text `#6b7280`) | `#11182a` | `arrowhead-slate` | — | — |

Support greys (MUST): primary text `white`; secondary `#6b7280`; tertiary `#6b7280`; faint/footer
`#6b7280`; panel/grid border `#A4D3FF`; rail‑tag text `#2c2c2c`.

**Negative terminal exception:** a reject/failure end pill keeps the cyan *pill shape* but uses a
**rose stroke** (`#d4667f`). (Reference: readiness “Remediation” terminal.)

### 2.1 Role‑token → semantic‑type mapping (domain‑agnostic rule)
Reference diagrams label lanes with role tokens; each token resolves to one semantic type/colour.
The **rule** (not the vocabulary) is normative: pick a token per node, map it to a type, colour by type.

| Example role token (references) | Resolves to | Colour |
|---|---|---|
| `Governance`, `Board`, `Field`, `Portal` (a human/committee body) | Manual | emerald |
| `AI`, `PG`, `Shared`, `Value`, `AI Layer`, `PG Layer` (a system/engine) | Automated | violet |
| `Event`, `Data Flow` (a bus message / contract on the wire) | Integration | amber |
| a yes/no gate | Decision | rose |
| lifecycle bookends | Start / End | cyan |

> The **same token can differ by context**: “PG” as a *governing body* node is emerald (manual), but
> “PG” as an *aggregation capability* node is violet (automated). Resolve by **what the node does**
> (human judgement vs. automated processing vs. wire message), not by the label string. Document the
> chosen mapping once per diagram for traceability.

---

## 3. Typography (formatting & styling)

`'JetBrains Mono', monospace` for **everything**; hierarchy is size/weight only, never a second family.

| Element | Size | Weight | Colour |
|---|---|---|---|
| `h1` title | 1.5rem | 700 (ls −0.025em) | white |
| Card `h3` | 0.875rem | 600 | white |
| Rail‑tag text | 9 (SVG) | 500 | `#2c2c2c` |
| Node role label (`id: role`) | 9 (SVG) | 600 | node accent |
| Node title — 1–2 lines | 11 | 600 | white |
| Node title — 3 lines (tight box) | 9 | 600 | white |
| Node meta / description line | 7 (dense) or 9 | 400 | `#6b7280` |
| Terminal pill text | 9 | 600 | white |
| Step badge number | 10 | 600 | white |
| Connector payload label | 8 | 400 | `#6b7280` |
| Branch label (Yes/No) & loop label | 9 | 600 | branch/loop colour |
| Legend heading | 10 | 600 | white |
| Legend item | 8 | 400 | `#6b7280` |

**Title‑size rule (MUST):** node title font‑size scales to fit the 80px box — use **11** when the title
is 1–2 lines, drop to **9** when the title needs 3 lines, so the title + meta line never overflow.

### 3.1 Node text line‑height & vertical centring (MUST — r2)

Inside the 160×80 box the text block is spaced by **role**, not by font size:

| Gap | Value |
|---|---|
| title line → title line | **15** |
| last title line → first meta line | **17** |
| meta line → meta line | **12** |

The block is **vertically centred** in the box: with `block = 15·(nTitle−1) + (nTitle ? 17 : 0) + 12·(nMeta−1)`,
the first baseline sits at `boxTop + (80 − block)/2 + 4` (the `+4` is the cap‑height correction), rounded
to 0.25. Resulting baselines for the common shapes:

| Shape | Baselines (offset from `boxTop`) |
|---|---|
| 1 title | 44 |
| 1 title + 1 meta | 35.5 · 52.5 |
| 2 titles + 1 meta | 28 · 43 · 60 |
| 2 titles + 2 metas | 22 · 37 · 54 · 66 |
| 3 titles (size 9) + 1 meta | 21.5 · 36.5 · 51.5 · 68.5 |

Decision diamonds follow the same title→title 15: a 2‑line diamond title sits at `y −4` and `y 11`.
Meta lines that flag an unresolved item MAY be tinted rose `#d4667f` (the type accent is carried by the
box, so the meta line is free to signal state) — when used, the legend MUST carry the matching entry.

---

## 4. Node model, shapes & metrics (component structure)

All values in SVG user units.

### 4.1 Process step (rounded box)
- `rect` **160×80**, `rx 8`, `stroke-width 1.5`, fill+stroke by type (§2).
- **Role label** above the box top‑left: `x = box_x + 2`, `y = box_y − 12`, `text-anchor:start`, format **`<id>: <role>`** (e.g. `1: AI`, `12a: PG`, `2c-iii: AI`, `3: Governance`). See §7 for the id grammar.
- **Step badge** (numeric linear flows only — e.g. readiness): `circle r 12`, fill `#A4D3FF`, stroke = accent, centred at the box top‑left corner; number size 10/600. *Grid/architecture diagrams that use `id: role` labels (Integration/Capability/Agents) do **not** add a separate numeric badge — the id in the role label is the identifier.*
- **Title:** 1–3 centred lines (`text-anchor:middle`, `x = cx`). Baselines come from the §3.1 table — never hand‑pick them.
- **Meta/description line:** up to 2 centred lines, size 7 or 9, `#6b7280` (rose `#d4667f` when flagging an open item), baselines per §3.1. Holds the payload id, event name, or annotation (§7).

### 4.2 Container / group node (exception style)
When a node represents an aggregate/container (reference: “Training Coverage”), draw the box with a
**dashed stroke** `stroke-dasharray="2,2"` (width 2) **plus** an overlaid low‑opacity cross‑hatch:
```
<defs><pattern id="container-pattern-<x>-<y>" width="8" height="8" patternUnits="userSpaceOnUse">
  <path d="M0,0 L8,8 M8,0 L0,8" stroke="<accent>" stroke-width="0.5" opacity="0.1"/></pattern></defs>
<rect x="box_x+1" y="box_y+1" width="158" height="78" rx="7" fill="url(#container-pattern-…)" opacity="0.3"/>
```
Everything else (role label, title, meta) is unchanged.

### 4.3 Decision (diamond)
- `<g transform="translate(cx,cy)">` wrapping `rect −40,−40 80×80 rx 4 transform="rotate(45)"`, rose fill/stroke, `stroke-width 1.5`.
- Diamond tips at centre ±≈57 (80·√2/2). Connectors attach at the tips.
- Title centred inside (`x 0 y 5`, size 10/600, white). Diamonds carry **no** role label or badge.

### 4.4 Start / End pill (terminal)
- `rect` **140×60** (`rx 20`) for row‑embedded terminals, or **120×60 / 160×60** as width demands; `stroke-width 2` (heavier than steps); cyan (or rose for a reject terminal).
- Text centred, size 9/600, 1–2 lines. Pills carry **no** role label/badge.

### 4.5 Rail tag (phase marker) — see §5.4.

---

## 5. Coordinate grid, rows, columns & responsiveness (layout, positioning, spacing)

Absolute SVG user space. The **40×40 grid** (`<pattern id="grid">`, stroke `#A4D3FF` @0.5) is the
alignment reference the coordinates below are derived from, but under r2 it is **declared and not
painted** (§1). Treat it as graph paper you design on and then take away.

### 5.1 Column rhythm (horizontal)
- **Column stride = 220 nominal** (box 160 + 60 channel), but the channel is a **minimum, not a
  constant (r3)**. Where a connector carries a payload label, its channel widens to
  `textWidth(label) + 2×10 padding + 14 for the arrowhead`, so the stride after that node grows with it.
  The **box stays 160** (§4.1 is a hard rule) — only the free space between boxes flexes. A fixed 60
  channel truncates any label longer than ~13 characters, and the overhang then collides with the node
  text on either side. Data columns begin at **x = 80** and step +220: `80, 300, 520, 740, 960, 1180, 1400`.
- The start pill occupies **column 0 (x = 80)** on row 1; the first *data* node of row 1 therefore sits at **x = 280/300** (next stride). On wrapped rows there is no pill, so data nodes begin at **x = 80**.
- Left/right canvas margin = **30**; full‑width bands use `x 30, width W−60`.

### 5.2 Row rhythm (vertical)
- **Row stride = 260.** Row box‑top y‑values: `140, 400, 660, 920, 1180, 1440`.
- **Flow baseline = box_top + 40** ⇒ `180, 440, 700, 960, 1220, 1480` (all straight connectors on that row ride this y).
- Role label y = `box_top − 12` ⇒ `128, 388, 648, 908, 1168, 1428`.
- Rows are evenly spaced; there is **never** vertical overlap between rows or between a node and a connector channel.

### 5.3 Row‑wrap “continue” connector (MUST for multi‑row)
When flow reaches the last column of a row and continues on the next row:
- Route a **dashed slate** path (`stroke #6b7280`, `stroke-width 1.5`, `stroke-dasharray 6,3`, opacity 0.6, `marker-end url(#arrowhead-slate)`): out from the last node’s right edge → to a **right‑margin channel** (x ≈ `W−200 … W−180`, e.g. `1620`, then `1640` for the next wrap to avoid overlap) → **down** past the row → **left** to `x 160` → **down** into the first node of the next row.
- Label **“continue”** (size 9, `#6b7280`) near the top of the vertical drop.
- Stagger successive wrap channels by ~20px so they never coincide.

### 5.4 Left rail tags (phase/lane markers) — optional but MUST match style when used
Small tabs at the far left that name a row’s phase (reference: “Raw Signals”, “Consolidated Data”,
“Governance & Decisions”, “Realized Value”; or a single “Process Flow” tag on linear diagrams):
- `rect x 9, y = rowBaseline−12, width 70–78, height 24 (36 if 2 lines), rx 4`, fill `#11182a`, stroke `#6b7280`, `stroke-width 1`.
- Text `x 19`, `text-anchor:start`, size 9/500, `#2c2c2c`.
- A short **dashed connector** from the tag to the row (`stroke #6b7280`, dash `4,2`, opacity 0.5) linking `x 115→95` at the baseline.
- **Rail gutter (MUST when rails are used):** the row's first node starts at **x = 120**, not 80 — i.e. the
  whole flow shifts one 40‑unit gutter right (author it as `<g transform="translate(40,0)">` around the
  flow content, leaving rails and legend in the base coordinate space). Without this the tag and tie run
  underneath the first pill/box.

### 5.5 Canvas sizing formulas (responsiveness)
- `svg { width:100%; min-width:<floor>px; display:block }` inside `.diagram-container{overflow-x:auto}` — the SVG scales fluidly to the panel but never shrinks below its floor; below the floor the panel scrolls horizontally. **MUST NOT** set an SVG pixel width.
- **`viewBox` width** = `contentRightEdge + 10`, where the content bound includes text advance widths
  (mono ≈ `0.62 × fontSize` per char, anchor‑aware). The left gutter is the same 10 units — rails at
  `x 9` therefore sit flush. This replaces the r1 fixed floors (1600/1820): the canvas is trimmed, not padded.
- **`svg { min-width }` = the trimmed `viewBox` width.** Below it `.diagram-container{overflow-x:auto}` scrolls.
- **`.container { max-width: 1920px }`** — a fixed ceiling, independent of content width, so the SVG
  (`width:100%`) scales *up* on wide displays. `.diagram-container` MUST carry **no background, border,
  or padding**; the diagram sits directly on the page ground.
- Top gutter MUST clear both the `id: role` label (`boxTop − 12`) and the payload label (`boxTop − 32`):
  allow ≥ 48 above the topmost box.
- **`viewBox` height** = margin + `rows × 260` + loop/legend band. References: `602` (1 data row + legend), `1447` (5 rows), `1707` (6 rows). Add ~150–200 for the legend/loop band beneath the last row.
- Body padding `2rem`; `@media print` sets 1rem and hides `.toolbar`.

---

## 6. Connectors, arrowheads & the loop taxonomy (routing & conventions)

### 6.1 Markers (MUST, verbatim)
Six `<marker>`s in `<defs>`, all `markerWidth 10 markerHeight 7 refX 9 refY 3.5 orient auto`,
polygon `0 0, 10 3.5, 0 7`, differing only by fill: `arrowhead` `#6b7280`, `-emerald` `#2e9e6b`,
`-violet` `#7c5cd6`, `-amber` `#9e7513`, `-rose` `#d4667f`, `-slate` `#6b7280`.

### 6.2 Primary flow
Straight `<line>` on the row baseline, **`stroke-width 1.5`, opacity 0.75**, coloured by the **source
node’s type**, ending in the matching arrowhead. A same‑row hop spans one 220 stride (≈55px visible
gap between boxes). Payload label (size **7.5** — r3, `#6b7280`) centred on the connector's span and riding **9 units above
the connector line itself** (r3 — it was `boxTop − 32`, which pinned it to the node box and left it
floating level with the `id: role` labels, close enough to read as one of them). Its channel is sized to
it (§5.1) so it is never clipped
(r2 — its own line above the `id: role` labels at `boxTop − 12`, which it used to collide with),
lowercase noun phrase (`readiness data`, `payload`, `evidence`, `directives`, `actions`, `realized value`).

### 6.3 Loop taxonomy (each style is normative)
| Purpose | Colour | width | dash | marker | Label |
|---|---|---|---|---|---|
| **Cycle loop** (feedback / continuous) | cyan `#16829a` | 1.5 | `6,3` | `arrowhead` (cyan usage) | cyan, weight 600 |
| **Revision loop** (governance response, soft return) | emerald `#2e9e6b` | 1 | `4,3` | **none** (open bracket) | emerald, size 8 |
| **Exception / failure path** | rose `#d4667f` | 1 (or 1.5 for remediation arc) | `4,3` | `arrowhead-rose` | rose, weight 600 |
| **Row‑wrap “continue”** | slate `#6b7280` | 1.5 | `6,3` | `arrowhead-slate` | slate “continue” |
| **Rail‑tag tie** | slate `#6b7280` | 1 | `4,2` | none | — |

**Inter-row corridors are ALLOCATED, not averaged (r5).** A wrap or loop crossing the band between two
rows takes the next free y *beneath that band's deepest obstruction* — node bottoms, plus any decision's
No-branch pill hanging out of the row above — and successive users of the same band stagger. Averaging the
two row baselines, as earlier revisions did, produces a corridor that knows nothing about what already
occupies the band: a No-branch pill spanning 182.6–222.6 was crossed by a wrap routed to y=220. The rows
were 300 apart, so this was never a spacing problem — the corridor simply was not allocated.

This class of defect is invisible to gutter, label and node-overlap checks, all of which passed. §6.3 now
tests routed **paths** against node rectangles directly.

- Cycle/feedback loops **route over the top** (a channel above the boxes, e.g. y≈320–355) **or under**
  the flow, with a centred label naming the trigger (“Feedback Loop”, “Continuous Sensing & Aggregation”).
- Revision loops draw as an **open bracket** (no arrowhead) framing the governed span, label below.
- All loop endpoints snap to node edges/centres; loops **MUST NOT** pass through a node box.

### 6.4 Anchoring (MUST — derived, never fixed)

**No connector coordinate is ever a literal.** Every endpoint is computed from the node it attaches to:
`sourceNode.rightEdge → targetNode.leftEdge` for a same-row hop, the diamond's own reach for a decision
branch, the node's box bounds for a loop channel. The diamond's tip is
`nodeHeight.decision × √2 ÷ 2` — read off the node, not the 57 it happens to equal at the default size.

Routing offsets (channel gaps, gutters, loop stagger, branch drop) live in one `ROUTE` token block for
the same reason the type scale does (r4): a fixed coordinate survives review at one node size and
detaches silently at the next, and every dataset brings different node counts and label lengths.

The verifier enforces this: a connector whose endpoint does not land on a node boundary — within the
arrowhead's own reach, since the marker draws into that gap — is an error, not a warning.

### 6.4a Anchor mechanics
Every connector start/end snaps to a node boundary (box edge mid‑point, diamond tip, or pill edge). The
arrowhead **MUST** visibly touch the target boundary. Cross‑row connectors use **elbow paths**
(down → across → up); same‑row use straight lines.

---

## 7. Identifier grammar & data relationships (data presentation)

### 7.1 Hierarchical id scheme (MUST be internally consistent)
Node ids in the `id: role` label encode grouping depth:
- **Top level:** `1, 2, 3, 4, 5` — major phases/lanes or ordered steps.
- **Group + members:** a group header node `N` (e.g. `1a: PG Layer` “PG Governance Capabilities (5)”) followed by members `Na-i, Na-ii, …` **or** `Na, Nb, Nc` (e.g. `12a, 12b, 12c`).
- **Event/interstitial:** letter suffix on the phase it belongs to (`1a: Event`, `5a: Event`).
- The count in a group header (“(5)”) **MUST** equal the number of member nodes drawn for it.

### 7.2 Annotation / meta line vocabulary (domain‑agnostic slots)
The meta line under a title carries **one** of these relationship annotations (reference examples →
generic slot):
- **Payload / event name** — `readiness.assessed event`, `adoption.metrics.published` → *the message/artifact on the wire*.
- **Capability ref** — `AI-C2: Org readiness eval`, `PG-C8: Value link` → *`<owner-code>: <one-line purpose>`*.
- **Centrality / degree** — `CONSUMES & PRODUCES | Degree: 11`, `PRODUCES | Degree: 1`, `INTERNAL (PG) | Degree: 1`, `Hub Agent | In:14, Out:10, Degree:24` → *`<direction> | Degree: <n>`* graph‑centrality metadata.
- **Hub marker** — append **`(HUB)`** to the title of the highest‑degree node(s) in a group.
- **Free annotation** — `Bidirectional asset flow`, `7 simultaneous data streams`.

These are **static, human‑readable metadata**, surfaced on the node so no drill‑down is needed. Keep the
same annotation grammar across a diagram for traceability/lineage.

---

## 8. Business rules, conditions & decision logic (behavioural logic)

**Every decision MUST show both outcomes (r3).** A diamond with one visible, unlabelled exit reads as an
unconditional step: the reader cannot tell which outcome continues the main line, nor what happens when
the condition fails — and the failure case is usually the reason the gate is documented at all.

- The **in‑lane edge is the affirmative branch** and carries `yesLabel` (default "Yes"), rose, weight 600,
  on the connector line like any payload label (§6.2).
- The **negative branch** drops from the diamond's bottom tip (`cy + 57`, §13) as a rose dashed path with
  `arrowhead-rose`, labelled `noLabel` (default "No"), into its own terminal pill carrying `no.label`.
  The pill widens to fit its text; it is a `reject` terminal (cyan shape, rose stroke, §2).
- Rose throughout, matching the gate and the exception taxonomy (§6.3): the negative path is the same
  semantic thread as the decision that produced it.

Where the data genuinely has no negative branch — the condition cannot fail, or failure exits the modelled
scope — omit `no` and say so in the meta line. Silence is the one thing that is not acceptable.


The following logical patterns are part of the standard and MUST be reproduced when the modelled
process contains them:

1. **Gate/decision:** a decision diamond has exactly one **Yes** (in‑lane, continues right, source‑coloured) and one **No** (drops down). Label both branches (Yes emerald/green, No rose).
2. **Reject/No terminal:** the No branch ends at a **rose‑stroked terminal pill** (not a step). It is an *end of that path*, not a step in the happy path.
3. **Remediation / rework arc:** a failed gate returns to the earlier step it must repeat via a **rose exception arc over the top**, labelled with the trigger (“Remediation Loop”). The arc’s source is the gate/decision (or the review that failed) and its target is the step to redo.
4. **Continuous sensing → aggregation:** producer lanes feed an aggregator via a **cyan cycle loop** that runs continuously (labelled), expressing an always‑on relationship rather than a one‑shot step.
5. **Governance response loop:** decisions flow to execution and results flow back via a **revision (emerald open‑bracket)** loop framing the governed span.
6. **Feedback loop:** terminal outcomes feed back to the first sensing/producer stage via a **cyan cycle loop** (“Feedback Loop”), closing the lifecycle.
7. **Row‑wrap continuation:** when a phase exceeds the row width, flow continues on the next row via the slate “continue” wrap (§5.3) — this is layout, not a semantic step, and MUST be visually distinct (dashed slate) from real transitions.
8. **BAU / sustainment end:** the lifecycle terminates in a cyan “BAU …” pill signifying steady‑state hand‑off.
9. **Group→member expansion:** a group header node summarises *n* members; the members are drawn adjacent and share the group’s lane colour; the header’s “(n)” MUST match.
10. **Directionality of contracts:** integration/data‑flow nodes state direction (`PG → AI`, `AI → PG`, `PG ↔ AI`) and MUST colour amber (integration) regardless of the endpoints’ own colours.

Decision logic is expressed **structurally** (shape + branch + colour + label), never via runtime code.

---

## 9. Card block modes (component structure & data presentation)

There is exactly **one** `.cards` block containing **one** `.card`. Choose the mode by content type;
do not emit both, and never leave placeholder text.

### 9.1 Mode A — Input → Output Transformation (all four references use this)
A single `.card` titled **“Input → Output Transformation”** (violet card‑dot). It has **two
interchangeable presentation variants**; the card header/title and the one‑row‑per‑stage semantics are
identical in both. **Variant A1 (table) is the current default** and is what the golden exemplars in
`assets/reference/` now use; Variant A2 (arrow card) is retained as legacy. Emit exactly one variant.

Both variants MUST:
- keep the header `<div class="card-header"><div class="card-dot violet"></div><h3>Input → Output Transformation</h3></div>` unchanged;
- carry **one row per major transformation stage** (references: 3 or 4 — MUST equal the number of stages in the flow);
- preserve the **Input = emerald `#2e9e6b`** / **Output = cyan `#16829a`** accent pairing;
- take Input/Output text verbatim from the flow’s stage boundaries (no new facts invented there).

#### Variant A1 — Input · Output · Example · Meaning **table** (DEFAULT)
Five columns: a row‑header **Step N** cell, then **Input**, **Output**, **Example**, **Meaning**.
Structure (MUST):
```html
<table class="io-table">
  <thead><tr><th class="io-col-step"></th><th>Input</th><th>Output</th><th>Example</th><th>Meaning</th></tr></thead>
  <tbody>
    <tr><th scope="row">Step 1</th>
        <td class="io-in">…input…</td>
        <td class="io-out">…output…</td>
        <td class="io-ex">…first-input → first-output…</td>
        <td class="io-mean">…one plain-language sentence…</td></tr>
    …one <tr> per stage…
  </tbody>
</table>
```
CSS (MUST, dark‑system‑consistent — this is the **only** styling the section owns; it replaces the
Variant‑A2 `.io-transformation-*` rules, never other selectors):
```css
.io-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.io-table th, .io-table td { border: 1px solid rgba(71, 85, 105, 0.4); padding: 0.625rem 0.75rem; text-align: left; vertical-align: top; line-height: 1.5; }
.io-table thead th { background: #E9F2FE; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.75rem; }
.io-table tbody th { background: #F4F8FE; color: white; font-weight: 700; white-space: nowrap; }
.io-table td { color: #2c2c2c; }
.io-table .io-col-step { width: 64px; }
.io-table td.io-in { border-left: 2px solid #2e9e6b; }
.io-table td.io-out { border-left: 2px solid #16829a; }
.io-table td.io-ex { color: #7c5cd6; white-space: nowrap; }
.io-table td.io-mean { color: #6b7280; }
```
Column derivation rules (MUST):
- **Input / Output** — verbatim from the stage (same text the arrow card would show).
- **Example** — a condensed `‹first input term› → ‹first output term›` using the leading comma‑separated item of each (e.g. `AI sensing outputs → Consolidated metrics`). Rendered violet, non‑wrapping, with a real `→` (U+2192).
- **Meaning** — exactly **one** present‑tense plain‑language sentence (≈ ≤ 22 words) explaining how the input becomes the output. It MUST NOT introduce facts absent from Input/Output or the diagram; it paraphrases the transformation only.
- Header text `text-transform:uppercase` renders `Input/Output/Example/Meaning` in caps; leave the leftmost `<th>` empty; row headers read `Step 1…N`.

#### Variant A2 — numbered arrow card (LEGACY)
N numbered rows, each a 3‑column grid **input | down‑arrow | output**:
- Container `.io-transformation-grid` (column flex, gap 1.5rem); row `.io-transformation-item` → `.io-step-number` (28px violet‑ringed circle) + `.io-transformation-content` (`grid-template-columns:1fr auto 1fr`).
- `.io-input-section` / `.io-output-section`: `.io-section-header` (uppercase 0.75rem/700 `#6b7280`) + `.io-section-content` (`#0a1122`, 0.8rem, `#2c2c2c`); input content `border-left:2px solid #2e9e6b`, output `border-left:2px solid #16829a`.
- Between them `.io-transformation-arrow` renders an inline down‑arrow SVG (24×48, violet, own `arrowhead-transform-<i>` marker).

> **Variant selection:** default to **A1 (table)** — it carries the Example + Meaning columns and matches
> the current exemplars. Use **A2** only when a caller explicitly wants the compact arrow card and no
> Example/Meaning columns. Switching A2→A1 is a section‑local change: replace the `.io-transformation-*`
> CSS with the `.io-table` CSS and swap the card body; **nothing outside the card (SVG, other cards,
> header, footer, export script) changes.**

### 9.2 Mode B — three context cards (base design‑spec default)
Three `.card`s: **Prerequisites** / **Inputs → Outputs** / **Tools & Integrations**, each a `<ul>` of
`•` items. Use when the diagram documents readiness context rather than a staged transformation. (See
`design-spec.md`.) Grid: `repeat(auto-fit, minmax(280px,1fr))`, gap 1rem.

> **Selection rule:** if the flow is a staged pipeline whose story is “inputs become outputs at each
> stage,” use **Mode A** (default **Variant A1 — the Input·Output·Example·Meaning table**). If it is a
> workflow needing prerequisites/tooling context, use **Mode B**. The four golden exemplars are all
> **Mode A / Variant A1 (table)**.

---

## 10. In‑canvas legend (MUST, mirrors styles actually used)

**No legend coordinate is a literal (r4).** Item widths come from `textWidth(label)`, each row's start
from `axis − rowWidth/2`, and the row count from whether the measured total fits the canvas. Different
diagrams carry different numbers of entries with different label lengths — a fixed `x` per item is
correct for exactly one dataset and wrong for the next.

A legend block **centred beneath the flow** (r3 — it was bottom‑left with a heading):
- **No heading.** A row of keyed swatches is self‑evidently a key; the word "Legend" costs a line and
  tells the reader what the shapes already say.
- **Centred on the content's own midpoint**, not the canvas midpoint and not the left margin — the
  legend describes the whole diagram, so it shares the axis the flow is centred on. Where a rail gutter
  shifts the flow (§5.4), the legend shifts with it. Each row centres independently, so a wrapped
  legend stays balanced rather than ragging right.
- Type swatches (16×10, `rx 2`) for Manual/Automated/Integration with their fills+strokes; a `rx 5`
  swatch for Start/End (pill); a **rotated 10×10** square for Decision (when a decision exists).
- Loop/line samples: short dashed lines demonstrating each loop style **present in that diagram**
  (Cycle loop, Revision loop, Exception path, Row wrap) with matching colour/dash.
- Item text size 8, `#6b7280`, swatch‑to‑label gap 6, entry‑to‑entry gap 26. One row is the target.

The legend **MUST** list only the styles the diagram actually uses, and each swatch **MUST** match the
exact fill/stroke/dash of the real elements.

**One row wherever it fits (r3).** Type swatches and line samples form a *single* sequence — there is no
forced break between the two groups. Lay them left to right across the **full canvas width**, not merely
the width the nodes happen to occupy: the legend sits below the flow with nothing beside it, so
constraining it to the content bounds wraps it needlessly while the canvas still has room. If the set
genuinely will not fit, split into the fewest rows that hold it, divided evenly rather than packing one
long row and leaving a stub beneath. If a one-row legend overruns the canvas, **widen the canvas** — a
legend read in one pass is worth a slightly wider diagram.

Reason: the legend is one list. Broken across rows it reads as two unrelated groups and the eye scans
twice for a single lookup.

---

## 11. Interactions, export & behaviour (UX)

### 11.1 Present (MUST work)
- **Export toolbar:** `.toolbar-toggle` (`⋯`, `aria-label="Export options"`) toggles `.expanded` on `.toolbar`, revealing Copy / PNG / PDF. Buttons show hover state and inline status text (`⏳ …` → `✓ Done!` / `✗ Failed`), reverting after 2s.
- **Copy:** `html2canvas` → `canvas.toBlob` → `navigator.clipboard.write([ClipboardItem{'image/png'}])`.
- **PNG:** same capture → `<a download=SLUG+'.png'>`.
- **PDF:** capture → `jsPDF({orientation: w>h?'landscape':'portrait', unit:'px', format:[w,h], hotfixes:['px_scaling']})` → `addImage` → `save(SLUG+'.pdf')`.
- **Capture bounds are MEASURED, never assumed (r4).** `captureBounds()` walks every descendant of
  `#report-container` and takes the union of their rects — leftmost, rightmost, topmost, bottommost —
  then pads by 32. Using the container's own rect crops anything that overflows it, and the SVG
  routinely does: `min-width` makes it wider than its container on a narrow viewport, so
  `.diagram-container` scrolls and the right-hand nodes and legend fall outside. A cropped export still
  *looks* like a complete diagram, which is what makes it dangerous. Before capture the diagram's
  horizontal scroll is reset (and `overflow-x` set to `visible`) so the full width is rendered, then
  both are restored so the reader's view is untouched.
- **Capture config (MUST):** `html2canvas(document.body, { backgroundColor:'#E9F2FE', scale:2, useCORS:true, ignoreElements: e => e.classList?.contains('toolbar'), x/y/width/height padded by 32 around `#report-container` })`.
- `SLUG` is a kebab‑case constant used for both filenames.
- Fluid fit‑to‑width; horizontal scroll below `min-width`; `@media print` hides toolbar.
- **Pulse dot** animates `opacity 1→0.5` on a 2s loop.
- **No native tooltips, from either source.** Two constructs produce a browser tooltip and **both are
  prohibited**: a `title` **attribute** on any element, and a `<title>` **child element inside the SVG**.
  The second is the one that slips through — it is a legitimate accessibility construct, so it looks
  correct in review, but browsers also render it as a hover pop‑up covering the entire canvas.
  Native tooltips are OS‑styled and delay‑triggered; they cannot be made to match anything else on the
  page. Put the accessible name on **`aria-label`** on the `<svg>` instead: identical announcement to
  assistive tech, nothing painted on hover. (`<title>` in the document `<head>` is the browser tab
  label and is unrelated — keep it.)

### 11.2 Absent by default (MUST NOT add unless asked, or unless `interactive` is set)
Interactive zoom/pan/reset, node click/drill‑down, tooltips/pop‑ups, search/filter/selection, side
drawers, runtime data binding. The default diagram is **static**: all detail is surfaced via role/meta
labels, connector labels, the card, and the legend. This is not squeamishness about interaction — a
diagram that only reads when you click it fails the moment it is exported to PNG, pasted into a deck,
or printed, which is where most of these end up.

Interactivity is therefore **opt‑in** and additive (§11.3), never a replacement for the static reading.

### 11.3 Optional interactivity layer (only when `interactive: true`)

Set `interactive: true` in the spec (or hand‑author the equivalent) when the diagram is meant to be
explored in a browser rather than exported. It **MUST** be purely additive:

- **Zero footprint when off.** With `interactive` falsy, none of the CSS, markup, or script below is
  emitted, so the file still structurally diffs clean against the exemplars (§14).
- **Nodes become controls.** Each node is wrapped in `<g class="pf-node" data-id data-type tabindex="0"
  role="button" aria-label>`. Hover brightens; `:focus-visible` shows a ring. Activating one (click,
  Enter, or Space) opens the detail drawer.
- **Connectors become controls too.** Every connector (flow edge, row-wrap, decision no-branch, loop)
  carries `class="pf-edge" data-from data-to data-eidx tabindex="0" role="button" aria-label`.
  Activating one opens the SAME drawer, populated with that connector's source, target, routing
  purpose, transition condition, triggering event, data transferred, business meaning, and downstream
  impact. `data-eidx` is the connector's index into `PF_EDGES` — required because `data-from`/`data-to`
  alone are not unique once a loop retraces an existing flow edge's endpoints. Hover/focus widen the
  stroke slightly as a hit-target affordance; this MUST NOT alter the static (non-interactive) render.
- **Detail drawer is metadata-driven, not a fixed template.** It is the single place a reader goes to
  see everything known about the selected element or connector — it is **not** limited to a
  predefined set of fields. The drawer renders the FULL source-data record for whatever was clicked:
  - **Header** — badge (type), title (with badge number if present), role line.
  - **Incoming / Outgoing Paths** — always shown for elements (including decisions and gateways),
    hidden when a connector itself is selected. Each entry is a button that navigates to the
    connected node, so the drawer walks the graph, plus that edge's label/style as a trailing note.
  - **Dynamic metadata body** — every other field present on the node (or, for a connector, on the
    edge record) is rendered automatically: strings/numbers/booleans as short paragraphs, flat arrays
    as bullet lists, arrays of objects (e.g. a decision's `outcomes`, an integration's contract
    details) as one card per entry with every sub-field listed, and plain objects as key/value rows.
    Recognised field names (role, actors, sourceSystem, businessRules, decisionLogic, kpis, audit,
    outcomes, etc. — see `interactive-drawer-guide.md` for the full list) are grouped under readable
    headings (Overview, Ownership & Actors, Systems & Integration, Data, Business Rules & Validation,
    Decision Logic, Conditions/Triggers/Events, Dependencies & Impact, Outcomes & Exception Paths,
    Notifications & Status, Audit/Compliance/Governance, KPIs/SLAs/Metrics, References). **Any field
    the recognised groups do not claim still renders**, swept into a trailing "Additional Details"
    section — nothing present in the source spec is ever hidden, truncated, simplified, or discarded
    just because the drawer's authors didn't anticipate that field name.
  - This is a **denylist**, not an allowlist: the generator strips only true layout/engine plumbing
    (coordinates, box dimensions, internal config) from a node before handing it to the drawer.
    Everything else the spec author wrote on that node — named field or invented on the spot —
    reaches the browser and is rendered. Adding a new kind of metadata to a spec requires **no
    changes to `template.html`, the generator, or the drawer markup** — it just appears.
  - `Esc` closes the drawer and returns focus to whatever control opened it (node or connector).
- **The drawer pushes, it does not cover.** `body.pf-open` gains right padding equal to the drawer
  width. Overlaying hides whichever nodes sit beneath the panel, and a reader who opens a node to
  understand it must not lose sight of what that node connects to.
- **Resizable** via a `role="separator"` drag handle, clamped 320–760px, also driven by ←/→ keys.
- **Type filters** — one chip per semantic type actually present, plus All, using `aria-pressed`.
  **They must not borrow the diagram's visual vocabulary (r6).** Rounded outlines with small coloured
  dots are what nodes and legend marks look like, so chips styled that way read as a third kind of
  swatch and nothing signals they are interactive. Controls get their own surface: a raised bordered
  bar with an accent rule on its leading edge, separating it from the canvas, and the active chip is
  **filled solid with its own accent** with an inverted label. Nothing inside a diagram is ever filled
  with an accent at full opacity, which is precisely why it reads unmistakably as UI. The funnel glyph
  is drawn with `clip-path`, not an emoji, so it renders identically on every platform.
  Filtering dims non‑matching nodes and any edge with a filtered endpoint; dimmed nodes set
  `pointer-events: none` so a hidden node cannot still open a drawer.
- **Exports always show everything.** `capture()` calls `pfResetView()` first — clearing the filter and
  closing the drawer — and `ignoreElements` excludes `.pf-drawer` and `.pf-filters`. A filtered PNG
  silently loses nodes while still reading as the complete picture, which is worse than no filter.
- **Accessibility and print.** All motion sits behind `prefers-reduced-motion`; `@media print` hides the
  drawer and filters.

State is held in memory only — no `localStorage`, so the file behaves identically when opened from
disk, served, or embedded in a sandboxed frame.

---

## 12. Accessibility (baseline MUST, production SHOULD)

- **MUST:** semantic `h1`; `aria-label` on the toolbar toggle; high‑contrast primary text; single pulse animation; type conveyed by **glyph (👤/⚡/🔗) + label**, never colour alone.
- **SHOULD (production):** give the SVG `role="img"` (static) or `role="group"` (interactive) plus an
  `aria-label` naming it — **not** `<title>`/`<desc>` children, which render as tooltips (§11.1) — and an
  off‑screen textual transcript of the flow; visible focus ring on export buttons; guard the pulse with `prefers-reduced-motion`; verify 7–9px `#6b7280`/`#6b7280` labels hold contrast at 2× export scale.

---

> **Header/footer chrome:** the page renders the title row and the export toolbar only.
> There is no visible subtitle line and no footer credit line. `spec.subtitle` is still read,
> but only to build the diagram's accessible description — dropping it from a spec falls back
> to a generic node-count sentence, which is a poorer screen-reader summary. `spec.footer` is
> no longer used for rendering.

> **Decision negative-branch anchor:** the `no` branch always drops into the channel below the
> diamond first, so its final segment is vertical and must terminate on a HORIZONTAL edge of
> the target — top-centre when the target sits lower, **bottom-centre** when the connector
> climbs back to a node on the same row or above. Terminating on the target's left edge (the
> generic entry anchor) makes the arrow read as flow arriving from the previous step in the
> row rather than from the decision, and is non-conformant.

> **Responsive layout (MUST):** `.container` uses `width:100%` with `max-width` as a ceiling,
> and the `<svg>` is fully fluid (`width:100%`, `height:auto`, **no** `min-width` floor). The
> viewBox does the scaling, so the entire diagram is visible at any viewport width and neither
> the page nor `.diagram-container` scrolls horizontally. Setting `containerWidth` as a fixed
> `width`, or restoring a px `min-width` on the svg, reintroduces horizontal scrolling — a
> `min-width` merely moves the scrollbar from the page onto the diagram container.

## 13. Copy‑paste token block (authoritative values)

**The design system is LIGHT.** Light blue page (`#E9F2FE`), the diagram on a white
card (`#ffffff`, 1px `#A4D3FF`, rounded), near-black ink for node titles, and every node type
rendered as a pale tint fill + saturated stroke. There is no dark variant. Node strokes clear
3.0:1 against their own fills and titles clear 15:1, so type survives greyscale printing.


```
ground #E9F2FE | panel #ffffff | border/grid #A4D3FF | rail #11182a/#6b7280 (text #2c2c2c)
ALL fills are SOLID (r3). Each is a pale tint of its own stroke hue on the white card, so the
rendered colour is unchanged — but nothing beneath a node shows through it any more.
text: #1a1a1a ink / #6b7280 neutral / #2c2c2c drawer body
manual   #2e9e6b / #eafaf2        automated   #7c5cd6 / #f3eefc
integ    #9e7513 / #fdf6e0      decision    #d4667f / #fdeef2
terminal #16829a / #e2f6fb        reject-pill: cyan shape + rose stroke
step 160x80 rx8 sw1.5 | container-node dash2,2 + hatch | decision 80x80 rx4 rotate45 tips±57
pill 140x60 rx20 sw2 | badge r12 (linear only, painted AFTER its box) | rail-tag 78x24 rx4 @x9
grid 40x40 @0.5 IN DEFS, NOT PAINTED | markers 10x7 refX9 poly"0 0,10 3.5,0 7" (6 fills)
column stride 220 (x 80,300,520,740,960,1180,1400; +40 when rails are used) | row stride 260 (top 140,400,660,920,1180,1440) | baseline top+40
node text line-height 15 title/title, 17 title/meta, 12 meta/meta, block centred (first = top+(80-block)/2+4)
type scale (r4 TOKENS, override via spec.type): title 12 | pill 12 | meta 11 | role 11 | decision 11
  payload 10 | branch 10 | loop 10 | wrap 10 | legend 10 | badge 10 (exempt from min) | min 10
channel width = max(60, textWidth(payload) + 20 + 14) — box stays 160, only the gap flexes
payload label y = connectorY-9, centred on span | role label y = boxTop-12, anchor end @ boxX+width
gutters 10 L/R | viewBox W = contentRight+10 | svg min-width = viewBox W | container max-width 1920 | .diagram-container: no bg/border/padding
viewBox H = 48 + rows*260 + ~180 legend
primary conn sw1.5 op0.75 colour=source | cycle cyan 6,3 sw1.5 | revision emerald 4,3 sw1 no-marker | exception rose 4,3 | wrap slate 6,3 sw1.5 "continue"
io-card: input border-left #2e9e6b, output border-left #16829a, step-number 28px violet ring
capture: html2canvas scale2 bg#E9F2FE pad32 ignore .toolbar | pdf orient by aspect format[w,h] px_scaling
deps: JetBrainsMono 400;500;600;700 + html2canvas@1.4.1 + jspdf@2.5.2 (keep SRI)
```

---

## 14. Golden exemplars & how to conform

`assets/reference/` holds the four canonical diagrams. When authoring a new diagram:
1. Pick the closest exemplar by shape: **linear + decision + remediation** → `readiness-go-live-gate.html`; **wide multi‑phase event pipeline** → `integration-contracts.html`; **layered swimlane with rails** → `capability-data-flows.html`; **large architecture inventory with hubs/degree** → `agents-master.html`.
2. Copy its structural skeleton (defs, rail tags, node/label pattern, legend, card, script). Do **not**
   copy a painted grid rect — r2 leaves the ground bare (§1).
3. Replace **content only** (ids, roles, titles, meta, payloads, card rows), preserving all geometry, colours, and behaviours in this standard.
4. Run the §0 checklist before delivery.

**Diff‑test (SHOULD):** a conforming output, when structurally diffed against the nearest exemplar,
should differ only in text content and node/row counts — not in CSS, defs, class names, colour tokens,
geometry constants, loop styles, card mechanics, or the export script.
