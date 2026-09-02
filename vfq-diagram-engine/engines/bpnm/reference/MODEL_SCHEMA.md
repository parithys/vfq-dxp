# `model.json` — data contract consumed by the engine

The engine (`engine_template.html`) renders **only** from this object, injected
at the `__MODEL_JSON__` placeholder as `window.DATA`. Every field is produced by
`build_model.py` from the source dataset. No field may contain hard-coded
domain content.

```jsonc
{
  "meta": {
    "title":    "string — header title (shown in the top bar)",
    // "subtitle" is accepted (harmless pass-through) but no longer rendered anywhere — the
    // header subtitle line and the tab bar it used to sit above were both removed entirely.
    // Only "title" is read by the engine now.
    "subtitle": "string — no longer displayed; safe to omit",
    "generated":"YYYY-MM-DD",
    "source":   "source file name"
  },

  "layout": {
    "x0": 120, "topbar": 70, "colw": 252, "laneLabelW": 100,
    "totalW": 0, "totalH": 0,
    "phases": ["Initiate", "Stage 1", "…", "Complete"],   // phase-column headers (left→right)
    "lanes": [ { "key":"trigger", "name":"Events / Triggers", "hint":"…", "y":0, "h":0 }, … ]
  },

  "nodes": [
    {
      "id":"unique", "type":"start|end|agent|control|decision|validation|system|external|error|escalation",
      "lane":"lane.key", "phase": 0, "slot": 0,
      "label":"visible title", "sub":"small code/subtitle", "desc":"plain purpose",
      "inputs":[…], "outputs":[…], "controls":[…], "agents":[…], "systems":[…], "contracts":[…],
      "branches":[ { "label":"Yes", "to":"nodeId" } ],   // decisions only
      "x":0,"y":0,"w":0,"h":0,"cx":0,"cy":0              // geometry (build_model computes this)
    }
  ],

  "flows": [ { "from":"nodeId", "to":"nodeId", "kind":"seq|data|cond|esc|err", "label":"optional",
               "happy": "optional bool — see the Happy Flow note below" } ],

  "model": {
    // "agents" is the ONLY field here the engine still reads — the side drawer's "Agents
    // involved" section resolves a node's own `agents` id list against this catalogue. The
    // Agent Inventory, Inputs & Outputs, Data Flow Matrix, and Source Traceability tabs (and
    // the `model.agentflows`/`model.sources`/`deliv.bioMatrix`/`deliv.agentPhase` fields that
    // fed them) have been removed entirely — this skill's single source of truth is the
    // diagram plus its side drawer, not a set of separate reference tables duplicating the
    // same underlying data in tabular form. `contracts`/`connectivity` are accepted as
    // harmless pass-through data (useful if something consumes model.json directly outside
    // this engine) but nothing in engine_template.html currently reads them.
    "agents":       [ { "AgentID","Agent Type","Name","Parent Portal","Relationship","Purpose / Feature" } ],
    "contracts":    [ … pass-through rows, currently unused by the engine … ],
    "connectivity": [ … pass-through rows, currently unused by the engine … ]
  },

  "biz": {
    "bio":          { "nodeId": { "title","does","needs","makes","example" } },  // side-drawer plain language
    "contractPlain":{ "contractId": "plain sentence" },                          // drawer "how teams work together"
    "nameMap":      { "code": "friendly name" }                                  // code → readable name
  }
}
```

**Notes**

- `type` drives node shape and colour (see `DESIGN_SYSTEM.md`). Only `agent`,
  `start`, `end`, `external`, `system` are emitted by the default builder; the
  engine also supports `decision` / `validation` / `error` / `escalation` /
  `control` if a richer builder supplies them.
- `flows[].kind` drives connector style. `cond`/`esc`/`err` are used when a
  builder derives conditional/escalation/error paths; the default builder emits
  `seq` (bookend) and `data` (agent→agent).
- **`flows[].happy` marks whether a connector belongs to the primary success
  scenario, for the "Happy Flow" / "All Flows" header toggle.** It's
  optional and defaults by `kind` when omitted: `seq`/`data` default to
  happy (ordinary forward progression); `esc`/`err` default to NOT happy
  (escalation/error paths are exception handling by definition); `cond`
  (a decision's branch) defaults to NOT happy and has no permissive
  default — unlike the other four kinds, which branch of a decision is
  "the happy one" is a business-logic fact the data has to state
  explicitly (`"happy": true` on that one branch's flow entry), since the
  engine has no way to infer it from `kind` alone. Two subtleties worth
  getting right when authoring this field:
  1. **An edge whose `kind` would default happy (`seq`/`data`) still needs
     an explicit `"happy": false` if it's part of an exception-recovery
     path rather than the main flow** — e.g. a manual reviewer's own
     "case cleared" handoff back into the main flow is a `data` edge (so
     it'd default happy), but the reviewer is only reached via an
     escalation in the first place, so that handoff is NOT part of the
     happy path and must be marked `false` explicitly. Getting this wrong
     pulls exception-only nodes into the "Happy Flow" view.
  2. **A node counts as "on the happy path" if ANY edge touching it is
     happy** — there's no separate `nodes[].happy` field; node visibility
     is derived entirely from the happy edge set (a node is shown in
     Happy Flow view iff it's the `from` or `to` of at least one happy
     `flows[]` entry). A node reachable ONLY via non-happy edges is hidden
     automatically; nothing needs to be marked on the node itself.
- `layout.lanes[].key` may be any string; the engine colours known keys
  (`trigger/pg/ai/sys/ext`) with the reference palette and cycles a fallback
  palette for any other key, so any number of lanes render correctly.
- **Lane names render vertically (rotated -90°), wrapping to up to 2
  side-by-side columns instead of truncating with an ellipsis if one
  rotated line isn't enough — measured against the LANE'S HEIGHT, not
  `layout.laneLabelW`.** `layout.laneLabelW` defaults to 100 (up from an
  intermediate 80 once the hint — see below — needed its own column;
  190 originally, back when names rendered as horizontal wrapped text; 60
  briefly, right after the rotation, before 2-column wrapping was added).
  Widening `laneLabelW` does not give a long name (or hint) more room to
  display before wrapping/truncating — that constraint comes entirely
  from the lane's own height (`layout.lanes[].h`), which `laneLabelW` has
  no effect on; widening it only changes the rotated columns' own
  spacing/padding. If a name still doesn't fully fit even after wrapping
  to 2 lines: shorten it in the source data, rely on the hover tooltip
  (which always carries the full untruncated name plus any hint), or
  accept that a taller lane (naturally, from having more content rows)
  gets more per-line room as a side effect. **Hints render inline again**
  (both a name-embedded `"Lane Name · hint text"` and a separate `hint`
  field, combined into one string and shown as a single truncated line in
  an additional column after the name's own column(s)) — they were
  dropped from inline display for a round in between, but that's been
  reversed; the hover tooltip still exists and still carries the FULL
  untruncated name+hint for anything the on-canvas text had to truncate.
  **`layout.x0` must always be greater than `layout.laneLabelW`** (by a
  comfortable margin — `compute_layout()` uses `laneLabelW + 20`) — a node
  or connector whose x-coordinate falls under `laneLabelW` will visually
  overlap the lane gutter's own rotated content and background rule. If
  you widen `laneLabelW` by hand for its own sake (see SKILL.md's
  hand-authoring example), widen `x0` by at least the same amount too.
- **`nodes[].phase` is not just a layout coordinate — it decides connector
  routing.** Every flow is classified by comparing `phase(from)` to
  `phase(to)`: increasing = forward (normal elbow), equal = lateral (short
  direct connector between lanes — the correct way to model a same-stage
  cross-lane handoff), decreasing = backward/loop-back (routed through the
  reserved bottom bus channel). A missing or incorrectly-defaulted `phase`
  on even one node silently changes which routing mode its edges get,
  which is the single most common cause of a connector that looks
  "detoured" or "broken" in the rendered diagram despite `flows[]` itself
  being perfectly correct. Run `scripts/validate_model.py` against any
  hand-built or generated `model.json` before rendering — it reports the
  forward/lateral/backward mix and flags nodes with a missing `phase` field.
- **`flows[].from`/`flows[].to` must exactly match a `nodes[].id`.** A typo
  or a stale reference to a renamed/removed node is not rejected by the
  engine at render time — `FLOWS.forEach` does `if(!a||!b)return;`, so the
  edge is simply not drawn, with no console error and no visual placeholder.
  `validate_model.py` checks every flow's endpoints against the node id set
  and reports any dangling reference by index before the model ever reaches
  `render.py`'s template injection step.
- **A `decision` node's `branches[]` array (drawer-only "possible outcomes"
  text) is independent of `flows[]` (what's actually drawn).** Listing an
  outcome in `branches` does not create a connector — there must be a
  matching entry in `flows[]` with the same `from`/`to`, or the side drawer
  will describe an outcome the diagram doesn't visibly show.
  `validate_model.py` cross-checks this pairing.
- **A node with no outgoing entry in `flows` and `type !== "end"`** is treated
  as a genuine dead end and flagged in its side drawer, not silently
  rendered as if nothing were missing. If that's not intentional, add the
  missing edge; if it is (e.g. a rejected/exception terminal), that's fine —
  the flag is informational, not an error.
- At render time the engine derives a few internal-only values from this
  data that never need to be supplied: `LY._colShift` (per-phase-boundary
  horizontal shift, computed when a connector label needs more room than its
  column gap provides) and `LY._preLegendTotalH` (canvas height before the
  legend's export-only extension, used as the content height in the live
  width-first fit (see SKILL.md item 9) so
  the sticky legend footer doesn't cause the rest of the diagram to shrink
  to make room for space it no longer occupies on screen). These are
  computed, not authored — mentioned here only so a future engine change
  doesn't reintroduce a value that already exists.
