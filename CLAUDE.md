## Project structure

`vfq-dxp-app/` is the single source of truth for the application — it is
fully self-contained (verified 2026-08-25: no import, fetch, or config
reaches outside its own directory). Everything else at this root (`data/`,
`Guided Journeys/`, `Workshop Recordings/`, and `vfq-dxp-app/reference/`) is
reference-only source corpus that fed the app's construction but is not
consumed by it at runtime — treat it as background material, not part of the
active implementation, unless a task explicitly asks you to consult it.

The distilled documentation that used to live at this root
(`blueprint/`, `.knowledge/`, `diagrams/`, and the loose
`VFQ_*`/`CRM_Journeys_*` files) now lives under `vfq-dxp-app/reference/`.
A stale leftover copy of `.knowledge/` remained at this root until
2026-09-27 — it claimed 93 indexed documents but held only one, and was
deleted; `vfq-dxp-app/reference/.knowledge/` (83 documents) is the only
knowledge base.

`BRSD/` is NOT under `vfq-dxp-app/reference/` — it moved to
`vfq-diagram-engine/BRSD/` on 2026-09-27, because it is that engine's input
corpus rather than the app's: `vfq-diagram-engine/manifest.json` records
every entry as `BRSD/<file>.xlsx`, which now resolves relative to the engine.
The app's own reconstruction indexed a *different* set of BRSD versions
(e.g. Fibre v1.2, Postpaid V2.0) from the `data/` folder described below,
not the workbooks that were sitting in this root's `BRSD/`.

Citations inside those documents of the form `data/<file>` refer to this
root's `data/` folder, i.e. `../../data/<file>` relative to a file's new
location under `vfq-dxp-app/reference/`. **Note (2026-09-27): that `data/`
folder no longer exists** — its contents appear to have been reorganised
into the topical folders at this root (`Business Documents/`,
`Guided Journeys/`, `Workshop Recordings/`, …), so those citations record
provenance but no longer resolve as paths.

## Knowledge base

Before answering questions about the VFQ (Vodafone Qatar) stack modernization
project — workshops, business process reviews, business requirements specs
(BRSDs), business rules, customer forms, or Guided Journey UI walkthroughs —
read `vfq-dxp-app/reference/.knowledge/INDEX.md` first, then open only the
specific `vfq-dxp-app/reference/.knowledge/docs/<slug>.md` files the question
requires. Do not answer from the index one-liner alone when the question
needs detail — open the summary. Cite the slug in your answer so claims trace
back to a source document.

If `vfq-dxp-app/reference/.knowledge/INDEX.md` reports a document as
low-confidence or failed, say so rather than answering from it.

`Guided Journeys/` files are screenshot-driven UI walkthroughs. Plain text
extraction (pandoc/markitdown) recovers almost nothing from them — the
content lives in embedded PNG screenshots. As of 2026-08-21, all 39 of these
documents have been re-processed by extracting each `.docx`'s embedded images
(it's a ZIP container; images live under `word/media/`, true reading order
comes from `word/_rels/document.xml.rels` + the `r:embed` sequence in
`word/document.xml`) and viewing them directly, recovering full field-level
procedural detail — 38 are `high` confidence, 1 `medium`. If new files are
added to this folder later, or a fresh corpus has the same screenshot-only
problem, use this same image-extraction + direct visual reading approach
rather than relying on text extraction alone.
