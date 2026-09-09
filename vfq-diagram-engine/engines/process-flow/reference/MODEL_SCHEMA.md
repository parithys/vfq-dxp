# Data source — `process-flow` reads `bpmn-swimlane.model.json`, read-only

This engine reads the **exact same on-disk file** as `bpmn-swimlane`:
`data/{slug}/bpmn-swimlane.model.json`. There is no separate
`process-flow.model.json` and no separate extraction step. See
`../../bpmn-swimlane/reference/MODEL_SCHEMA.md` for the authoritative field
contract of `meta`, `nodes`, `flows`, `model`, and `biz` — this document
does not repeat it.

`scripts/render.py` reads that file **completely as-is** — no copy, no
mutation, not even in memory. `scripts/layout_process.py::compute_process_layout()`
computes an entirely separate geometry structure (see below) as a pure
function of the loaded blob; nothing is ever written back to
`data/{slug}/bpmn-swimlane.model.json`, and `output/{slug}/{slug}-bpmn-swimlane.html`
is never read at all.

## Design reference

This engine's visual language — a single horizontal "spine" of numbered
primary-path steps with exception/retry/escalation nodes dropped into
tiers below the spine at their branch point — deliberately replicates a
hand-built one-off reference file the project maintainer supplied
(`vfq-mobile-postpaid-activation-complete-flow_10.html`). Every geometric
and colour rule in `layout_process.py`/`svg_gen.py` was reverse-engineered
from that reference's own *rendered SVG output* (grep'd fill/stroke/path
attributes), not from its CSS legend text (which has its own, independent
drift from what's actually painted — documented inline in `svg_gen.py`
where it matters) and not guessed. Unlike that reference, nothing here is
hand-placed: every rule is a general function of the shared model.json, so
it produces a correctly-shaped diagram for any BRSD, not just the one the
reference happened to be built from.

## The "spine": which nodes are primary-path, and in what order

Confirmed empirically against the reference's own node roster (88 of 108
nodes matched exactly, zero exceptions): the spine is **exactly the set of
nodes reachable from the `start` node by following only
`is_happy_flow()==True` edges** — the identical happy-path reachability
`bpmn-swimlane/scripts/validate_model.py`'s own continuity check already
enforces on every BRSD (see `layout_process.py::is_happy_flow()`, a
verbatim mirror). Every other node is "off-spine."

Spine order is a topological sort (Kahn's algorithm) over that same
happy-edge subgraph, ready-queue tie-broken by each node's original
`(phase, lane order, slot)` — the swimlane's own reading order, wherever
the happy-path graph doesn't already force a specific order. Spine nodes
are then spaced evenly (`STEP` px apart) along one line; this engine does
**not** attempt to reproduce the reference's own occasional extra spacing
around wide branch clusters — a deliberate simplification (see
`layout_process.py`'s `STEP`/`X_START` comments) since exact pixel spacing
isn't a coherent goal across a corpus of differently-shaped BRSDs anyway.

## Off-spine placement

Every non-spine node gets:
- **x** = the x of its nearest **spine ancestor**, found by walking
  backward over incoming flows (any kind/happy value — any edge that leads
  here is a legitimate branch origin), through any number of off-spine
  hops if necessary.
- **y** = `TIER_BASE + tier * TIER_STEP`, where `tier` = how many off-spine
  hops deep this node sits below the point it branched from the spine (0
  = directly off a spine node, 1 = off another tier-0 node, etc.).

Multiple off-spine nodes landing on the exact same `(anchor, tier)` are
spread horizontally around that anchor rather than overlapping.

## Shape/colour classification — `layout_process.py::classify()`

See that function's own docstring for the full, evidence-based ruleset
(start/end/milestone/decision/primary/error/escalation/recovery) — every
rule there cites the specific reference-file observation that justified
it, including the one genuine surprise: a `control`-typed node with a
branching "Access granted"/"Access denied" outcome gets diamond (decision)
treatment despite not being formally typed `decision` — the reference
treats "this node gates the flow into 2+ named branches" as the real
signal, not the formal `type` field alone. This engine reproduces that via
an explicit distinct-outgoing-label check, not a hardcoded exception.

## Connector colours — `svg_gen.py::edge_color()`

Every colour is the value actually painted in the reference's SVG, not its
(sometimes inaccurate) CSS legend swatch:

| Colour | Hex | Meaning |
|---|---|---|
| Red | `#F01010` | leads to an `error`-category node — a journey-ending rejection |
| Violet | `#7A2BD6` | leads to an `escalation`-category node — an approval/escalation task |
| Blue (dashed) | `#3B7DD8` | `flows[].kind == 'data'` |
| Amber | `#C07800` | everything else drawn as an explicit branch (retry/recovery/off-spine decision) |
| Green (label only) | `#12A038` | the happy/primary continuation branch label out of an on-spine decision — no separate connector is drawn (the spine line already connects the two), only the label |
| Navy | `#2A1B9E` | the spine line itself, and every navy node shape |

A trivial consecutive spine hop (`st(to) == st(from)+1`, happy, unlabelled,
not esc/err) gets **no** explicit connector at all — it's already covered
by the one continuous spine line, exactly matching how the reference never
draws a separate line for those either.

## System / actor tag pills

Every node's card shows a bold pill for its **lane's friendly name**
(`blob.layout.lanes[].name`, e.g. "Retail Agent" → "RETAIL AGENT") — a
direct, structured field, not a heuristic. Below that, up to a few smaller
system-name pills:

- If `node.systems`/`.inputs`/`.outputs` are populated (some BRSDs'
  extractions do carry these), those values are used directly.
- Otherwise — the common case in this corpus — `svg_gen.py::system_tags()`
  applies a modest, documented heuristic over the node's own `desc` text
  (capitalised words immediately followed by a system-ish noun like
  "gateway"/"system"/"repository", or short ALL-CAPS acronyms), filtered
  against a stopword list of common English words that would otherwise
  false-positive (the single most common failure mode found and fixed
  during development: "The system shall…" matching "The" as a pseudo-system
  name before the stopword filter was added). This is a best-effort
  enrichment, not a guarantee — a node with no qualifying text simply gets
  no extra tag, which is an honest outcome, not a bug.

## Validation

`render.py` validates the **original, untouched** `model_path` directly
(no transform, no temp file needed — a change from an earlier version of
this engine, back when it still mutated a copy of `nodes[]`/`layout`) by
importing `bpmn-swimlane/scripts/validate_model.py`'s `validate()`. Same
rationale as before: the connector-integrity contract (dangling references,
duplicate ids, decision-branch/flow consistency, happy-path continuity)
depends only on `nodes[].id` and `flows[]`, both read here completely
unmodified.
