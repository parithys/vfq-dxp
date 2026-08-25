# Reference material

This folder holds the distilled reconstruction documentation for the VFQ DXP
project — it is **not** consumed by the application at build time or runtime.
It moved here from the project root on 2026-08-25 so that `vfq-dxp-app/` is a
single, self-contained source of truth for the active implementation.

| Folder/file | What it is |
|---|---|
| `blueprint/` | Reconstructed requirements, business rules, journeys, personas, screen catalogue, RBAC, traceability docs |
| `.knowledge/` | Indexed summaries of the raw workshop/BRSD/form corpus, with per-document confidence scoring |
| `diagrams/` | Standalone HTML process-flow diagrams for individual journeys/workflows |
| `BRSD/` | Formal business requirement spec workbooks |
| `VFQ_DXP_Figma*.md` | One-time design-generation prompts used to originally scaffold the app via Figma Make |
| `VFQ_Phase1*` | Phase 1/1.5 gap-remediation and confidence-verification reports |
| `CRM_Journeys_Final_Updated_with_Type.xlsx` | The 165-row journey/workflow/view/action/access catalogue, with the Unique ID + Mapping Report added — see `configEngine.ts`'s `journeyCatalogueMap` for how a subset of these IDs surface on module/screen cards |

**Raw source corpus lives one level up, at the project root** — `data/`,
`Guided Journeys/`, `Workshop Recordings/` — not inside `vfq-dxp-app/`, since
it is large (6.5GB+) and genuinely reference-only. Citations inside these
documents of the form `data/<file>` refer to that root-level folder, i.e.
`../data/<file>` relative to files in here.

See `../CLAUDE.md` for the full project-structure note and knowledge-base
lookup instructions.
