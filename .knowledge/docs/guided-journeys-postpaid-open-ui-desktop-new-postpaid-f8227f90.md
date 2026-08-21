---
slug: guided-journeys-postpaid-open-ui-desktop-new-postpaid-f8227f90
source: /Users/parithimalsaravanan/claude-projects/vfq/data/Guided Journeys/Postpaid/Open UI Desktop_New Postpaid.docx
sha256: cb8f630db8f3cf9c53a9822002b4d675f6b1499399efbafaafddeec4b679b84b
indexed: 2026-08-20
confidence: medium
---

# Retail New Postpaid – Edit Bill Limit Screenshot

**Type:** requirements (step/behavior notes embedded in a UI walkthrough)
**Owner / author:** not stated
**Date:** not stated

## Purpose
Documents the "Edit Bill Limit" behavior within the Retail New Postpaid journey on the Open UI Desktop interface, for a user with the VFQA Sales responsibility, including validation against an "Agent minimum value."

## Key content
- Document title (verbatim): "Retail New Postpaid – Edit Bill limit Screenshot".
- Scoped to: "User with VFQA Sales Responsibility".
- A validation rule is stated in two branches:
  - "When agent enters below Agent minimum value" (implies a rejection/blocking behavior, though the exact system response is in a screenshot and was not recovered as text).
  - "When agent enters above Agent minimum value, user can proceed the journey" — confirms that entering a bill limit above the agent minimum allows the journey to continue.
- This describes a business rule: bill limit edits by a Sales-role agent are validated against a minimum threshold before the journey can proceed.
- No requirement IDs, dates, or named individual stakeholders recovered.

## Cross-references
- Related to "Desktop Vanilla_New Postpaid.docx" in the same folder, which covers a similar Edit Bill Limit flow for the "Vanilla" (Desktop) variant — this Open UI Desktop version has more recovered validation detail.

## Extraction notes
Extraction yielded 1677 characters, mostly screenshot placeholders, but two full sentences describing the agent-minimum-value validation rule survived and are quoted above. Confidence set to medium rather than high because the majority of the step-by-step UI detail (screens, fields, exact error messaging) remains in unrecovered screenshots.
