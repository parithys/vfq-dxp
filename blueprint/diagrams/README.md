# Visual Diagrams (Information Architecture, Application Architecture, ERD)

The three visual deliverables from the original 41-item list that Stages A–D produced only as text/JSON:
1. **Application Architecture Diagram** — the 5-engine simulation architecture from `../reconstruction-package/docs/frontend-architecture.md`, rendered visually.
2. **Information Architecture Diagram** — the Platform → 16-Module tier of `../module-hierarchy.md`, rendered as a navigation tree.
3. **Entity Relationship Diagram** — the 14 most-referenced entities of `../domain-model.md`'s 83, with their evidenced relationships.

## Files

| File | What it is |
|---|---|
| `VFQ-DXP-Architecture.docx` | The stakeholder-ready document — cover page, executive summary, technology inventory, all three diagrams, component/data-flow tables, navigation hierarchy table, 14 core data-model definitions, and the assumptions list. **Open this first.** |
| `architecture-spec.json` | The source of truth these diagrams and tables were generated from — edit this and re-render to update the diagrams (see below). |
| `technical-architecture.png` | Application Architecture Diagram (standalone image) |
| `information-architecture.png` | Information Architecture Diagram (standalone image) |
| `entity-relationship-diagram-core-domain-entities.png` | Entity Relationship Diagram (standalone image) |

## Evidence status

**This is architectural design synthesis, not extraction** — same caveat as the rest of Stage D. `architecture-spec.json`'s `assumptions` array (and the docx's final "Assumptions & Confidence" section) spell out exactly what is Assumed (the entire tech stack, the deployment model) versus what is directly traceable to evidence-cited blueprint content (module/screen/entity counts and relationships, all citable back to `blueprint/*.md`).

Two scope simplifications, both noted in the spec:
- The Information Architecture diagram shows the **Platform → Module tier only** (16 nodes) for legibility — the Module → Sub-Module → Screen tier (213 screens) is in the docx's navigation table and in full in `../module-hierarchy.md` / `../screens.md`.
- The ERD shows **14 of 83 domain entities**, curated by reference frequency (how often each entity is co-referenced across the module hierarchy's features) to stay within a legible node count — the remaining 69 are in `../domain-model.md`.

## Regenerating after an edit

This was built with the `create-application-architecture` skill's two scripts, adapted for a from-blueprint spec rather than a live-codebase scan (no application code exists yet):

```bash
# 1. Edit architecture-spec.json (e.g. update a diagram_mermaid string or a data model)

# 2. Re-render the three PNGs (needs @mermaid-js/mermaid-cli via npx, and a Chrome/Chromium binary —
#    set PUPPETEER_EXECUTABLE_PATH if auto-detection doesn't find your cached/installed Chrome)
python3 <path-to-skill>/scripts/render_diagrams.py architecture-spec.json --out-dir .

# 3. Rebuild the docx
python3 <path-to-skill>/scripts/build_docx.py architecture-spec.json --diagrams-dir . --out VFQ-DXP-Architecture.docx
```

Both scripts are application-agnostic and read only `architecture-spec.json` — no other project-specific code.
