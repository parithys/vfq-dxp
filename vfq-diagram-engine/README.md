# vfq-diagram-engine

An orchestration layer over four existing Claude Code diagram skills
(`bpnm`, `customer-journey-map`, `pfd`, `user-flow-diagram`). It does not
reimplement any of their rendering, layout, or validation logic — it
persists each BRSD's extracted data as JSON and re-renders through the
unmodified engines on demand, so a template edit or a re-render doesn't
require re-reading any BRSD or spending another AI call.

## Why this exists

Each of the four skills already separates a fixed rendering engine from a
data-driven input file:

| Diagram type | Skill | Fixed engine | Data input |
|---|---|---|---|
| BPMN swimlane | `bpnm` | `engines/bpnm/scripts/render.py` + `reference/engine_template.html` | `bpmn.model.json` |
| Customer journey map | `customer-journey-map` | `engines/customer-journey-map/assets/template.html` (string injection) | `journey.spec.json` |
| Process flow diagram | `pfd` | `engines/pfd/scripts/generate.js` (`buildHTML`) | `processflow.spec.json` |
| User flow diagram | `user-flow-diagram` | `engines/user-flow-diagram/user-flow-diagram-v4.0.js` (`renderReport`) | `userflow.spec.json` |

`bpnm` is the one exception to "engines compute their own layout at render
time": `bpmn.model.json` bakes pixel geometry (`nodes[].x/y/w/h/cx/cy`,
`layout.lanes[].y/h`, `layout.totalW/totalH`) directly into the data, so
`/extract-bpmn` must run
`python3 engines/bpnm/scripts/layout_model.py data/{slug}/bpmn.model.json`
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
│   ├── bpnm/                    reference/ + scripts/
│   ├── customer-journey-map/    assets/ + references/
│   ├── pfd/                     scripts/ + references/ + assets/reference/
│   └── user-flow-diagram/       user-flow-diagram-v4.0.js
├── data/{brsd-slug}/            one JSON per diagram type, the persistent canonical store
│   ├── bpmn.model.json
│   ├── journey.spec.json
│   ├── processflow.spec.json
│   └── userflow.spec.json
├── output/{brsd-slug}/          rendered HTML, one per diagram type
├── manifest.json                source hash + extraction/render timestamps + engine hash, per BRSD per type
└── scripts/
    ├── slugify.js               BRSD filename -> {brsd-slug}, single source of truth
    ├── manifest.js               manifest.json read/write helper (+ CLI: record-extraction)
    ├── render-all.js            pure Node, zero AI calls — the re-render command
    ├── check-drift.js           reports engines/ vs. live skill divergence (report only)
    └── new-brsd.sh               extract (4x) + render, for one new BRSD
```

Engines are **copied, not symlinked**, so an intentional local edit (e.g. a
design-token tweak) doesn't silently drift when the upstream skill updates.
Run `check-drift.js` periodically to see if the two have diverged in either
direction; it never auto-merges.

## Commands

### Extraction (the only step that uses Claude)

```
/extract-bpmn <path-to-one-brsd-file>
/extract-journey <path-to-one-brsd-file>
/extract-processflow <path-to-one-brsd-file>
/extract-userflow <path-to-one-brsd-file>
```

Each is scoped to read only the one file it's given, reuses the relevant
engine's own schema doc, writes exactly one JSON file under `data/`, and
updates `manifest.json`. None of them render. They're defined in
`../.claude/commands/` (project root) since Claude Code only registers
slash commands from the active project's `.claude/commands/`.

### Rendering (`scripts/render-all.js`, pure Node, zero AI calls)

```
node scripts/render-all.js                        # everything
node scripts/render-all.js --brsd <slug>           # one BRSD's 4 outputs
node scripts/render-all.js --type processflow      # one diagram type, all BRSDs
node scripts/render-all.js --brsd <slug> --type bpmn
```

This is the command that makes an engine edit propagate everywhere: edit
`engines/pfd/scripts/generate.js`, run
`node scripts/render-all.js --type processflow`, every process-flow
diagram regenerates with no extraction, no Claude call, no re-reading any
BRSD.

Failures are per-file and non-fatal to the batch: a data file that fails
its engine's own validator (bpnm's `validate_model.py`; pfd/user-flow-diagram
throw internally) is skipped with the exact validator error printed, and
the run continues to the next file. Exit code is `1` if anything failed,
`0` otherwise. `manifest.json` is updated with a render timestamp and an
engine-file hash for every output that succeeded.

### Drift check (`scripts/check-drift.js`)

```
node scripts/check-drift.js [--json]
```

Compares every file under `engines/` against the live skill installed on
this machine (currently resolved from the Claude Desktop plugin cache —
see `LIVE_SOURCES` in the script if that path changes) and reports
additions, deletions, or content differences in either direction. Report
only — it never copies anything for you.

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
        "bpmn":        { "extractedAt": "…", "renderedAt": "…", "engineHash": "…" },
        "journey":     { "extractedAt": "…", "renderedAt": "…", "engineHash": "…" },
        "processflow": { "extractedAt": "…", "renderedAt": "…", "engineHash": "…" },
        "userflow":    { "extractedAt": "…", "renderedAt": "…", "engineHash": "…" }
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
