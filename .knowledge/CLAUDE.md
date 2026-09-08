# Vodafone DXP Knowledge Base — Bootstrap Guide

**Created:** 2026-08-27
**Coverage:** 93 documents indexed | 1 fully extracted | 92 ready for extraction

---

## Quick Start (30 seconds)

1. **Open** `.knowledge/INDEX.md` — Your routing table
2. **Find** your business domain (Prepaid, Postpaid, FWA, Fixed Line, SIM Swap, etc.)
3. **Click** the slug → Opens detailed summary
4. **Read** the summary for complete procedures and rules

---

## Example Queries

**"How do customers activate postpaid on tablet?"**
→ INDEX → Postpaid Activation → `open-ui-tablet-new-postpaid-docx`

**"What documents are required for prepaid?"**
→ INDEX → Prepaid → Click slug → Read "Business Rules" section

**"What's the difference between B2B2C and standard postpaid?"**
→ INDEX → Compare both postpaid variants → Read both summaries

**"How does SIM swap work?"**
→ INDEX → SIM & Card Management → `sim-swap-tablet-desktop-vanilla-order-approval-journey-docx` (FULLY EXTRACTED)

---

## File Structure

```
.knowledge/
├── INDEX.md                    ← START HERE: Routing table
├── CLAUDE.md                   ← This file
├── manifest.json               ← Document registry
├── extraction_plan.json        ← Batch plan
└── docs/
    ├── sim-swap-*.md           ✓ FULLY EXTRACTED
    └── ... (92 more pending)
```

---

## Document Status

| Level | Definition | What to Do |
|-------|-----------|-----------|
| **HIGH** ✓ | Fully extracted with complete procedures | Use as primary source |
| **PENDING** ⏳ | Metadata ready, awaiting content extraction | Use INDEX for navigation |
| **MEDIUM** | Recordings catalogued, awaiting transcription | Coming soon |

---

## What's Fully Extracted

✅ **SIM Swap Order Approval Journey** — All 5 channels documented:
- Global Search mobile entry
- Vanilla backend processing
- Open UI Desktop approval queue
- Desktop rejection workflow
- Open UI Tablet end-user journey
- Tablet approval queue

---

## What's Next

⏳ **Batch 2-5:** Extract remaining 92 journey specifications (~2-3 hours)
⏳ **Batch 6-8:** Process 40+ business process recordings (speech-to-text)
⏳ **Batch 9:** Index project reference files (business rules, glossary)

---

## Pro Tips

**Use slugs for traceability:**
Good: "Customer uploads QID (`open-ui-tablet-new-postpaid-docx`)"
Bad: "Customer uploads QID"

**Find contradictions?**
Report the two conflicting slugs — helps improve the index

**Want business rationale?**
Check the meeting recordings (Days 9-12) once extracted

---

## Troubleshooting

**"The index doesn't list what I need"**
→ It's in the pending extraction queue. Check the detailed report.

**"I need step-by-step procedures"**
→ Open the summary in `.knowledge/docs/<slug>.md`

**"I need business rules"**
→ Summary → "Business Rules & Constraints" section

---

**This knowledge base is your single source of truth for Vodafone DXP.**

Every answer traces back to a source document (slug) you can verify.

