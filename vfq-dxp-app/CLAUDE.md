## Persona × feature matrix — MUST be updated with every new feature

`reference/VFQ_DXP_Persona_Feature_Applicability_Matrix_Reference.xlsx` is the
SSOT for which persona can use which implemented feature. It is **generated**,
never hand-edited.

**Whenever you add or remove a feature/screen in this app, update it in the
same change** — it is not a follow-up task:

1. Add the feature to `MODULE_FEATURES` (if it calls `registerScreen()` with
   `SCR-` ids) or `WORKSPACE_FEATURES` (if routed directly in `router.tsx`) in
   `reference/scripts/build_persona_feature_matrix.py`.
2. Regenerate: `python3 reference/scripts/build_persona_feature_matrix.py`

Rules the script enforces — do not work around them:

- Only *implemented* features appear. The built set is discovered from
  `registerScreen()` calls, the same registry the router uses to choose between
  a real screen and `<ScreenNotYetBuilt>`.
- A `✓` requires positive evidence: an `rbac.json` row on one of the feature's
  screens, or an explicit persona gate in code. Never hand-tick a cell — pass a
  persona set only when code actually gates the feature, otherwise pass `None`
  and let `rbac.json` decide. Blank means "no evidence", not "denied".
- The script re-reads the persona gate sets out of `agentPrivilegeEngine.ts` and
  `TicketDetail.tsx` on each run and **aborts** if they drifted from its own
  constants; it also aborts if a referenced `SCR-` id is no longer registered.
  If it aborts, fix the constants — that abort is the feature working.

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
