# Journey Map JSON Schema

Exact shape `assets/template.html` expects in its embedded
`<script id="journey-data" type="application/json">` block. Build this fully before touching the
template. Field order below matches render order (row 1 → row 15).

```jsonc
{
  "meta": {
    "title": "string",
    "subtitle": "string — persona, model, data source in one line",
    "generatedDate": "ISO date",
    "source": "string"
  },
  "stages": [
    {
      "name": "string — row 1, full stage title",
      "shortLabel": "string — short form for the row 15 metrics card",
      "color": "optional hex — omit to auto-assign from the default palette",

      "goals": "string — row 2, ONE prose sentence. Customer's goal.",
      "actions": "string — row 3, ONE dense clause-chain, not an array.",
      "touchpoints": "string — row 4, ONE dense clause, not an array.",
      "systems": "string — row 5, comma-separated plain list.",

      "thoughts": {
        "quote": "string — row 6, the verbatim/illustrative quote text, no quotation marks needed here (the template adds them)",
        "source": "optional string, e.g. 'Interview P4' or 'Illustrative'"
      },

      "emotion": {
        "category": "positive | neutral | friction | delight",
        "milestoneLabel": "string — bold label under the dot, e.g. 'WFM Delay (WFM Delay)'",
        "stateWord": "optional string — colored callout above the dot. Omit for non-peak stages."
      },

      "customerExperience": "string — row 8, ONE synthesising prose sentence.",

      "painPoints": [
        { "text": "string", "id": "string, e.g. 'RFS-001'" }
      ],
      "currentResponses": [
        { "text": "string — row 10, what the business does TODAY about the pain point above", "id": "string, e.g. 'RESP-RFS-001'" }
      ],
      "opportunities": [
        { "text": "string", "id": "string, e.g. 'OPP-RFS-001'" }
      ],

      "kpis": [
        "string — row 12, short fact line, e.g. 'Conversion: 72%'"
      ],

      "businessGoals": "string — row 13, ONE prose sentence. Organisation's objective.",
      "teams": "string — row 14, comma-separated plain list.",

      "structural": { "steps": 0, "manual": 0 }
    }
  ],
  "footnote": "string — methodology + traceability note for the footer bar"
}
```

Field notes:
- `stages` order is left-to-right chronological — drives the header row and the emotion path.
- **Strings, not arrays:** `goals`, `actions`, `touchpoints`, `systems`, `customerExperience`,
  `businessGoals`, `teams` are all single strings (prose or plain-list format per
  `journey-dimensions.md`), not arrays. Do not revert these to arrays — that's what produces bulleted,
  spreadsheet-style rows.
- **Arrays:** `painPoints`, `currentResponses`, `opportunities` stay arrays of `{text, id}` — usually
  one entry, occasionally two. `kpis` is an array of plain strings (no `id` — metrics aren't findings
  that need traceability the way pain points do).
- `thoughts` is a single object, not an array — pick the one most representative quote per stage rather
  than listing several.
- `emotion.category` must be exactly one of the four values; anything else falls back to `neutral`.
  `emotion.stateWord` is optional — reserve it for genuine peaks/troughs.
- `structural.steps`/`manual` drive the row 15 auto-computed banner — never hand-type the total.
- Every array may be empty, but prefer an explicit `{ "text": "None identified" }` /
  `{ "text": "No current mitigation" }` entry over an empty array — an empty cell reads as an
  oversight, a stated absence reads as a finding.
