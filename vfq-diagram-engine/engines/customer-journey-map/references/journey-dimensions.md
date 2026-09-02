# Customer Journey Map — Content Model (Normative)

**This map has exactly 15 rows, in this fixed order. Never add, remove, reorder, or rename them.**

1. Stage
2. Goals
3. Customer / Agent Actions
4. Touchpoints & Channels
5. Supporting Systems
6. Thoughts
7. Emotional Journey (rendered visual)
8. Customer Experience
9. Pain Points
10. Current Responses
11. Opportunities
12. KPIs / Key Metrics
13. Business Goals
14. Teams / Responsible Parties
15. Structural Metrics (rendered visual)

Every stage must populate all 15. If a row is genuinely thin for one stage, write the honest short
version (`"None identified"` / `"Not currently tracked"`) rather than inventing content — never omit
the row itself.

**Render each row in the format suited to its content, not uniformly as bullets.** Rows 2, 3, 4, 5, 8,
13 read as dense prose or a plain comma list (see patterns below); rows 9, 10, 11, 12 are short fact
lines (one per stage, occasionally two); row 6 is a quote; row 14 is a comma list; rows 7 and 15 are
rendered visuals, never text. Fifteen rows of uniform bullets is exactly what makes a map read as a
spreadsheet — the variety in format is what keeps fifteen rows readable as a designed document instead.

## Row-by-row

### 1. Stage
Short business-friendly title (2–4 words), customer's language, optional parenthetical system/process
qualifier (`"Capture & Validate (RFS)"`).

### 2. Goals
**The customer's goal at this stage — prose, one sentence.** What they're trying to accomplish and why,
in their frame. Distinct from row 13 (Business Goals), which is the organisation's objective for the
same stage — the two often pull in different directions and that tension is part of the point of having
both rows.
*Quality bar:* a customer outcome ("get a working SIM before my flight tonight"), not a process step.

### 3. Customer / Agent Actions
One dense clause-chain sentence — customer action, agent action, system-assisted steps, decision
points, joined with semicolons, trailing code in parentheses. Pattern: `"Agent captures installation
address via Utility ID; performs RFS check; uploads Tenancy (RFS)"`.

### 4. Touchpoints & Channels
One dense clause naming every live channel/actor combination. Pattern: `"{channel} / {actor} -
{device/platform} ({code})"`, e.g. `"Store / Agent - Tablet (Tablet)"`.

### 5. Supporting Systems
Comma-separated named systems — `"DXP, Siebel CRM, Qnomy"`. Stays a plain list, not prose (proper
nouns read cleanly as a list). Fold integration points in here when they matter.

### 6. Thoughts
**One representative verbatim or plausible-illustrative quote, in quotation marks, italic.** What the
customer is thinking or unsure about at this point — the internal narrative that the Emotional Journey
row (next) then visualises as a category. Attach a `source` when it's real research (`"Interview P4"`);
mark it `"Illustrative"` when it isn't. Never present an invented quote as verbatim without saying so.
*Quality bar:* specific and felt ("Why do I have to re-enter my address a fourth time?"), not generic
("customer is confused").

### 7. Emotional Journey (visual row)
Unchanged from the prior model: a rendered dot-and-line chart. Each stage needs `category` (`positive |
neutral | friction | delight`), a bold `milestoneLabel`, and an optional `stateWord` for genuine
peaks/troughs only. See `references/design-system.md` §5 for the render contract — this row has broken
twice before on viewBox scaling and label collision; the fixes there are load-bearing, not stylistic.

### 8. Customer Experience
**One synthesising sentence — how the stage actually feels to go through, as a reader would describe
it, not a repeat of the Thoughts quote or the emotion category.** This is the row that turns "friction"
into something a stakeholder can picture: `"A fast, confident digital moment undercut only by an
unexplained rate change."` *Quality bar:* adds a perspective the other rows don't already give — if it
just restates row 6 or 7, tighten it or cut it back to a genuinely new observation.

### 9. Pain Points
Unchanged: one line per stage, specific, mechanism-naming, with a traceable ID. `"{failure and
consequence} (ID)"`. Bad: "Customer faces difficulties." Good: "Address validation failure causes order
rejection (RFS-001)."

### 10. Current Responses
**What the business does today, right now, in response to that pain point — the existing mitigation
or workaround, not a future fix.** Pattern: `"{what happens today} (ID)"`, e.g. `"Agent manually
re-keys the address into the fallback system (RESP-RFS-001)"`. This is deliberately distinct from
Opportunities (row 11): a Current Response can be inadequate (that's often the point — it documents a
workaround that shouldn't have to exist) while an Opportunity is the proposed fix. Pair 1:1 with the
pain point above it wherever a response exists; `"No current mitigation"` is a valid and informative
answer.

### 11. Opportunities
Unchanged: one scoped, actionable fix per stage, paired to the pain point, own ID. Never omit.

### 12. KPIs / Key Metrics
**Short fact lines, no bullet-per-fact narrative — this is a numbers row.** One or two metrics that
matter at this stage: `"Conversion: 72%"`, `"Avg handling time: 4.2 min"`, `"CSAT: 4.1/5"`. Never invent
a number — where nothing is instrumented, write `"Not currently tracked — recommend instrumenting
{metric}"`. This is stage-level experiential/business KPIs; it is distinct from row 15's structural
step-count metrics, which are mechanical, not experiential.

### 13. Business Goals
**The organisation's objective at this stage — prose, one sentence.** What the business is trying to
achieve here (conversion, cost-to-serve, risk reduction, retention) — read alongside row 2, the two
rows should sometimes visibly be in tension (customer wants speed; business wants fraud control) and
that tension is exactly the kind of insight this structure exists to surface.

### 14. Teams / Responsible Parties
Comma-separated list of the team(s) or role(s) that own this stage operationally — `"Digital CX Team,
Fraud & Risk"`. Plain list, like Supporting Systems, not prose.

### 15. Structural Metrics (visual row)
Unchanged: lifecycle banner with proportional fill bar (auto-computed from per-stage `steps`/`manual`,
never hand-typed) + per-stage card (short label, bar icon, `"{n} manual"`).

---

## The "no spreadsheet" check, at 15 rows

With fifteen rows the risk of reading as a spreadsheet is higher, not lower, than at eight — the
mitigation is the same principle applied more deliberately: every row keeps the rendering format suited
to its content (prose / quote / plain list / short fact lines / visual), stage columns stay equal width
and color-coded, and no row becomes a bulleted restatement of another row a few lines away. Before
shipping, check specifically that row 8 (Customer Experience) isn't just row 6 (Thoughts) or row 7's
`stateWord` reworded, and that row 2 (Goals) and row 13 (Business Goals) read as genuinely different
perspectives, not the same sentence twice.
