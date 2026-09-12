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
| `VFQ_DXP_Test_Data_Reference.xlsx` | Standing test-data reference workbook (login credentials, seeded records, mock scenarios) — regenerated via `scripts/build_test_data_reference.py` after every functional change |
| `VFQ_DXP_Personas_Reference.xlsx` | All 66 `public/config/personas.json` entries, full raw schema (ID, Name, Type, Responsibilities, Permissions, Restricted Features, Confidence) plus two derived columns (a concise Persona Description and an 11-bucket System Role Key grouping); plus a user-maintained `Abbreviations` sheet for corpus jargon (DSA, TON, WFM, KID, etc.) and an `Approval Routing Note` sheet recording the evidence-grounded decision that retail-store and back-office approval requests share one generic Manager/Approver role rather than distinct personas |
| `VFQ_DXP_Abbreviations_Reference.xlsx` | 275 project abbreviations/acronyms (Abbreviation, Full Form, Alias, Description, Category, Context/Usage, Status) — merged and deduplicated from `../Glossary.xlsx` (132 terms, project root), 9 corpus-search terms added earlier (DSA, OFS/OFSC, MCCR, BSA, PSA, GWC, OMS, SADMIN, RBAC), and a user-supplied 199-term list (mostly generic IT/TM-Forum-API terms with no per-term citation). One genuine cross-source conflict (OSM) is flagged in its own highlighted row rather than silently resolved — see its `Sourcing Note` sheet for full merge methodology |

**Generated documentation/analysis artifacts** (gap analyses, RBAC reviews, persona/reference
exports, and similar deliverables produced on request) are saved directly in this folder, named
`VFQ_DXP_<Topic>_Reference.<ext>` or `VFQ_DXP_<Topic>_<Report type>.<ext>` to match the existing
files above — not left only in a scratch/temp location — so they stay discoverable for future
analysis, design, requirements validation, and RBAC review work.

**Raw source corpus lives one level up, at the project root** — `data/`,
`Guided Journeys/`, `Workshop Recordings/` — not inside `vfq-dxp-app/`, since
it is large (6.5GB+) and genuinely reference-only. Citations inside these
documents of the form `data/<file>` refer to that root-level folder, i.e.
`../data/<file>` relative to files in here.

See `../CLAUDE.md` for the full project-structure note and knowledge-base
lookup instructions.
