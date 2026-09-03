# vfq-diagram-engine

An orchestration layer over four existing Claude Code diagram skills. It
does not reimplement any of their rendering, layout, or validation logic —
it persists each BRSD's extracted data as JSON and re-renders through the
unmodified engines on demand, so a template edit or a re-render doesn't
require re-reading any BRSD or spending another AI call.

## Why this exists

Each of the four skills already separates a fixed rendering engine from a
data-driven input file. Diagram types are referred to throughout this
project (extraction commands, `--type` flag, file names, manifest keys) as
`bpmn-swimlane`, `journey`, `process-flow`, and `userflow` — the two
renamed from their original skill names (`bpnm`, `pfd`) for clarity, since
abbreviations get ambiguous over time. The upstream Claude Code skill each
is copied from is still literally named `bpnm`/`pfd` on disk (relevant only
to `check-drift.js`, which compares against that real upstream path):

| Diagram type | Upstream skill name | Fixed engine | Data input |
|---|---|---|---|
| BPMN swimlane | `bpnm` | `engines/bpmn-swimlane/scripts/render.py` + `reference/engine_template.html` | `bpmn-swimlane.model.json` |
| Customer journey map | `customer-journey-map` | `engines/customer-journey-map/assets/template.html` (string injection) | `journey.spec.json` |
| Process flow diagram | `pfd` | `engines/process-flow/scripts/generate.js` (`buildHTML`) | `process-flow.spec.json` |
| User flow diagram | `user-flow-diagram` | `engines/user-flow-diagram/user-flow-diagram-v4.0.js` (`renderReport`) | `userflow.spec.json` |

`bpmn-swimlane` is the one exception to "engines compute their own layout
at render time": `bpmn-swimlane.model.json` bakes pixel geometry
(`nodes[].x/y/w/h/cx/cy`, `layout.lanes[].y/h`, `layout.totalW/totalH`)
directly into the data, so `/extract-bpmn-swimlane` must run
`python3 engines/bpmn-swimlane/scripts/layout_model.py data/{slug}/bpmn-swimlane.model.json`
after writing the structural JSON and before validating — skipping it
produces a file that validates cleanly (the validator only checks
id/phase/flow integrity, not geometry) but renders as an illegibly
overlapping diagram, since every node silently defaults to position 0,0.
`layout_model.py` is a thin CLI wrapper around `build_model.py`'s own
`compute_layout()` — no engine geometry logic was rewritten, only exposed
standalone for data that didn't come through the Excel-workbook pipeline.

Before this layer, every diagram run re-derived its data from the BRSD from
scratch (token cost even for a pure styling tweak), there was no single
command to re-render everything, and nothing enforced that an extraction
run only read the one BRSD it was pointed at. This scaffold fixes all
three without touching any engine's layout, styling, or validation code.

## Layout

```
vfq-diagram-engine/
├── engines/                     unmodified copies of each skill's render engine
│   ├── bpmn-swimlane/           reference/ + scripts/
│   ├── customer-journey-map/    assets/ + references/
│   ├── process-flow/            scripts/ + references/ + assets/reference/
│   └── user-flow-diagram/       user-flow-diagram-v4.0.js
├── data/{brsd-slug}/            one JSON per diagram type, the persistent canonical store
│   ├── bpmn-swimlane.model.json
│   ├── journey.spec.json
│   ├── process-flow.spec.json
│   └── userflow.spec.json
├── output/{brsd-slug}/          rendered HTML, one per diagram type
├── manifest.json                source hash + extraction/render timestamps + engine hash, per BRSD per type
└── scripts/
    ├── slugify.js               BRSD filename -> {brsd-slug}, single source of truth
    ├── manifest.js               manifest.json read/write helper (+ CLI: record-extraction)
    ├── render-all.js            pure Node, zero AI calls — the re-render command
    ├── check-drift.js           reports engines/ vs. live skill divergence (report only)
    ├── check-staleness.js       reports rendered output vs. current engine divergence (report only)
    └── new-brsd.sh               extract (4x) + render, for one new BRSD
```

Engines are **copied, not symlinked**, so an intentional local edit (e.g. a
design-token tweak) doesn't silently drift when the upstream skill updates.
Run `check-drift.js` periodically to see if the two have diverged in either
direction; it never auto-merges.

## Canonical sources vs. generated output

Everything under `engines/` is canonical — the single source of truth for
how every diagram of that type looks and behaves, across every BRSD:

| Diagram type | Canonical engine file(s) |
|---|---|
| BPMN swimlane | `engines/bpmn-swimlane/reference/engine_template.html`, `engines/bpmn-swimlane/scripts/build_model.py`, and its documented rules in `engines/bpmn-swimlane/reference/MODEL_SCHEMA.md` + `DESIGN_SYSTEM.md` |
| Customer journey map | `engines/customer-journey-map/assets/template.html` |
| Process flow diagram | `engines/process-flow/scripts/generate.js` |
| User flow diagram | `engines/user-flow-diagram/user-flow-diagram-v4.0.js` |

Everything under `output/{brsd-slug}/` is **generated output** — the
engine is still the source of truth for anything meant to apply across
every BRSD. Concretely, that means two rules, enforced by how the tooling
is built (not just by convention):

1. **Forward: an engine edit is automatically inherited by every BRSD,
   without clobbering per-file manual edits.** `render-all.js` always reads
   whatever is currently in `engines/` — there is no per-BRSD fork or
   cached copy of engine logic. Fix a routing bug, tune a spacing constant,
   adjust a design token once in the engine file, and the next
   `render-all.js` run folds it into every BRSD that has data for that
   diagram type. If a given `output/{slug}/{type}.html` has been hand-edited
   (content, connector routing, node connectivity, layout, diagram-specific
   behaviour), that edit is preserved — see "Manual edits to generated
   output" below for how.
2. **Reverse: an enhancement meant to apply everywhere belongs in the
   engine, not one output file.** If a rendering issue or improvement is
   general-purpose — it should look right for every BRSD, not just the one
   you happened to be looking at — trace the fix to and apply it in the
   corresponding canonical engine file above, then re-render. Only apply a
   fix directly to a generated HTML file when it's specific to that one
   diagram (a one-off manual correction) and you don't want it propagated
   elsewhere; that's exactly the case the mechanism below exists for.

Because rule 1 is automatic but silent, output can go **stale** — an engine
file changes but a given BRSD isn't re-rendered to pick it up. Run
`check-staleness.js` (below) to find that before it causes confusion about
which output is current.

### Manual edits to generated output

`output/*.html` may be hand-edited directly — for a one-off fix to a single
diagram's content, connector routing, node connectivity, layout, or other
diagram-specific behaviour that shouldn't be generalized into the engine.
Those edits are preserved across future `render-all.js` runs unless you
explicitly fold them into the engine yourself and re-render.

This works via a stored baseline per output file, at
`.render-baseline/{slug}/{type}.html` — a copy of the last *pure engine
render* for that file (no manual edits). Every `render-all.js` run compares
the current `output/*.html` against its baseline before writing:

- **No manual edits** (current output == baseline): plain overwrite, new
  render becomes the new baseline.
- **Manual edits, engine output for this file unchanged**: nothing to do,
  file is left as-is.
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

### Extraction (the only step that uses Claude)

```
/extract-bpmn-swimlane <path-to-one-brsd-file>
/extract-journey <path-to-one-brsd-file>
/extract-process-flow <path-to-one-brsd-file>
/extract-userflow <path-to-one-brsd-file>
```

Each is scoped to read only the one file it's given, reuses the relevant
engine's own schema doc, writes exactly one JSON file under `data/`, and
updates `manifest.json`. None of them render. They're defined in
`../.claude/commands/` (project root) since Claude Code only registers
slash commands from the active project's `.claude/commands/`.

### Rendering (`scripts/render-all.js`, pure Node, zero AI calls)

```
node scripts/render-all.js                          # everything
node scripts/render-all.js --brsd <slug>             # one BRSD's 4 outputs
node scripts/render-all.js --type process-flow       # one diagram type, all BRSDs
node scripts/render-all.js --brsd <slug> --type bpmn-swimlane
node scripts/render-all.js --brsd <slug> --type bpmn-swimlane --force   # discard that file's manual edits
```

This is the command that makes an engine edit propagate everywhere: edit
`engines/process-flow/scripts/generate.js`, run
`node scripts/render-all.js --type process-flow`, every process-flow
diagram regenerates with no extraction, no Claude call, no re-reading any
BRSD — and any file-specific manual edits made to a given output are
preserved by the baseline/merge mechanism in "Manual edits to generated
output" above, rather than overwritten.

Failures are per-file and non-fatal to the batch: a data file that fails
its engine's own validator (bpmn-swimlane's `validate_model.py`;
process-flow/user-flow-diagram throw internally) is skipped with the exact
validator error printed, and
the run continues to the next file. Exit code is `1` if anything failed OR
any file's manual edits produced a merge conflict against an engine update,
`0` otherwise. `manifest.json` is updated with a render timestamp and an
engine-file hash for every output that succeeded (including merged/
conflicted ones, since the engine hash reflects the engine as it stands
now regardless of merge outcome).

### Drift check (`scripts/check-drift.js`)

```
node scripts/check-drift.js [--json]
```

Compares every file under `engines/` against the live skill installed on
this machine (currently resolved from the Claude Desktop plugin cache —
see `LIVE_SOURCES` in the script if that path changes) and reports
additions, deletions, or content differences in either direction. Report
only — it never copies anything for you.

This is a different check from staleness, below: drift is about
`engines/` vs. the *upstream* skill source it was copied from (did the
plugin get updated). Staleness is about a BRSD's *rendered output* vs.
`engines/` as it stands right now (did someone edit the engine and forget
to re-render).

### Staleness check (`scripts/check-staleness.js`)

```
node scripts/check-staleness.js [--json]
```

For every BRSD in `manifest.json`, recomputes each diagram type's current
engine hash and compares it against the hash recorded the last time that
BRSD was rendered (`manifest.json`'s `engineHash`, written by
`render-all.js` on every successful render — see "manifest.json shape"
below). A mismatch means an engine file was edited since that output was
generated, so `output/{slug}/{type}.html` no longer reflects the canonical
engine. Report only, exits non-zero if anything is stale:

```
[vfq-fibre-brsd-v1-0]
  ✓ bpmn-swimlane: fresh (rendered 2026-09-02T19:22:13.846Z)
  ✗ userflow: STALE — engine changed since 2026-09-03T02:10:06.853Z
      rendered against 0608251a15f2b6f6, engine is now e96b45706fb6972a

3 fresh, 1 stale, 0 never rendered.
Re-render stale entries with: node scripts/render-all.js --brsd <slug> --type <type>
```

This only detects engine-vs-render drift — it says nothing about whether a
given output file also carries manual edits. That's tracked separately, via
the `.render-baseline/` mechanism described in "Manual edits to generated
output" above.

### New BRSD (`scripts/new-brsd.sh`)

```
./scripts/new-brsd.sh /path/to/New_BRSD.xlsx
```

Runs all four `/extract-*` commands against the given file via the `claude`
CLI, then `render-all.js --brsd <derived-slug>`. The only command needed
for an incoming document.

## manifest.json shape

```json
{
  "brsds": {
    "vfq-fibre-brsd-v1-0": {
      "sourcePath": "/Users/.../BRSD/VFQ_Fibre_BRSD_v1.0.xlsx",
      "sourceSha256": "…",
      "diagrams": {
        "bpmn-swimlane": { "extractedAt": "…", "renderedAt": "…", "engineHash": "…" },
        "journey":       { "extractedAt": "…", "renderedAt": "…", "engineHash": "…" },
        "process-flow":  { "extractedAt": "…", "renderedAt": "…", "engineHash": "…" },
        "userflow":      { "extractedAt": "…", "renderedAt": "…", "engineHash": "…" }
      }
    }
  }
}
```

`engineHash` is a truncated sha256 over the specific engine files that
influence that diagram type's output at render time (not the whole
`engines/` tree) — computed fresh on every successful render, so it always
reflects what actually produced that output file.

## Explicitly out of scope here

- No engine's layout, geometry, validation, or styling logic is modified —
  only copied.
- No new HTML template was built from scratch for any diagram type.
- No extraction command reads more than the one file it's pointed at.
- `check-drift.js` never auto-merges; it flags only.
