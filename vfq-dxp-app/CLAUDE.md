## Role master workbook — MUST be updated with every new feature or role

`reference/VFQ_DXP_Persona_Feature_Applicability_Matrix_Reference.xlsx` is the
**single source of truth** for the 26 operational roles: Staff IDs, the demo
password, persona groups, business units, approach classification, capability
(action) gates, and which implemented feature each role may reach. It is
**generated**, never hand-edited — opening it in Excel and saving will silently
rewrite it.

**Whenever you add/remove a feature, screen or role, regenerate it in the same
change** — it is not a follow-up task:

1. Edit the source, not the workbook: roles, grants, capabilities and Staff IDs
   live in `public/config/personas.json`; feature keys and their screen ids in
   `public/config/feature-catalogue.json`.
2. Regenerate: `python3 reference/scripts/build_persona_feature_matrix.py`

Rules the script enforces — do not work around them:

- Only *implemented* features appear as built. The built set is discovered from
  `registerScreen()` calls, the same registry the router uses to choose between
  a real screen and `<ScreenNotYetBuilt>`. A granted feature whose screens
  aren't registered shows as `Planned`, deliberately — it stays visible to
  indicate planned functionality rather than disappearing.
- A `✓` means `personas.json` actually grants that feature to that role.
  Nothing is inferred and nothing is hand-ticked. **Blank means deliberately
  not granted** — grants are exhaustive for the 26 roles. (This inverts the
  pre-2026-09-24 model, where a tick required an `rbac.json` evidence row and
  blank meant "the corpus never said".)
- The script **aborts** rather than emit a misleading workbook if: a capability
  is gated in code or granted in `personas.json` but missing from the
  `PersonaCapability` union in `types/config.ts`; a grant references an unknown
  feature key or permission level; a catalogue entry references a screen absent
  from `routes.json`; a Staff ID or role id is duplicated; or a role binds an
  identity absent from `users-agents.json`. If it aborts, fix the source —
  that abort is the feature working.

Superseded persona records (historical, **not** authoritative):
`VFQ_DXP_Personas_Reference.xlsx` → "Personas" (the 66-persona model), and
`VFQ_DXP_Test_Data_Reference.xlsx` → "Login Credentials" / "Persona" /
"Persona by Approach". The 66-persona model, its RBAC evidence and the two
columns unique to that workbook are archived under `reference/blueprint/legacy/`.

## Project structure

This directory (`vfq-dxp-app/`) is the single source of truth for the
application — it is fully self-contained (verified 2026-08-25: no import,
fetch, or config reaches outside this directory). `reference/` alongside
`src/`/`public/` holds distilled reconstruction documentation (requirements,
business rules, journeys, personas, screen catalogue, process diagrams,
source-confidence policy) that fed the app's construction but is not consumed
by it at runtime — treat it as background material, not part of the active
implementation, unless a task explicitly asks you to consult it.

The raw source corpus this documentation was built from — `data/`,
`Guided Journeys/`, `Workshop Recordings/` — lives one level up, at the
project root (sibling to this directory), not inside it. Citations inside
`reference/` documents of the form `data/<file>` refer to that root-level
`data/` folder, i.e. `../data/<file>` relative to this directory.

## Knowledge base

Before answering questions about the VFQ (Vodafone Qatar) stack modernization
project — workshops, business process reviews, business requirements specs
(BRSDs), business rules, customer forms, or Guided Journey UI walkthroughs —
read `reference/.knowledge/INDEX.md` first, then open only the specific
`reference/.knowledge/docs/<slug>.md` files the question requires. Do not
answer from the index one-liner alone when the question needs detail — open
the summary. Cite the slug in your answer so claims trace back to a source
document.

If `reference/.knowledge/INDEX.md` reports a document as low-confidence or
failed, say so rather than answering from it.

`../Guided Journeys/` files (one level up, at the project root) are
screenshot-driven UI walkthroughs. Plain text extraction (pandoc/markitdown)
recovers almost nothing from them — the content lives in embedded PNG
screenshots. As of 2026-08-21, all 39 of these documents have been
re-processed by extracting each `.docx`'s embedded images (it's a ZIP
container; images live under `word/media/`, true reading order comes from
`word/_rels/document.xml.rels` + the `r:embed` sequence in
`word/document.xml`) and viewing them directly, recovering full field-level
procedural detail — 38 are `high` confidence, 1 `medium`. If new files are
added to this folder later, or a fresh corpus has the same screenshot-only
problem, use this same image-extraction + direct visual reading approach
rather than relying on text extraction alone.
