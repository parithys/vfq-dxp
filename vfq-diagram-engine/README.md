# vfq-diagram-engine

An orchestration layer over one Claude Code diagram skill (`bpmn-swimlane`)
plus a workbook-correction step. It does not reimplement the engine's
rendering, layout, or validation logic — it persists each BRSD's extracted
data as JSON and re-renders through the unmodified engine on demand, so a
template edit or a re-render doesn't require re-reading any BRSD or
spending another AI call.

**Two diagram types are generated per BRSD: `bpmn-swimlane` and
`process-flow`** — both rendered from the exact same extracted
`data/{slug}/bpmn-swimlane.model.json`, via two independent, fixed
rendering engines under `engines/`. There is no separate `process-flow`
extraction step and no separate data file — see "The full pipeline" below
for why one shared structural model, rendered two ways, is what keeps the
two diagrams synchronised by construction rather than by convention.
Earlier iterations of this project also produced `bpmn-mermaid`, `journey`
(customer journey map), and `userflow` outputs; those remain removed
(engines, data specs, rendered output, extraction commands, and the
corresponding manifest/render-all machinery) and are out of scope — see
"Explicitly out of scope" below. `process-flow` itself was previously
removed too, then deliberately reintroduced on 2026-09-08 as a second
engine sharing `bpmn-swimlane`'s own extracted data (rather than, as an
earlier ad hoc attempt did, being built by reading `bpmn-swimlane`'s
*rendered HTML* as a reference — a real BRSD-to-data dependency this
architecture doesn't have).

## Why this exists

The `bpmn-swimlane` skill already separates a fixed rendering engine from a
data-driven input file. Before this layer, every diagram run re-derived its
data from the BRSD from scratch (token cost even for a pure styling
tweak), there was no single command to re-render output, and nothing
enforced that an extraction run only read the one BRSD it was pointed at.
This scaffold fixes all three without touching the engine's layout,
styling, or validation code — and adds a correction step so every BRSD is
brought up to the same requirements-quality bar before its data is ever
extracted.

The upstream Claude Code skill `bpmn-swimlane` is copied from is still
literally named `bpnm` on disk (relevant only to `check-drift.js`, which
compares against that real upstream path):

| Diagram type | Upstream skill name | Fixed engine | Data input |
|---|---|---|---|
| BPMN swimlane | `bpnm` | `engines/bpmn-swimlane/scripts/render.py` + `reference/engine_template.html` | `bpmn-swimlane.model.json` |
| Process flow | — (bespoke engine modelled on a maintainer-supplied reference file, not copied from any upstream skill or from bpmn-swimlane's own template) | `engines/process-flow/scripts/render.py` + `scripts/svg_gen.py` + `reference/engine_template.html` | `bpmn-swimlane.model.json` (same file, read-only — see `engines/process-flow/reference/MODEL_SCHEMA.md`) |

`bpmn-swimlane.model.json` bakes pixel geometry (`nodes[].x/y/w/h/cx/cy`,
`layout.lanes[].y/h`, `layout.totalW/totalH`) directly into the data, so
`/extract-bpmn-swimlane` must run
`python3 engines/bpmn-swimlane/scripts/layout_model.py data/{slug}/bpmn-swimlane.model.json`
after writing the structural JSON and before validating — skipping it
produces a file that validates cleanly (the validator only checks
id/phase/flow integrity, not geometry) but renders as an illegibly
overlapping diagram, since every node silently defaults to position 0,0.
`layout_model.py` is a thin CLI wrapper around `build_model.py`'s own
`compute_layout()` — no engine geometry logic was rewritten, only exposed
standalone for data that didn't come through the Excel-workbook pipeline.

## Layout

```
vfq-diagram-engine/
├── engines/
│   ├── bpmn-swimlane/            reference/ + scripts/ — unmodified copy of the skill's render engine
│   └── process-flow/             reference/ + scripts/ — a bespoke engine (own template, own SVG
│                                  generator), modelled on a maintainer-supplied reference file, not on
│                                  bpmn-swimlane's own template; reads bpmn-swimlane.model.json read-only,
│                                  computes its own derived layout at render time (see
│                                  reference/MODEL_SCHEMA.md), never writes to data/ and never reads
│                                  bpmn-swimlane's rendered HTML
├── data/{brsd-slug}/             the persistent canonical store
│   └── bpmn-swimlane.model.json  read by BOTH engines above — the single structural source per BRSD
├── output/{brsd-slug}/           rendered HTML
│   ├── {brsd-slug}-bpmn-swimlane.html
│   └── {brsd-slug}-process-flow.html
├── output/bpmn-swimlane-dashboard.html   browse-all entry point for every bpmn-swimlane diagram
├── output/process-flow-dashboard.html    browse-all entry point for every process-flow diagram
├── manifest.json                 source hash + extraction/render timestamps + engine hash, per BRSD, per diagram type
└── scripts/
    ├── slugify.js                BRSD filename -> {brsd-slug}, single source of truth
    ├── manifest.js               manifest.json read/write helper (+ CLI: record-extraction)
    ├── render-all.js             pure Node, zero AI calls — the re-render command (also regenerates both dashboards on every run)
    ├── build-dashboards.js       pure Node, zero AI calls — the two dashboard HTML files, from manifest.json + data/
    ├── check-drift.js            reports engines/ vs. live skill divergence (report only)
    ├── check-staleness.js        reports rendered output vs. current engine divergence (report only)
    ├── new-brsd.sh                correct (if needed) + extract + render, for one new BRSD
    └── brsd-correction/
        ├── README.md              the BRSD correction methodology (business-analyst review + mechanics)
        └── brsd_correct_lib.py    reusable openpyxl helper for the column-insert/reorder/format-preserve step
```

`engines/bpmn-swimlane/` is **copied, not symlinked**, so an intentional
local edit (e.g. a design-token tweak) doesn't silently drift when the
upstream skill updates. Run `check-drift.js` periodically to see if the
two have diverged in either direction; it never auto-merges. `check-drift.js`
only checks `bpmn-swimlane` against its upstream skill source —
`process-flow` has no upstream skill at all (it's a bespoke engine, not
copied or forked from anything upstream — see
`engines/process-flow/reference/DESIGN_SYSTEM.md` "Architecture") and so
isn't part of that check.

## The full pipeline

1. **Load** the BRSD workbook.
2. **Correct** it, if needed: `New Req ID`, `Updated Requirement
   Statement`, and `Updated Acceptance Criteria` columns are added to the
   Requirements sheet in place, following
   `scripts/brsd-correction/README.md`. Skipped automatically if those
   columns already exist. Preserves 100% of unrelated formatting
   (merges, styles, borders, column widths, row heights, data validation,
   conditional formatting, hidden rows/columns, sheet structure).
3. **Extract** the corrected data into `data/{brsd-slug}/bpmn-swimlane.model.json`
   — the single structural extraction per BRSD, shared by both diagram types.
4. **Render** both `output/{brsd-slug}/{brsd-slug}-bpmn-swimlane.html` and
   `output/{brsd-slug}/{brsd-slug}-process-flow.html` from that one data file.
5. **Regenerate both dashboards** — `output/bpmn-swimlane-dashboard.html`
   and `output/process-flow-dashboard.html` — so the new BRSD's diagrams
   are browsable immediately.

Steps 2–3 are both performed by the single `/extract-bpmn-swimlane` command
(step 2 is its "step 0"); step 4 is `render-all.js`, which renders every
registered diagram type (currently `bpmn-swimlane` and `process-flow`) by
default — pass `--type` to render only one. Step 5 runs automatically at
the end of every `render-all.js` invocation (see "Dashboards" under
Commands below) — there is no separate command to remember. `new-brsd.sh`
runs the whole thing end-to-end for one new file, producing both outputs
and both up-to-date dashboards.

## Canonical source vs. generated output

Everything below is written in terms of `engines/bpmn-swimlane/` for
concreteness, but every rule applies identically to
`engines/process-flow/` and its own `output/{slug}/{slug}-process-flow.html`
— `render-all.js` treats both diagram types the same way (see its `TYPES`
registry), including baseline tracking, staleness detection, and manual-edit
reconciliation.

Everything under `engines/bpmn-swimlane/` is canonical — the single source
of truth for how the diagram looks and behaves, across every BRSD:
`reference/engine_template.html`, `scripts/build_model.py`, and the
documented rules in `reference/MODEL_SCHEMA.md` + `DESIGN_SYSTEM.md`.

Everything under `output/{brsd-slug}/` is **generated output**. Concretely,
that means two rules, enforced by how the tooling is built (not just by
convention):

1. **Forward: an engine edit is automatically inherited by every BRSD,
   without clobbering per-file manual edits.** `render-all.js` always reads
   whatever is currently in `engines/bpmn-swimlane/` — there is no
   per-BRSD fork or cached copy of engine logic. Fix a routing bug, tune a
   spacing constant, adjust a design token once in the engine file, and the
   next `render-all.js` run folds it into every BRSD. If a given
   `output/{slug}/{slug}-bpmn-swimlane.html` has been hand-edited (content,
   connector routing, node connectivity, layout, diagram-specific
   behaviour), that edit is preserved — see "Manual edits to generated
   output" below for how.
2. **Reverse: an enhancement meant to apply everywhere belongs in the
   engine, not one output file.** If a rendering issue or improvement is
   general-purpose — it should look right for every BRSD, not just the one
   you happened to be looking at — trace the fix to and apply it in
   `engines/bpmn-swimlane/`, then re-render. Only apply a fix directly to a
   generated HTML file when it's specific to that one diagram (a one-off
   manual correction) and you don't want it propagated elsewhere; that's
   exactly the case the mechanism below exists for.

Because rule 1 is automatic but silent, output can go **stale** — the
engine changes but a given BRSD isn't re-rendered to pick it up. Run
`check-staleness.js` (below) to find that before it causes confusion about
which output is current.

### Manual edits to generated output

`output/*.html` may be hand-edited directly — for a one-off fix to a single
diagram's content, connector routing, node connectivity, layout, or other
diagram-specific behaviour that shouldn't be generalized into the engine.
Those edits are preserved across future `render-all.js` runs unless you
explicitly fold them into the engine yourself and re-render.

This works via a stored baseline per output file, at
`.render-baseline/{slug}/{slug}-bpmn-swimlane.html` — a copy of the last
*pure engine render* for that file (no manual edits). Every
`render-all.js` run compares the current output against its baseline
before writing:

- **No manual edits** (current output == baseline): plain overwrite, new
  render becomes the new baseline.
- **Manual edits, engine output unchanged**: nothing to do, file is left
  as-is.
- **Manual edits AND the engine render changed**: a 3-way merge
  (`git merge-file`) with base = baseline, ours = your manual edits,
  theirs = the new engine render.
  - Clean merge: the engine update folds in around your edits, and the
    baseline advances to the new render.
  - Conflict (the engine change touched the same region you hand-edited):
    standard `<<<<<<<`/`=======`/`>>>>>>>` markers are written directly
    into the output file, and the baseline is **not** advanced — the same
    conflict will be reported again on the next run until you resolve it by
    hand (edit out the markers, keep whichever side — or a manual blend —
    is correct).

`render-all.js`'s console output reports which of these happened per file
(`merged`, `unchanged`, `conflict`, etc.). To discard a file's manual edits
and force it back to a pure engine render, pass `--force`.

`.render-baseline/` is tracked in git alongside `output/` — it has to
survive across sessions/machines for the diff to mean anything, so don't
add it to `.gitignore`.

## Commands

### `/extract-bpmn-swimlane` (the only step that uses Claude)

```
/extract-bpmn-swimlane <path-to-one-brsd-file>
```

Scoped to read only the one file it's given. First corrects the workbook
in place if it isn't already corrected (step 0 — see
`scripts/brsd-correction/README.md`), then extracts data into
`data/{brsd-slug}/bpmn-swimlane.model.json` reusing the engine's own schema
doc, and updates `manifest.json`. Does not render — this one file is the
data source for *both* diagram types. Defined in `../.claude/commands/`
(project root) since Claude Code only registers slash commands from the
active project's `.claude/commands/`.

### Rendering (`scripts/render-all.js`, pure Node, zero AI calls)

```
node scripts/render-all.js                    # everything, both diagram types
node scripts/render-all.js --brsd <slug>      # one BRSD, both diagram types
node scripts/render-all.js --brsd <slug> --type process-flow   # one BRSD, one type
node scripts/render-all.js --brsd <slug> --force   # discard that file's manual edits
```

This is the command that makes an engine edit propagate everywhere: edit
`engines/bpmn-swimlane/scripts/render.py` (or `engines/process-flow/scripts/render.py`,
or either one's template/schema), run `node scripts/render-all.js`, every
BRSD's diagram of that type regenerates with no extraction, no Claude call,
no re-reading any BRSD — and any file-specific manual edits made to a given
output are preserved by the baseline/merge mechanism in "Manual edits to
generated output" above, rather than overwritten. A no-arg run always
renders both types for every BRSD, since both read the same underlying
data file.

Failures are per-file and non-fatal to the batch: a data file that fails
the engine's own `validate_model.py` is skipped with the exact validator
error printed, and the run continues to the next file. Exit code is `1` if
anything failed OR any file's manual edits produced a merge conflict
against an engine update, `0` otherwise. `manifest.json` is updated with a
render timestamp and an engine-file hash for every output that succeeded
(including merged/conflicted ones, since the engine hash reflects the
engine as it stands now regardless of merge outcome).

### Dashboards (`scripts/build-dashboards.js`, pure Node, zero AI calls)

```
node scripts/build-dashboards.js
```

Regenerates `output/bpmn-swimlane-dashboard.html` and
`output/process-flow-dashboard.html` — one central "browse everything"
entry point per diagram type, listing every BRSD that has a rendered
output of that type with its title, source workbook, phase count, node
count, and last-rendered date, plus client-side search and sort (name,
node count, most recently rendered). Each card links straight to its
`output/{slug}/{slug}-{type}.html`.

Reads only what every other script here already trusts —
`manifest.json` (which BRSDs have a rendered output, and when) and each
BRSD's own `data/{slug}/bpmn-swimlane.model.json` (title, node count,
phase count — the same structural file both engines render from, so a
dashboard entry's numbers can never disagree with what the diagram itself
shows). It never re-parses generated HTML output.

**You should not need to run this by hand.** `render-all.js` calls it
automatically at the end of every run (see "The full pipeline" step 5
above), so both dashboards always reflect whatever is currently in
`output/` with no separate step to remember. Run it directly only if you
want to refresh the dashboards without doing a full render pass.

### Drift check (`scripts/check-drift.js`)

```
node scripts/check-drift.js [--json]
```

Compares every file under `engines/bpmn-swimlane/` against the live skill
installed on this machine (currently resolved from the Claude Desktop
plugin cache — see `LIVE_SOURCES` in the script if that path changes) and
reports additions, deletions, or content differences in either direction.
Report only — it never copies anything for you.

This is a different check from staleness, below: drift is about
`engines/` vs. the *upstream* skill source it was copied from (did the
plugin get updated). Staleness is about a BRSD's *rendered output* vs.
`engines/` as it stands right now (did someone edit the engine and forget
to re-render).

### Staleness check (`scripts/check-staleness.js`)

```
node scripts/check-staleness.js [--json]
```

For every BRSD in `manifest.json`, recomputes the current engine hash and
compares it against the hash recorded the last time that BRSD was rendered
(`manifest.json`'s `engineHash`, written by `render-all.js` on every
successful render — see "manifest.json shape" below). A mismatch means an
engine file was edited since that output was generated, so
`output/{slug}/{slug}-bpmn-swimlane.html` no longer reflects the canonical
engine. Report only, exits non-zero if anything is stale:

```
[vfq-fibre-brsd-v1-0]
  ✓ bpmn-swimlane: fresh (rendered 2026-09-02T19:22:13.846Z)

1 fresh, 0 stale, 0 never rendered.
```

This only detects engine-vs-render drift — it says nothing about whether a
given output file also carries manual edits. That's tracked separately, via
the `.render-baseline/` mechanism described in "Manual edits to generated
output" above.

### New BRSD (`scripts/new-brsd.sh`)

```
./scripts/new-brsd.sh /path/to/New_BRSD.xlsx
```

Runs `/extract-bpmn-swimlane` against the given file via the `claude` CLI
(which corrects the workbook in place first, if needed, then extracts),
then `render-all.js --brsd <derived-slug>` — which renders both
`{slug}-bpmn-swimlane.html` and `{slug}-process-flow.html` from that one
extraction. The only command needed for an incoming document.

## manifest.json shape

```json
{
  "brsds": {
    "vfq-fibre-brsd-v1-0": {
      "sourcePath": "/Users/.../BRSD/VFQ_Fibre_BRSD_v1.0.xlsx",
      "sourceSha256": "…",
      "diagrams": {
        "bpmn-swimlane": { "extractedAt": "…", "renderedAt": "…", "engineHash": "…" },
        "process-flow": { "extractedAt": null, "renderedAt": "…", "engineHash": "…" }
      }
    }
  }
}
```

`engineHash` is a truncated sha256 over the specific engine files that
influence output at render time (not the whole `engines/` tree) — computed
fresh on every successful render, so it always reflects what actually
produced that output file. The `diagrams` object keeps its nested shape
(rather than being flattened to top-level fields) specifically so a second
diagram type could be reintroduced later without a manifest migration —
`process-flow` is that second type. Its `extractedAt` is always `null`: it
has no extraction step of its own (`recordExtraction()` is only ever called
with type `bpmn-swimlane`) since it shares `bpmn-swimlane`'s own extracted
data file entirely — only `renderedAt`/`engineHash` are meaningful for it.

## Explicitly out of scope here

- `bpmn-swimlane`'s own layout, geometry, validation, or styling logic is
  never modified — only copied. `process-flow` is a separate, bespoke
  engine (own template, own SVG generator, own layout algorithm — see
  `engines/process-flow/reference/DESIGN_SYSTEM.md` "Architecture"); it
  reuses `bpmn-swimlane`'s `validate_model.py` (import, not a copy — see
  `engines/process-flow/reference/MODEL_SCHEMA.md` "Validation") since the
  connector-integrity contract it checks applies to both engines
  identically, but nothing about `process-flow`'s own rendering is a fork
  of `bpmn-swimlane`'s.
- No extraction command reads more than the one file it's pointed at.
- `check-drift.js` never auto-merges; it flags only, and only covers
  `bpmn-swimlane` (the only engine with an actual upstream skill source —
  see "Canonical source vs. generated output").
- No diagram type beyond `bpmn-swimlane` and `process-flow` is generated —
  `bpmn-mermaid`, customer journey map, user flow, or any other variant
  remain removed. If one is wanted again in the future, it would need to
  be reintroduced deliberately — nothing here retains a placeholder for it.
