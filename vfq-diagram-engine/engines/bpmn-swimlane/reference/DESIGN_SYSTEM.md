# Design system (the fixed engine — preserve exactly)

Everything below lives inside `engine_template.html` and must be preserved
verbatim. It is domain-agnostic: it renders whatever `model.json` provides.

## Colour palette (CSS variables) — Vodafone Design System alignment

**This section was rewritten from scratch — everything it previously
documented (ink `#0f1c2e`, portfolio blue `#2b5aa8`, header gradient
`#12233b → #0f1c2e`, etc.) was stale and did not match the shipped engine,
in some cases for several rounds of changes. Treat the table below, not
memory of an earlier version of this file, as authoritative.** Values are
cross-checked directly against the `brand-guidelines-vodafone` skill's
token set (colors/typography/spacing/radius/elevation), not re-derived —
see that skill for the full palette, accessibility audit, and gap analysis
this table draws from.

| CSS var | Value | Vodafone token | Match |
|---|---|---|---|
| `--ink` | `#1f1f1f` | `text.primary` | exact |
| `--ink2` | `#4a4d4e` | `text.secondary` | exact |
| `--muted` | `#6f7375` | `text.muted` | exact |
| `--line` | `#d8d8d8` | `border.default` | exact |
| `--line2` | `#eeeeee` | `border.soft` | exact |
| `--bg` / `--panel` | `#ffffff` | `background.white` | exact |
| `--panelalt` | `#f2f2f2` | `background.light_neutral` | exact |
| `--surface-warm` | `#fff1f1` | `background.warm_surface` | exact |
| `--accent` | `#e60000` | `primary.brand_red` | exact |
| `--charcoal` | `#25282b` | `surfaces.charcoal_panel` | exact |
| `--charcoal-2` | `#1a1c1e` | — | derived (darker gradient stop; no Vodafone equivalent) |
| `--pg` (agent node / data-flow edge) | `#3860be` | `accent.signal_blue` | exact |
| `--start` (start-event node) | `#008a00` | `semantic.success` | exact |
| `--end` (end-event node) | `#ac1811` | `primary.deep_red_secondary` | exact |
| `--err` (error node/edge) | `#bd0000` | `semantic.danger` | exact |
| `--esc` (escalation node/edge) | `#f5b400` | `semantic.warning` | exact (used only as a stroke/fill, never as text-on-white — the skill's audit flags warning as failing text contrast) |
| `--sys` (system node) | `#4a4d4e` | `text.secondary` | exact |
| `--dec` (decision node) | `#8a5cc9` | — | **gap**: Vodafone's real palette has no purple; retained as the only distinguishable hue left for a 10-category node-type system built from a red/blue/green/amber/grey palette |
| `--ai`/`--val` (validation node) | `#178a86`/`#2b8a8f` | — | **gap**: same reasoning — teal retained, no Vodafone equivalent |
| `--ext` (external-actor node) | `#d46e08` | — | **gap**: deliberately distinct from `--esc`'s amber so escalation and external-actor never look identical; no Vodafone equivalent |

**Gap-analysis note**: Vodafone's own skill explicitly flags "No
data-visualization/chart palette" as a known gap and recommends deriving
from the core tokens where one is genuinely needed. A BPMN diagram needs
~10 visually-distinct node-type colours; Vodafone's real palette provides
enough distinct hues for 6 of them exactly (the rows marked "exact" above).
The remaining categories (decision, validation, external) keep their
previously-chosen, harmonically-fitted but off-palette hues rather than
collapsing multiple node types onto the same colour, which would be a
worse outcome than an acknowledged, documented gap.
- header gradient `var(--charcoal) → var(--charcoal-2)` (`#25282b → #1a1c1e`)
- typography: `"Inter","Segoe UI",system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif` — Inter is Vodafone's documented typeface (the skill flags it as an ASSUMPTION substitute for Vodafone's proprietary corporate face pending licensed font files)
- motion: `--ease-standard` is Vodafone's own `cubic-bezier(.2,0,0,1)` (not a generic Material curve); UI transitions run at 150ms (`duration_fast_ms`) or 220ms (`duration_base_ms`, the drawer slide) — both exact Vodafone motion tokens
- spacing/radius: header/button/drawer/legend/export-menu chrome padding and gaps are drawn from Vodafone's 4px base scale (`--space-1` 4px … `--space-9` 48px) and radius scale (`--radius-button` 2px, `--radius-card` 6px, `--radius-sm` 8px, `--radius-pill` 9999px) — see `:root` in `engine_template.html` for the full token list. **These tokens apply only to HTML chrome** (header, buttons, drawer, legend footer, export dropdown) — never to the SVG canvas's own layout constants (`PAD_X`/`PAD_Y`, column/row sizing, connector clearances, node dimensions), which are content-geometry governed by `build_model.py`/`layout_model.py`, not presentation, and are out of scope for any visual-design-only change.

## Lane bands
- **No background tint, and no left accent stripe either.** A prior
  version tinted each lane at 0.85 opacity; that tinting was removed
  entirely in one round, replaced with a compact 4px left accent stripe
  (a colour-key rather than a full-width fill); that stripe has now been
  removed too, per an explicit "remove the coloured strip on the left side
  of each lane" requirement. Lanes carry no colour cue of any kind any
  more — separated purely by the divider line below. `LANECOL`/`LANEPAL`
  (the Vodafone-mapped lane colour palette) and `laneCol()` (the lookup
  function that read from them) have all been removed from the engine
  entirely, since the accent stripe was their only remaining consumer —
  genuinely dead code once it went, not left orphaned "just in case."
  Node/connector styling never depended on either the lane tint or the
  stripe being present, so nothing about how content renders inside a
  lane needed to change.
- **Divider between lanes is `#E3E3E3` at 1.5px** — a deliberately subtle,
  near-background tone (darkened slightly from a prior `#F5F5F5`). Full
  history: `#dde4ec` (original, back when lane tints were still present)
  → `#b9c2cc` (darkened, since the tint needed real contrast to separate
  two similarly-light bands) → `#F5F5F5` (lightened again once tints and
  the accent stripe were both removed, deliberately subtle rather than
  contrast-driven) → `#E3E3E3` (current — a further deliberate adjustment
  in that same subtle-not-contrast-driven spirit, just a shade darker).
  Matches the vertical stage-separator colour (see "Phase headers" below)
  so both kinds of separator line in the diagram share one consistent
  value — not a value re-derived from any contrast calculation.
- **Lane names render vertically — rotated -90°, reading bottom-to-top —
  wrapping to up to 2 side-by-side columns instead of truncating with an
  ellipsis, matching a supplied reference layout.** A prior version
  rendered names horizontally, wrapped onto up to 3 lines with hints
  wrapped onto up to 2 beneath them; that entire horizontal/wrapped
  treatment was replaced with a single rotated line, truncated via
  `truncate1()` if it didn't fit — but a later requirement ("wrap instead
  of truncating") meant swapping `truncate1()` out for `wrapTextPx()` (the
  same generic word-wrap helper node titles use), allowing a name too long
  for one rotated line to wrap to a second line/column rather than losing
  content to an ellipsis. `truncate1()` itself has since been removed
  entirely — genuinely dead code once its one remaining caller (this lane
  name) moved to `wrapTextPx()` instead. See the column-layout bullet
  below for exactly how a wrapped name's lines are positioned (shared with
  the hint's own column, once reintroduced).
- **`wrapTextPx()` had a genuine content-loss bug, found and fixed while
  implementing the above — worth knowing about since this function is
  also used for node titles, not just this new lane-label caller.** The
  original single-pass version tracked line-building state inline: once
  `maxLines` was reached mid-wrap, it captured the not-yet-placed leftover
  word(s) into a separate variable and later used THAT to overwrite the
  last already-completed line — discarding that line's real, correctly-
  wrapped content rather than folding the leftover into it. Concretely:
  wrapping "Digital Channel / Self-Service Portal" to 2 lines at a narrow
  width produced `["Digital Channel /", "Portal"]` — "Self-Service" was
  silently gone entirely, not truncated-with-ellipsis, just absent, even
  though the function's own comment claimed it "never silently drops a
  line." The fix rewrites this as two clean passes: first wrap ALL words
  into as many lines as genuinely needed with no line-count limit at all
  (`allLines`), THEN — only if that produced more lines than allowed —
  join the EXCESS lines' words back into one string and ellipsis-truncate
  that combined remainder as a single unit appended to the last kept
  line. Nothing is ever computed from a word in isolation from the line
  it actually belonged to, so a leftover can no longer overwrite a
  completed line's content. The same input now correctly produces
  `["Digital Channel /", "Self-Service Por…"]` — every real word either
  fully visible or visibly truncated with "…", never silently dropped.
- **Truncation (wrap-then-truncate for the name; truncate-only for the
  hint) measures against the lane's HEIGHT, not the gutter's WIDTH — a
  fundamentally different axis than before, since the text's own "length"
  now runs vertically.** The full, untruncated name AND hint are both
  still carried as a native SVG `<title>` hover tooltip fallback for
  anything still too long even after the on-canvas wrapping/truncation —
  drawn directly in the SVG (`#svgLaneGutter`); there is no separate
  sticky HTML overlay any more (a prior version pinned the gutter via a
  `position:sticky` HTML twin of this same content; that mechanism, and
  the JS that kept it in sync with pan/zoom, have both been removed
  entirely — see "Header & navigation" below). **Hints render inline
  again, as an additional rotated column after the name's own column(s)**
  — reintroduced per an explicit "display the sub-headings too"
  requirement, having been dropped entirely for a round in between (the
  initial vertical-orientation change left no room for a second element
  beside the rotated name at all). Both hint sources (a lane-name-embedded
  `"Lane Name · hint text"` and a separate `hint` field) are combined into
  ONE string (joined by " · " when both are present) and shown as a
  single truncated line via `truncatePx()` — not wrapped to 2 lines the
  way the name is, since the name's own up-to-2-column budget already has
  to share the gutter with the hint's column; giving the hint the same
  2-line allowance could need up to 4 columns total, more than the gutter
  comfortably fits. `LANE_HINT_FONT` (removed alongside the hint's
  removal, one round) is back too (this round), kept in sync with
  `.lanehint`'s 14px minimum exactly like every other font-measurement
  constant in this file.
- **Name and hint columns share ONE consistent layout scheme — every
  rendered entry (name line or hint line alike) is positioned the same
  way.** Each is its own independently-rotated text element, offset along
  the gutter's WIDTH (`gutterCx + (i - (n-1)/2) * COL_GAP`, `COL_GAP`
  20px, computed over the TOTAL entry count `n` — name lines plus the
  hint line together, not separately) — with `n` entries, they straddle
  the gutter's own centre symmetrically; a single entry sits exactly on
  that centre. All are centred vertically on the lane's own midpoint via
  `transform="rotate(-90 cx cy)"` applied around each entry's own centre
  point. Name columns always come first (closer to one side), the hint
  column last.
- **Gutter width is not fixed at 100px** — `layout.laneLabelW` (from
  `model.json`) sets it. 100px is only the `compute_layout()` default —
  widened from an intermediate 80px once the hint came back as a third
  column needing its own share of the gutter (80px itself was up from 60,
  when 2-column name wrapping was added; originally 190, sized for
  horizontal wrapped text before the rotation). **Widening `laneLabelW`
  still does NOT give a long lane name or hint more room to display
  before wrapping/truncating** — that
  conceptual shift happened when names started rendering vertically at
  all: a name's fit is bounded by the LANE'S HEIGHT (how many wrapped
  lines/columns fit vertically isn't the constraint — how much of the
  text fits within `L.h` per line is), not by `laneLabelW`, so widening
  the gutter only affects the rotated columns' spacing/padding, never
  their truncation point. See SKILL.md's hand-authoring guidance for what
  to actually do about a name that's still getting truncated even after
  wrapping to 2 lines (shorten it further, rely on the tooltip, or note
  that a taller lane gets more per-line room as a side effect of having
  more content).

## Phase headers
- Dark navy pill per phase group; upper-cased title, centre-aligned; title
  wraps to a second line only if it does not fit. **No numeric badge** — a
  prior version prefixed each heading with a small numbered circle (1, 2,
  3…) counting phase *groups*; that badge has been removed entirely, per
  an explicit "display only the stage name" requirement. The title is now
  centred on the bar's own midpoint directly, rather than offset to leave
  room for a badge that no longer exists.
- **Consecutive phase columns sharing an identical label are merged into one
  spanning header** rather than repeating the label once per underlying
  column. **A divider guide line is drawn at every group boundary,
  including before the very first stage** — a prior version skipped that
  leading boundary (only drawing dividers *between* groups, via an
  `if(gi>0)` guard), leaving the first stage with no boundary line on
  either side while every other stage had one on both. Since the first
  group's own starting x-coordinate is already exactly `LY.x0` (the
  content area's own left edge), removing that guard draws the leading
  separator in exactly the right place with no special-casing needed.
- **Divider lines — both the vertical stage separators here and the
  horizontal lane dividers in "Lane bands" above — are `#E3E3E3` at 2px
  with a `4 3` dash pattern** (for the vertical ones; lane dividers are
  1.5px solid). Full history: `#eeeeee` (judged too faint to read as a
  stage boundary at a glance) → `#9aa1a8` (darkened to fix that) →
  `#F5F5F5` (lightened again for a deliberately subtle, non-contrast-
  driven look, once lane tints were removed) → `#E3E3E3` (current — a
  further deliberate darkening within that same subtle-not-contrast-
  driven spirit). Both separator types have shared one colour value since
  the `#F5F5F5` round; before that they were tuned independently.
- Column boundaries are not always a uniform width apart: a connector label
  too wide for the raw gap between two adjacent-phase nodes widens that
  specific boundary (see "Connectors" below), and phase headers track the
  same per-boundary shift so they stay aligned with their columns.

## Node types (shape · fill · stroke)
- start / end: circle · green/red tint
- agent: rounded rect (r=11) · white · blue
- control: rounded rect · amber tint
- decision: diamond · purple tint
- validation: hexagon · teal tint
- system: rect with top rule · slate
- external: parallelogram · amber tint
- error / escalation: rounded rect, 2.2px border · red / amber
- **selected: brand-red (`--accent` `#e60000`) stroke 4px + soft red glow
  (`drop-shadow(0 0 6px rgba(230,0,0,.65))`); never dimmed by hover.** This
  corrects a prior spec/implementation mismatch: this document previously
  described selection as a magenta stroke, but the shipped engine actually
  used the signal-blue identity colour (`--pg`) — which had low contrast
  against the many blue-stroked `agent` nodes and portfolio-lane tints
  already on the canvas, since that hue was already doing double duty as a
  node-type colour. Brand red is otherwise reserved on this canvas for
  selection/active-path emphasis and the header/phase-badge accents, so it
  now reads unambiguously as "the thing that's currently active" instead of
  blending into the diagram's own colour vocabulary. Stroke width (4px, up
  from 3.5px) and glow radius are both increased for stronger prominence at
  any zoom level. Treat brand-red-for-selection as the corrected, actual
  invariant — not the magenta this document used to describe.
- **Label text is wrapped by measured pixel width**, not a character-count
  threshold, against each shape's actual usable width at vertical-centre (a
  diamond is narrower there relative to its bounding box than a rect is).
  Content that still overflows after wrapping is folded into the final line
  and ellipsis-truncated — it is never silently dropped.
- **A node with zero outgoing edges that isn't type `end`** is flagged in its
  side drawer ("Leads to" shows an explicit notice) rather than the section
  just being empty — treat this as a signal to check whether the model has a
  genuine gap, not something to suppress.

## Connectors
- sequence: solid slate 1.7 · data: dashed blue (5 4) · conditional: dotted purple
- escalation: solid amber 2 · error: dashed red (4 4)
- **Direction is classified by `phase`, never by pixel position** —
  `phase(to) > phase(from)` is forward, `phase(to) === phase(from)` (a
  different node) is lateral, `phase(to) < phase(from)` is backward. A prior
  version classified by raw x-coordinate instead, which meant any same-phase,
  cross-lane edge (e.g. an escalation from one lane back into another lane in
  the same stage) was misclassified as backward and routed through the loop
  channel — producing connectors that detoured to the bottom of the entire
  canvas for what was really a one-lane hop. This is now a permanent
  invariant of the engine, not an implementation detail: any future change to
  edge routing must classify by `phase`.
- forward edges route with an orthogonal elbow; backward/loop edges route
  through a reserved bottom "bus" band; **lateral edges (same phase,
  different lane) route with a short, direct vertical connector between the
  two lanes** — never through the bus band, and never budgeted into its
  height calculation; arrowheads per flow kind; edge labels render above
  nodes, always visible (no toggle any more — see "Interactions" below).
  **Labels have a white background halo, restored after a brief round
  without one.** A prior version painted a 4.5px white stroke halo behind
  each label (`paint-order:stroke`) as a soft pill/background effect to
  keep small bold text legible against whatever it crossed; that halo was
  then removed entirely for a round (switching to italic, regular weight,
  no background at all, in exchange for reading as "lighter and less
  visually intrusive" — at the accepted cost of a label being able to
  visually cross a connector or another element with nothing separating
  them). The white halo is now back (`paint-order:stroke;stroke:#fff`),
  restoring legibility against crossed content — but the italic/regular-
  weight/dark-grey styling from the round in between was KEPT, since only
  the background was asked to return, not the original bold weight. Net
  effect: a label reads as lighter/secondary via its typography (italic,
  not bold) while remaining fully legible against anything it crosses,
  via the restored halo. The JS measurement constant used for label-width
  calculations (column-shift spacing when a label is wider than its raw
  column gap) stays at the italic/400 style — the halo widens a label's
  visual footprint but not its measured glyph-advance width, so this
  constant was already correct through both the halo's removal and its
  return.
- **Arrowhead orientation always matches the connector's own final-segment
  direction — this is an explicit, load-bearing invariant, not an
  incidental side effect of SVG marker mechanics.** `marker-end` orients an
  arrowhead automatically via `orient="auto"`, rotating to match whatever
  direction the path is actually travelling at its terminal vertex — but
  that only produces a CORRECT-looking arrow if the engine's own path
  construction ensures the final segment's direction actually matches the
  attachment side the arrow is meant to represent. Concretely: a vertical
  final segment must point up for a bottom-to-top flow and down for
  top-to-bottom; a horizontal final segment must point right for
  left-to-right flow and left for right-to-left. Every path-building
  function in this engine is responsible for making its OWN final segment
  correct, not for suppressing or overriding the marker's orientation — two
  defects were found and fixed specifically here (see the lateral-edge
  entries below): a channel-offset jog whose final segment was horizontal
  even though the attachment was conceptually top/bottom, and a lateral
  channel-grouping rule that forced an unnecessary elbow (hence an
  incorrect final-segment direction) onto edges that had no genuine need
  for one. If you add a new routing shape to the engine, verify its final
  segment's direction matches the attachment side before shipping it — a
  path that's geometrically correct end-to-end but wrong in its LAST
  segment still produces a visibly wrong arrow.
- **Lateral edges get the same obstacle-avoidance treatment as forward
  edges, transposed to vertical travel, and obstacle status is now decided
  independently of channel-offset grouping, not the other way around.** A
  prior version assumed any 2+ lateral edges sharing a lane-pair-and-phase
  key always visually coincide and need separating — true for edges
  genuinely running between two DIFFERENT fixed lanes, but false when
  several nodes are stacked in the very same lane at the very same phase
  (a source with multiple same-phase, same-lane targets: `isLateral()` only
  checks phase and id, not lane). Two such edges can have completely
  different, non-overlapping y-spans — a short hop to a near sibling vs. a
  long reach past that sibling to a farther one — and once the farther one
  is obstacle-routed via a side-edge attachment (see below), it no longer
  even leaves the source from the same boundary point as the short edge, so
  there's no real conflict left to separate. Forcing a channel offset onto
  the short, genuinely-unblocked edge anyway produced an unnecessary elbow
  with multiple direction changes where a single straight connector was
  correct. Obstacle status is now computed per edge, using its natural
  (unoffset) column, BEFORE any channel grouping: an edge with a genuine
  obstacle is excluded from channel grouping entirely (it routes
  independently via the side-edge branch, which avoids collision with any
  lane-mate by construction); the remaining unblocked edges in a group are
  then separated using the SAME span-overlap interval-scheduling the
  backward bus uses (forward edges crossing a phase gap now use a
  different, even-distribution-across-full-width strategy instead — see
  above — but that technique doesn't transfer here: lateral edges have
  fixed lane positions rather than a variable-width column corridor, so
  detecting genuine y-range conflict via interval-scheduling, same as the
  backward bus, is the right fit) — only edges whose y-spans genuinely
  overlap get distinct channels — not a blanket "any 2+ conflict"
  assumption. An unblocked edge with no genuine sibling conflict now
  renders as a single straight line, same as it always should have.
- **When a lateral edge must detour around a literal obstacle, it
  approaches BOTH ends via their LEFT or RIGHT edge, not top/bottom.**
  Clearing the obstacle by only 24px and then jogging back into the
  target's top/bottom edge produces a "swings out, swings back in right
  next to the node it passed" shape — even with full `OBSTACLE_CLEARANCE`,
  that final return-to-centre segment sits close enough to the obstacle
  that it can read as ambiguous about which node the line actually
  connects to (this is exactly the pattern a reader flagged: two escalation
  edges from one source, one direct and one detouring around the direct
  one's own target, looked like they might both originate from the nearer
  node). The fix isn't more clearance — it's not re-entering the natural
  column at all: `lateralEdgePath()` now attaches both the source and
  target via their LEFT or RIGHT edge, at each node's own vertical centre,
  whenever a literal obstacle forces a detour, so the whole run reads as
  one deliberate side-approach rather than a last-second correction. This
  only applies to the obstacle-driven case — a lateral edge that's merely
  offset for channel separation, with no literal obstacle in its path,
  keeps the simple top/bottom-to-top/bottom jog (that case was never the
  source of any reported ambiguity, so it isn't touched).
- **A channel-offset lateral edge's arrowhead now actually points
  vertically, matching its top/bottom attachment.** The channel-offset jog
  used to end `L${travelX},${ty} L${tx},${ty}` — a final segment that runs
  HORIZONTALLY (only x changes; y stays at `ty`) whenever `travelX != tx`,
  which is exactly whenever a channel offset is doing anything at all.
  `marker-end` orients the arrowhead to match the path's own final-segment
  direction, so that horizontal last leg pointed the arrow sideways instead
  of up/down into the target's top/bottom edge — visibly wrong for an
  attachment that's still conceptually top/bottom (unlike the obstacle-
  detour case above, which deliberately switches to a horizontal, side-edge
  attachment where a horizontal arrow IS correct). The fix is a short
  vertical "lead-in" stub immediately before the target (and a matching
  "lead-out" stub immediately after the source): the horizontal correction
  back to `tx` now happens one stub-length above/below `ty` instead of
  exactly at `ty`, so the path's actual final segment is a clean vertical
  run into the boundary. Stub length is `min(16, |ty-sy|/3)` (with a 4px
  floor) so it can't overshoot past the opposite endpoint on a very short
  span. Verified against every lateral edge in the reference sample: every
  plain top/bottom attachment now ends with a vertical final segment, and
  the one obstacle-driven left-edge attachment in the same sample correctly
  still ends horizontal — the fix doesn't blur the two cases together.
- **Backward/loop track assignment is span-overlap-based**, not a fixed
  rotation: two loop-back edges whose horizontal ranges don't overlap can
  share a track; edges that do overlap get distinct tracks. The canvas grows
  vertically to fit however many tracks are genuinely needed. Track spacing
  is `BACK_TRACK_GAP` (16px, widened from 12px for clearer separation between
  parallel loop-back lines sharing the bus band). **Clearance from the last
  lane to the bus band, and from the bus band to the diagram's own bottom
  edge, is 70px (widened from 52px), with a 30px final buffer (widened from
  20px).** The bus channel was always mathematically within the SVG's own
  declared bounds even at the tighter margins (`ch = LY.totalH - clearance -
  track*BACK_TRACK_GAP` is self-consistent regardless of the clearance
  value), but a tight margin reads as "this connector hangs off the edge of
  the diagram" even when it technically doesn't — especially now that lanes
  carry no background tint (see "Lane bands" above) to visually confirm
  where the diagram's content genuinely ends. More generous clearance on
  both sides removes that ambiguity without changing the underlying,
  already-correct math.
- **Obstacle clearance is wide enough to read as unambiguous, not just
  wide enough to not touch.** `OBSTACLE_CLEARANCE` was 14px; that's enough
  for a detoured connector to not geometrically overlap the node it's
  routing around, but not enough to keep a reader from reasonably asking
  "wait, does that line connect to this node?" — a line running only 14px
  outside a node's full-height edge, especially once connectors paint on
  top of nodes (so the near-miss is fully visible rather than partly
  hidden), visually reads as ambiguous about what connects to what. This
  showed up concretely: two escalation edges from one source (one to a
  near target, one to a farther target whose path had to detour around the
  near target's own box) were close enough that it wasn't obvious from the
  rendering alone whether the farther edge originated from the source or
  from the near target it was routed past. `OBSTACLE_CLEARANCE` is now
  24px, applied identically everywhere a connector detours around a node
  it isn't connected to (`obstacleOnRow`'s forward-edge case,
  `obstacleOnColumn`'s lateral-edge case, and its retry pass if clearing
  the first obstacle reveals a second one) — one named constant, not three
  independent hardcoded numbers, so this can't drift out of sync the way
  `X0`/`laneLabelW` once did.
- **Connector labels participate in column spacing.** A label between two
  directly-adjacent phase columns that's wider than the raw node-to-node gap
  widens that column boundary (and shifts every later column) instead of
  overflowing into the nodes on either side.
- **Parallel connectors sharing a corridor are given dedicated, evenly
  distributed lanes across the corridor's full available width — not just
  the minimum separation needed to avoid a literal collision.** Every
  forward edge crossing a given phase gap bends at essentially the same x
  by construction (the midpoint between the two nodes' facing edges), so
  with no correction, two or more independent connections draw directly on
  top of each other — indistinguishable from clutter and impossible to
  trace individually. A prior version only separated edges whose y-ranges
  actually overlapped (span-overlap interval-scheduling, mirroring the
  backward bus), sharing a single channel among any edges with no literal
  conflict — a valid minimal-lanes strategy, but it produced inconsistent
  spacing: two edges 40px apart in y might get spread only 13px apart while
  two edges 200px apart in a busier phase gap landed in the same channel.
  Per the routing spec, every forward edge that shares a phase-to-phase
  corridor with at least one other edge now gets its own dedicated lane,
  placed at one of `n+1` equal divisions of the corridor's SHARED safe
  window — the largest "source right edge" and smallest "target left edge"
  across every member of the group, so a lane position is guaranteed valid
  for every edge that could use it, even though node widths vary by type
  (a decision diamond vs. an agent rounded-rect) and so each edge's own
  individually-valid range differs slightly. `n` edges get `n` lanes with
  equal margin at both ends of the corridor and equal spacing between every
  adjacent pair — verified against a 4-edge corridor in the reference
  sample: bend positions landed at exactly `corridorLeft + k·width/5` for
  k=1..4, with adjacent gaps identical to two decimal places. Members are
  ordered by their own vertical midpoint before lane assignment, so lane
  order follows top-to-bottom visual order and adjacent edges don't need to
  cross each other's lanes to reach their own row. A corridor with only one
  member is untouched — a lone edge keeps its original single, clean bend
  at the natural midpoint, since there's no sibling to distribute lanes
  against, so diagrams with no genuine congestion look exactly as before.
  Lateral edges (item 15 above) keep their own separate, previously-fixed
  channel-assignment logic — this even-distribution redesign is specific
  to forward edges crossing a phase gap, per the "adjacent columns" framing
  of the spec that motivated it.
- **A lateral edge's obstacle-avoidance detour also checks against every
  registered FORWARD-edge bend column, not just NODE obstacles.** The
  forward-edge corridor distribution above and this lateral obstacle-
  avoidance branch are computed entirely independently of each other — a
  forward edge's evenly-distributed lane position (or even a lone forward
  edge's natural, undistributed bend point) can coincidentally land only a
  few px from wherever a lateral edge's detour needed to travel, and until
  now neither system had any way to notice. The result: two connectors
  from unrelated flows running parallel and only ~17px apart for their
  entire shared vertical extent — not a brief, harmless crossing point, but
  a sustained "not distributed relative to each other" defect, distinct
  from (and orthogonal to) the sibling-separation problems item 15 and 17
  already solve within their own edge type. Every forward edge's bend
  column (x + the y-span it actually occupies) is now registered in a
  shared `fwdCorridors` list as soon as it's computed; `lateralEdgePath()`'s
  obstacle-detour branch checks this list in addition to `obstacleOnColumn`
  against real nodes, and pushes further out (by another
  `OBSTACLE_CLEARANCE`) if a forward corridor genuinely overlaps in y within
  clearance distance — re-checking for a node collision afterward, since
  the push could land back on one. Verified against the case that surfaced
  this: a forward edge's corridor and a lateral edge's detour that
  previously ran 16.7px apart for a 184px shared span now sit a full
  `OBSTACLE_CLEARANCE` (24px) apart, with every other fix (obstacle
  avoidance, arrowhead orientation, boundary attachment) unaffected.
- **Connectors and their arrowheads paint on top of node shapes, not
  underneath them.** `nodeLayer` used to be appended to the SVG after
  `edgeLayer`/`labelLayer` purely as an artifact of build order (edge
  geometry needs finished node coordinates, so edges are computed first) —
  but that made z-order match compute order, so every node's opaque
  fill/stroke rendered ON TOP of every connector and arrowhead. Since every
  arrow terminates exactly at a node's boundary by design, and a node's own
  boundary stroke is centred on that same coordinate (bleeding slightly
  outward past it), the node's border painted over the finest, sharpest part
  of the arrowhead tip at every single connection — the exact defect
  pattern of "arrowhead half-buried under the activity box", "connector
  penetrating the border", and inconsistent-looking attachment spacing that
  varied with each node type's own stroke width (1.5px agent vs 2.2px
  error/escalation). The fix is one `vp.insertBefore(nodeLayer, edgeLayer)`
  call once both layers are built — node/edge geometry computation is
  untouched, only the paint order changes — so every connector and
  arrowhead now renders cleanly on top of any node it touches.
- **A forward edge's straight run never passes invisibly behind another
  node.** Cross-lane edges run horizontally at the source's row before
  jogging to the target's row; if an unrelated node sits in that row between
  the source and the jog point, the run would otherwise pass directly behind
  it. Connectors now paint on top of nodes (see above), so the line stays
  visible rather than being hidden — but running straight through an
  unrelated node's body still reads as a spurious connection to that node,
  which is exactly as wrong as before. `obstacleOnRow()` detects this and
  detours the run `OBSTACLE_CLEARANCE` (24px, widened from 14px — see
  below) above or below the obstacle, on whichever side the
  edge is already heading.
- **Row order within a lane/phase bucket is optimised, not left at raw
  insertion order.** `build_model.py`'s `_barycenter_reorder()` runs a
  two-direction (predecessor-keyed left-to-right, then successor-keyed
  right-to-left) Sugiyama-style barycenter sweep across two full iterations,
  reordering each `(lane, phase)` bucket's `slot` values so a node's row
  tracks the average row of its already-placed adjacent-phase neighbours.
  Lane assignment and phase assignment are both untouched — this only
  changes *which row within its own lane* a node occupies — so no data-driven
  placement decision is overridden, only the previously-arbitrary "row order
  came from whatever order the source sheet/script happened to list nodes
  in" default. This is what minimises total connector vertical travel and
  keeps orthogonal routing looking deliberate rather than "unbalanced": with
  raw insertion order, two connected nodes in adjacent phases frequently
  landed in unrelated rows purely by coincidence of list order, forcing a
  full-height vertical jog on every such edge even though nothing about the
  data required it. Nodes with no adjacent-phase neighbours keep their prior
  relative order (a stable sort), so isolated nodes are never shuffled
  without reason. `compute_layout(N, LANES, PHASES, F)`'s new fourth
  parameter (the flow list) is optional — omitting it (or passing `None`)
  reproduces the previous insertion-order behaviour exactly, so this is
  backward compatible with any hand-authored path-B script that predates it.
- **Every model.json is validated for connector integrity before it's
  rendered** (`scripts/validate_model.py`, run automatically by `render.py`).
  It catches dangling `from`/`to` references (which the engine would
  otherwise drop silently — see `FLOWS.forEach`'s `if(!a||!b)return;`), nodes
  missing their `phase` field, and decision `branches[]` metadata that claims
  an outcome with no matching flow. See `SKILL.md`'s numbered invariant list
  (item 9) and the validator's own docstring for the full defect catalogue.

### Connector compliance summary

Every connector-quality rule that's been audited against this engine (arrowhead
visibility/centring/termination/orientation, orthogonal-only routing,
boundary-only attachment, side-selection by relative position,
obstacle/label/lane-title clearance, inter-connector spacing — both within an
edge type and across different edge types, z-ordering, alignment) is satisfied
by construction, verified against a live-rendered sample via automated DOM
inspection (not just source-reading):
- **Attachment points**: every edge's start/end coordinate is computed
  directly from a node's boundary (never its centre) — forward edges use
  the source's right edge / target's left edge; lateral edges use
  top/bottom when unobstructed, or LEFT/RIGHT edges (at each node's own
  vertical centre) when an obstacle forces a detour (item 20 in SKILL.md);
  backward/loop edges use both nodes' bottom edges into the reserved bus.
  Verified: 0 of 36 endpoints (18 flows × 2) failed a "does this point lie
  exactly on the node's own perimeter" check on the reference sample.
- **No penetration**: obstacle-avoidance (`obstacleOnRow`/`obstacleOnColumn`)
  runs for every non-adjacent node a path's segments could cross, regardless
  of whether the deviation came from a literal obstacle or a channel
  offset (item 17 in SKILL.md). Verified: 0 penetrations of any unrelated
  node's interior across every edge in the reference sample.
- **Arrowhead visibility/centring/orientation**: markers use `orient=auto`
  with `refX`/`refY` pinned to the path's own terminal vertex, so the tip
  is always exactly centred on the connector's centreline and exactly at
  the boundary coordinate; `nodeLayer` paints before `edgeLayer` (item 16)
  so nothing ever covers an arrowhead. Orientation is an explicit,
  verified invariant (item 22), not an incidental side effect: every
  path-building function is responsible for ensuring its own FINAL segment
  points in the direction that matches the attachment it represents.
  Verified against every lateral and forward edge in the reference sample:
  every top/bottom attachment ends with a vertical final segment oriented
  correctly for its flow direction, every left/right attachment (forward
  edges, and lateral edges detouring around an obstacle) ends horizontal
  and correctly oriented, with zero diagonal or misoriented final segments.
- **Orthogonal-only routing**: every path is built from `L` (line-to)
  commands exclusively — no curves, arcs, or diagonals anywhere in the
  engine.
- **Lane-title clearance**: `x0 > laneLabelW` by construction (item 18 in
  SKILL.md) — the gutter can never overlap diagram content.
- **Spacing between adjacent connectors of the SAME edge type**: forward
  edges sharing a phase-gap corridor are evenly distributed across the
  corridor's full available width — one dedicated lane per edge, not just
  enough separation to avoid literal collision (item 15). Verified against
  a 4-edge corridor in the reference sample: bend positions landed at
  exactly `corridorLeft + k·width/5` for k=1..4, with adjacent gaps
  identical to two decimal places. Lateral edges sharing a lane-pair
  corridor use `LAT_CHANNEL_GAP` (13px), applied only where a genuine
  sibling y-range conflict exists — an edge with no real conflict renders
  as a single straight line (item 17). Backward/loop edges use
  `BACK_TRACK_GAP` (16px) via the same span-overlap approach. All three
  combine with obstacle-avoidance so a separated connector still can't cut
  through a third node.
- **Spacing between connectors of DIFFERENT edge types**: the forward-edge
  corridor system and the lateral obstacle-detour system are computed
  independently by default and have no inherent way to know about each
  other — a forward edge's bend column can coincidentally land close to
  wherever an unrelated lateral edge's detour needed to travel. Every
  forward edge's occupied bend column (x plus its actual y-span) is
  registered in a shared `fwdCorridors` list; the lateral obstacle-detour
  branch checks this list in addition to real nodes, pushing further out by
  `OBSTACLE_CLEARANCE` on a genuine, sustained y-overlap — not a brief
  crossing point, which is normal and untouched (item 23). Verified against
  the case that surfaced this: two connectors from unrelated flows that
  previously ran 16.7px apart for a 184px shared vertical span now sit a
  full `OBSTACLE_CLEARANCE` (24px) apart.

## Legend
- One swatch per node type in use, plus one line-sample per connector kind in
  use. Each swatch renders that type's **actual shape** (circle, diamond,
  hexagon, parallelogram, rect-with-rule, thick-border rect) via the same
  shape-definition function the canvas nodes use — the legend cannot drift
  out of sync with what's actually drawn, by construction.
- **"Node types" and "Connector types" always render on separate rows,
  never sharing one** — regardless of how much horizontal space is
  available. A prior version packed both groups into a shared row-wrapping
  pass (only forcing a new row once the combined content overflowed the
  canvas width), so on a sufficiently wide diagram both categories sat side
  by side on one line. Each group now starts its own row unconditionally;
  a single group's own items still wrap onto additional rows if that group
  alone needs more width than the canvas has. A small caps category caption
  (9.5px, 800 weight, muted grey, uppercase, `letter-spacing:.08em`)
  precedes each group's first item.
- **Category-caption width is measured with `getComputedTextLength()` on a
  real, temporarily-attached SVG `<text>` element — never with Canvas's
  `ctx.measureText()`.** `.legcat` carries genuine CSS `letter-spacing`;
  Canvas's 2D context has no way to apply letter-spacing when measuring, so
  `ctx.measureText()` silently underestimates a caption's true rendered
  width by roughly `characters × font-size × 0.08` (~7.6px short for "NODE
  TYPES", ~11.4px short for "CONNECTOR TYPES"). That shortfall previously
  positioned each group's first icon a few pixels inside the tail of its
  own caption text instead of after it — visible as "NODE TYPOS" /
  "CONNECTOR TYPESequence flow"-style overlap in exported files.
  `getComputedTextLength()` is real SVG layout, so it accounts for
  letter-spacing (and anything else CSS does to that text) exactly, by
  construction, with no formula to keep in sync as the style evolves. Note:
  this is a standard, universally-supported real-browser SVG DOM API (part
  of SVG 1.1) — some headless test/DOM environments (e.g. jsdom, used only
  for this skill's own automated verification, never by an end user's
  browser) don't implement it and need a measurement shim for testing
  purposes only; the shipped engine code must keep using the real API.
- **Legend text is 12.5px/600 weight** (up from 11px/400) — previously the
  smallest text anywhere on the page belonged to the one piece of UI every
  reader depends on to decode every shape and line on the canvas. This
  value must be identical in the live `<style>` block, the sticky HTML
  overlay's own inline styles, AND `EXPORT_CSS` (used only for standalone
  exported files) — a prior version updated the first two but left
  `EXPORT_CSS`'s `.leglabel` at the old 11px/no-weight definition for
  several rounds, so every exported file silently rendered outdated legend
  typography with no visible warning that the three were out of sync.
  `EXPORT_CSS` was also missing a `.legcat` rule entirely during that same
  window. Any class change to live legend styling needs its `EXPORT_CSS`
  equivalent updated in the SAME change, not as a follow-up.
- **Vertical spacing above and below the legend is symmetric** — both
  sides built from one shared `LEGEND_VGAP` value (20px), rather than an
  18px gap above and only an 8px gap below (a prior asymmetry that read as
  "too much air above the legend, too little below it before the canvas
  edge"). Verified on the reference sample: top gap and bottom gap both
  measure exactly 20px.
- Rendered as a **fixed-size sticky footer** (pinned to the bottom-left of the
  canvas viewport), not part of the pannable/zoomable content — it uses fixed
  CSS font sizes so it stays legible regardless of zoom level, unlike a
  legend drawn as ordinary canvas content (which would shrink along with a
  tall multi-lane diagram's fit-to-height scale). The sticky HTML overlay
  uses `flex-direction:column` with each category group as its own
  full-width flex row, matching the SVG version's always-separate-rows
  behaviour exactly. The underlying SVG-drawn legend is what appears in
  exported files; the sticky version is a live-view convenience layered on
  top of it. Both share identical grouping/typography so an exported
  file's legend matches the live view exactly.

## Typography & spacing
- UI font: "Segoe UI", system-ui, -apple-system, Arial. Mono: ui-monospace/Menlo/Consolas for codes.
- **Minimum 14px font-size across the diagram canvas** (nodes, connectors,
  lane gutter, phase headers, legend) — a prior type scale ran from 9px
  (hints) to 20px (header), with most canvas text (node sub-labels, lane
  hints, edge labels, phase badge numbers, legend categories) well under
  14px. Every one of those is now 14px flat; only the header `<h1>` (20px)
  sits above the minimum, since it was never below it to begin with. This
  is an explicit trade-off, not an oversight: it removes the size
  distinction a node's own label and its smaller "sub" caption used to
  have (both now read at the same 14px), and it means a small fixed-size
  shape (a circle, a decision diamond) may truncate its label more
  aggressively than before, since the same physical space now holds less
  14px text than it held 9.5-11.5px text. Node/shape dimensions in
  `build_model.py`'s `sizes` dict were NOT enlarged to compensate — the
  existing measurement-driven wrap/truncate/fold logic (`wrapTextPx()`,
  `truncatePx()`) already adapts to whatever font it's given, so nothing
  overflows a shape's boundary; it simply shows less text where a shape is
  too small to hold more at 14px. The JS font-measurement constants
  (`LBLFONT`, `SUBFONT`, `LANE_NAME_FONT`, `PHFONT`, `ELABELFONT`, and the
  legend's own inline `ctx.font` string) are kept in sync with their CSS
  counterparts by design — if you change one, change
  the other in the same edit, or wrapping/truncation will measure against
  the wrong font and miscalculate line breaks.
- **Node title/reference-code spacing increased three times now — each
  prior pass still read as cramped once actually compared against what
  was being asked for.** History: 13px per-line/12px title-sub gap
  (original) → 13px per-line/16px gap (gap widened first, per-line
  spacing untouched) → 16px per-line/23px gap (per-line spacing finally
  addressed, not just the gap) → **20px per-line/30px gap (current)**, a
  full 1.4x line-height relative to the 14px font-size — the low end of
  comfortable reading spacing — plus a correspondingly larger
  title→reference-code gap on top. The half-offset used to vertically
  centre a multi-line title block scales the same way each time (half of
  whatever the per-line increment currently is) so the block keeps
  centring correctly at any of these historical values. Verified against
  the reference sample's actual node sizes: zero nodes currently overflow
  a shape's own boundary at these values, but that headroom shrinks with
  every further increase — check real node heights in `build_model.py`'s
  `sizes` dict before increasing this again, rather than assuming safety.
- Page padding 18px/12px; full-width tables; diagram canvas buffer `PAD_X` 14 / `PAD_Y` 22
  (asymmetric on purpose — horizontal space is the scarce axis; see Layout / grid).

## Layout / grid
- Columns = phases (`colw` 252, default). Rows within a lane = slots (row 92).
  Nodes centred in their cell.
- **`x0` (where the first phase column begins) is derived from
  `laneLabelW`, never an independent constant.** `compute_layout()` sets
  `X0 = LANE_LABEL_W + X0_MARGIN` (20px margin) rather than a separately
  hardcoded number. This exists because the two used to be two independent
  magic numbers that only stayed consistent by coincidence: `LANE_LABEL_W`
  was widened from 150 to 190 in one change without revisiting `X0` (left
  at a hardcoded 150), and every node type wider than ~100px placed in the
  first phase column ended up with a left edge underneath the 190px-wide
  gutter. At the time this was fixed, the lane-label gutter was a
  `position:sticky` HTML overlay layered above the entire SVG canvas,
  completely independent of the SVG's own element order — no SVG-internal
  z-order fix could have solved it. The lane gutter is no longer a sticky
  overlay at all (see "Header & navigation" below — it's now ordinary,
  always-visible SVG content, painted in normal z-order like everything
  else), but the invariant itself is still correct and still enforced: a
  node whose left edge falls under `laneLabelW` would overlap the lane
  gutter's own content and its background rule, which looks wrong
  regardless of which element happens to paint on top (and regardless of
  whether that content is horizontal wrapped text, as it was when this was
  first fixed, or the vertical rotated single line it is now — see "Lane
  bands" above). `x0` must always exceed `laneLabelW` by a real margin; if
  you widen `laneLabelW` by hand for a hand-authored model (see SKILL.md),
  widen `x0` by the same `+ X0_MARGIN` rule rather than picking it
  independently. Current defaults: `LANE_LABEL_W` 60, `X0_MARGIN` 20,
  `X0` 80 (down from a prior 210/190/20 set, back when the gutter needed
  much more width for horizontal wrapped text).
- **The canvas is sized WIDTH-FIRST and always fills 100% of the horizontal
  space inside `.diagram-shell`.** `sizeHost()` (which delegates its actual
  DOM writes to the shared `applySizeAtScale(s)`) computes both fits and
  takes the larger — `s = max(widthFill, heightFill)` — so the diagram can
  never be letterboxed with dead space beside it. One uniform `scale`
  drives both axes, so the aspect ratio is preserved in every branch (there
  is no independent x/y stretch anywhere in the engine).
  - A **wide/flat** model is height-bound (`heightFill` wins): it overflows
    the container's width and the shell scrolls horizontally.
  - A **tall/narrow** model is width-bound (`widthFill` wins): it spans the
    full width; content taller than the shell's own CSS-bounded height
    scrolls WITHIN the shell (`overflow:auto`) rather than growing the
    shell or the page. **This is a deliberate reversal of an earlier
    version of this section**, which had the shell grow vertically and let
    the PAGE scroll past it — that kept width-fill but broke a later,
    equally explicit requirement: all scroll/pan/zoom interaction must stay
    confined to the canvas, with the header and legend footer genuinely
    fixed and unaffected. `body` is a fixed-viewport flex column
    (`height:100vh;overflow:hidden`) so the page itself can never scroll;
    `.diagram-shell` is the one and only scrollable region, sized via
    `flex:1;min-height:340px` (a fixed floor, not a JS-computed budget).
  - Zoom is no longer fixed at the auto-fit value either: wheel-zoom and
    drag-to-pan (see "Interactions" above) let the user move beyond what
    `fit()` computes, clamped to `[0.4×, 6×]` the auto-fit scale
    (`baseScale`) — `fit()` itself still runs automatically on load and
    resize and still recomputes exactly this same width-first scale, it
    just no longer represents a hard ceiling on what the user can reach.
  - Canvas buffer is `PAD_X` 14 / `PAD_Y` 22 — the horizontal axis is the
    scarce one, so it gets the tighter inset. Unchanged by any of the
    above — content-geometry constants, not view-state.
- **No frozen rows or columns.** The lane-name gutter and the phase-header
  bar are both ordinary, always-visible SVG content — they pan and scale
  along with every node and connector inside the `vp` transform, exactly
  like everything else on the canvas; no `position:sticky` HTML overlay or
  pan/zoom-sync JS exists for either. The legend footer is the one
  exception, and for a different reason than before: it is now a plain
  HTML sibling positioned AFTER `.diagram-shell` (not nested inside it) —
  `.diagram-section` is a flex column with `.diagram-shell` (`flex:1`) and
  the legend (`flex:none`) as two separate rows, so the legend never scales
  with canvas zoom, is never scrolled/panned, and sits immediately below
  the shell's own scrollbar rather than covering it (a prior version
  nested the legend inside the shell with `position:sticky`, which put the
  shell's native scrollbar underneath the sticky legend instead of between
  the canvas and the legend). `#legendLayer` (the SVG-drawn version) stays
  hidden live and is restored for exports, same as before.
- **No outer wrapper framing.** `.diagram-shell` has no `border`,
  `border-radius`, `background`, or `box-shadow` of its own — only the
  individual lanes and their content are visible, nothing drawn around
  them. `overflow-x`/`overflow-y:auto` (via the shorthand `overflow:auto`)
  stay, since they're what makes canvas-confined scroll/pan/zoom work.

## Interactions
**This section's pan/zoom/Reset description below was stale — the diagram
was fixed-only for a period of this project's history, but pan, zoom, and
Reset have all since been reinstated per later, explicit requirements.**
Hover-isolation, click-to-select, drag-to-pan, wheel-zoom (mouse wheel and
trackpad pinch, both confined to the canvas), View Details mode, Reset, and
Export are all interactive; the flow-type filter and the "View Labels"
toggle remain removed — connector labels are simply always shown — and
Happy Flow / All Flows is still the one content filter.
- **The canvas can be panned and zoomed, confined entirely to
  `.diagram-shell`; the header, footer/legend, and toolbar are structurally
  unable to move or change scale.** Wheel-zoom (any wheel event over the
  canvas, including a trackpad pinch — delivered by every major browser as
  a synthetic `ctrlKey:true` wheel event — zooms centred on the cursor,
  clamped to `[0.4×, 6×]` the auto-fit scale) and drag-to-pan (pointer
  events delegated to the shell, with a small movement threshold
  distinguishing an actual drag from a plain click so panning never also
  triggers node selection) were both reinstated after the "fully fixed"
  period this section used to describe. **Reset** (leftmost header button,
  before View Details) restores the exact page-load state in one click —
  zoom, pan/scroll position, the Happy Flow filter, click-locked highlight,
  an open drawer, View Details mode, an in-progress drag, and an open
  Export dropdown, all at once. `fit()` still runs automatically on load
  and resize, computing the same width-first auto-fit scale as before;
  Reset re-invokes it after clearing every other piece of view state.
- **There is no flow-type filter.** A prior version let the user toggle
  Sequence/Data/Conditional/Escalation/Error connectors on and off
  individually via a row of buttons (labelled "Flows:") in the toolbar;
  that filter — the buttons, the label chip, the `edgeOn` visibility
  state, and the click handlers that toggled `display:none` on matching
  edges/labels — has been removed entirely. Every connector kind is now
  unconditionally visible; there is no way to hide any of them.
- **Connector labels are always visible — there is no "View Labels"
  toggle any more.** A prior version defaulted labels to hidden
  (`display:none` set at creation) with a button to reveal them; that
  button, its click handler, and the hidden starting state have all been
  removed — `labelLayer` text elements are now created already visible.
  The `.toolbar` row that used to hold this button (and, before that, the
  Flows filter) has been removed from the HTML entirely, since it would
  otherwise be empty — there is no toolbar row above the diagram canvas
  any more at all.
- **Happy Flow / All Flows — a content filter, not a view-manipulation
  control.** A header toggle (the leftmost button in `.header-actions` —
  see "Header & navigation" below) switches between showing the complete
  process ("All Flows," the default state on load) and showing only the nodes/connectors on the
  primary success scenario ("Happy Flow"). Membership is driven by
  `flows[].happy` (see `MODEL_SCHEMA.md` for the full field contract and
  its default-by-`kind` rules); a node counts as happy-path if it's
  touched by at least one happy edge, with no separate per-node field.
  Filtering uses `display:none` — not `.dim`'s opacity fade — since this
  is a genuine content removal (an explicit request to take non-happy-path
  elements out of view), not a hover-style de-emphasis; positions are
  never recomputed, so hidden elements simply leave their own space empty
  rather than the remaining content reflowing to fill it, which is what
  "preserving the overall diagram layout" requires — a reader who has seen
  the full diagram can still recognise where everything sits after
  switching to the filtered view, because nothing that remains has moved.
  Verified against the reference sample: toggling correctly isolates the
  primary 12-node success path from the 4 exception-only nodes (a manual
  fraud reviewer, a secondary compliance reviewer, and their two terminal
  outcomes) and reverses cleanly.
- **Hover a node → isolate its connections.** Unrelated nodes/edges drop to
  `.dim` (opacity **.05**, down from a prior .12 that left background content clearly legible —
  defeating the point of "isolate" — plus a `grayscale(1)` filter so the faint residue reads as
  greyed-out context rather than full-colour content at low volume; these two read very
  differently even at matched opacity) while the isolated path (`.hl` / `.edge.hlpath`) renders
  at full opacity in brand-red (`--accent`) at 3.5px with a soft glow — the same colour language
  as node selection below, so "the thing that's active" is visually consistent whether it was
  activated by hover or by click. **The arrowhead is switched to a matching brand-red marker
  (`ar-hl`) at the same moment the `.hlpath` class is applied, not left to CSS alone.** An SVG
  marker's fill is fixed at the marker's own definition, entirely outside the reach of any CSS
  class placed on the path that references it via `marker-end` — `.edge.hlpath{stroke:var(
  --accent) !important}` correctly overrides the LINE's colour, but on its own leaves the
  arrowhead in whatever colour that edge kind's marker (`ar-data` blue, `ar-esc` amber, `ar-err`
  dark red, etc.) was originally defined with, producing a single connector rendered in two
  different colours along its own route. `highlight()`/`clearHL()` swap each affected path's
  `marker-end` attribute directly (to `ar-hl` on highlight, back to that specific path's own
  original marker — remembered in `p.dataset.marker` at creation time, never re-derived — on
  clear), so line and arrowhead change together, atomically, every time.
- **Click a node → persistent highlight lock, independent of hover, and
  independent of View Details mode.** Clicking toggles a lock (`selectedId`)
  that keeps that node and its connections highlighted until cleared by a
  background click or by clicking a different node. Hovering ANY node while
  a lock is active still shows that node's own preview (not suppressed by
  the lock) and reverts to the locked view on mouseleave — hover and the
  click-lock are deliberately independent, neither overrides the other.
  Selection renders as a brand-red stroke (see "Node types" above); a
  locked node is always excluded from `.dim`, hover or otherwise.
- **View Details mode (header toggle) changes what a click does, layered
  on top of the same lock.** OFF (default): a plain click only toggles the
  highlight lock; the side drawer opens only via double-click. ON: a plain
  click also opens/updates the side drawer, which then stays open across
  further node clicks and survives clicking the empty canvas — only
  turning View Details off (or the drawer's own × button, which turns the
  mode off too) closes it.
- **Export SVG / JPG / PDF (offline, high-res, includes the legend and full
  lane/header content even though the legend is hidden as a sticky overlay
  live). Preserves whatever highlight/selection state is currently active**
  — an export reflects exactly what the user is looking at, not a
  neutral/cleared canvas. Export lives in the page header, aligned to the
  top-right corner (see "Header & navigation" below). Responsive.

## Side drawer (comprehensive context panel — nothing in the model is left unsurfaced)
Sections, in order, each shown only when the underlying data is actually
present (an empty/absent field is omitted silently, never rendered as an
empty section): type + stage + **lane** (the owning actor/team/system —
previously visible only on the canvas, never in the drawer) · **reference
code** (`n.sub`, e.g. `AGT-01` — likewise previously canvas-only) · What
this does · What it needs to start · What it produces · For example ·
Possible outcomes (decisions' `branches[]`) · **Agents involved** (`n.agents`,
resolved against the `model.agents` catalogue into full name/type/portal/
purpose detail when an id matches, shown as a plain code otherwise — this
field existed in the schema from the start but was never rendered anywhere
in the drawer until this fix; check any hand-authored or generated
`model.json` for populated `agents[]` arrays that were silently going
nowhere) · **Incoming paths / Outgoing paths** (or an explicit dead-end
notice if a non-`end` node has no outgoing edges) · Rules & safeguards ·
Systems involved · How the teams work together.

**Incoming/Outgoing paths box.** What used to be two separate "Comes
after"/"Leads to" pill rows is now one bordered two-column box (light-blue
tint, rounded corners — `.dsec-paths`), "Incoming paths" and "Outgoing
paths" side by side, matching a supplied reference layout. Each path is an
arrow (← incoming, → outgoing) plus the connected step's name in bold,
with the connecting flow's own `kind` and `label` carried alongside in a
dimmed parenthetical (e.g. "Reject application **(Error: confirmed
fraud)**" vs "Validate eligibility **(Data flow: cleared)**" for two
outgoing edges from the same node) — discarding that business-rule/
condition context, which a prior version did by showing only the plain
node name, is exactly the kind of thing a comprehensive panel should never
make the reader go find on the canvas instead. A side with nothing to show
(e.g. Incoming for a start node) renders "None" rather than an empty
column, so the box's two-column structure stays consistent across every
node. The one exception is a non-`end` node with no outgoing edges at
all — that's a genuine data anomaly (does the journey stop here, wait, or
hand off outside this diagram?), so the outgoing column shows an explicit
red-flagged notice instead of a plain "None", exactly as the previous
pill-based version did. **Deliberately kept in the drawer's existing
sans-serif typography** (Inter/system-ui) rather than adopting the
reference layout's monospace face — the box's STRUCTURE was adopted
(bordered container, two columns, arrow + bold name), not a wholesale
typography change that would clash with the rest of this skill's UI,
where Inter/system-ui is used everywhere (node labels, lane names, phase
headers, legend, and the rest of the drawer itself).

## Header & navigation (no tabs, no subtitle)
There is no tab bar at all — a prior round removed the four reference-table
tabs (Agent Inventory, Inputs & Outputs, Data Flow Matrix, Source
Traceability) but kept a single non-interactive "Business Process Diagram"
tab and its click handler; this round removed the `<nav class="tabs">`
element and that handler entirely, since a nav bar with exactly one item
served no purpose. The diagram markup is a plain, always-visible
`<div class="diagram-section">` — no `.panel`/`.panel.active` show/hide
mechanism, no `data-panel` attributes, nothing to toggle. The header
subtitle line (`.top .sub`, driven by `meta.subtitle`) was removed at the
same time — the header now shows only the title. This skill's single
source of truth is the diagram plus its side drawer: there is no other UI
surface competing with it, and no separate reference tables duplicating
the same underlying data in tabular form. Any information the removed
tables surfaced is either already in the side drawer (agent/systems/
contracts detail — see "Side drawer" above) or was pass-through data
(`model.agentflows`, `model.sources`, `deliv.bioMatrix`, `deliv.agentPhase`)
with no other consumer, removed from `build_model.py`'s output entirely
rather than computed and left unused. The JS that built the removed tables
(`mkTable`, `tag`, `laneTag`, `fieldList`/`inferFieldType`/`isKeyField`) and
the CSS that styled them (`.tablewrap`, table/`th`/`td` rules, `.tag`/
`.t-pg`/`.t-ai`/`.t-sys`/`.t-ext`, `.search`, `.count`, `.sec-h`,
`.fieldlist`/`.frow`/`.fname`/`.ftype`/`.fkey-sp`) are gone too. `.t-portal`
is the one class from that group kept — the side drawer's own Stage/lane
pills reuse it (the "Comes after"/"Leads to" chips that also used to reuse
this class have since been replaced by the bordered Incoming/Outgoing
paths box — see "Side drawer" above — which doesn't use `.pill`/
`.t-portal` at all).

**Header action buttons — current order: Reset, View Details, Happy Flow,
Export**, left to right, inside a shared `.header-actions` flex container,
aligned opposite the title. This order and Reset's presence are both
current, not historical: Reset was removed for a period when pan/zoom/drag
were all also gone (nothing left to reset FROM at that point), but once
wheel-zoom, drag-to-pan, View Details mode, and the persistent highlight
lock were all reinstated, a single control to unwind every temporary view
change back to page-load state became necessary again — see "Interactions"
above for exactly what Reset restores. All four buttons used to live in
(or, for Happy Flow, would have lived in) a separate diagram toolbar row —
that toolbar no longer exists at all: it held only "View Labels" after the
Flow-type filter was removed, and once "View Labels" was removed too
(connector labels are simply always shown now), the toolbar had nothing
left in it and was removed from the HTML entirely. The header remains the
only row of controls above the diagram canvas.
