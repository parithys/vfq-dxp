# Interactive Drawer Guide — Metadata-Driven Detail Panel

**Version:** r9 (metadata-driven rewrite)
**Status:** Authoritative reference for §11.3 (Optional interactivity layer) of `conformance-standard.md`

## Overview

When `interactive: true` is set in your diagram spec, clicking (or Enter/Space-activating) any
**node or connector** opens a right-hand detail drawer. The drawer is the **single place** a user
goes to see everything known about the selected element — it is a comprehensive contextual
information panel, not a fixed four-field template.

The drawer renders **every field present in the source data** for the clicked element:

1. **Header** — badge (element type), title, role/actor line. **Pinned (sticky) while the body
   scrolls**: the header carries the element's identity, and the metadata below it can run to
   several screens, so an unpinned header leaves you reading field labels with nothing on screen
   saying which element they belong to. It also keeps the close control permanently reachable.
   The block needs an opaque background (content scrolls underneath it) and a sticky `top` equal to
   its own negative top margin — sticky constrains the *margin* box, so `top: 0` would leave a
   strip along the top edge where scrolled content shows through above the header.
2. **Incoming / Outgoing Paths** — always shown for elements (steps, decisions, gateways,
   integrations, everything with edges), hidden for connectors. Rendered as a bordered panel with
   the two directions **side by side**: they are a matched pair (what feeds this element / what it
   feeds), and stacking them forced the reader to scroll to compare two halves of one idea. Each
   entry is a button carrying a neutral direction arrow plus the target's name in ink; the
   connector's own payload label drops to a second, indented line in muted grey — it describes the
   *connector*, so it sits outside the control that navigates to the target node. The grid uses
   `auto-fit` / `minmax(128px, 1fr)` and collapses back to one column when the drawer is dragged
   below roughly 340px, so the columns never crush at the 320px minimum width.
3. **Dynamic metadata body** — every other field on the element, grouped under readable headings,
   with anything unrecognised swept into a trailing **Additional Details** section so nothing from
   the source data is ever dropped.

This applies uniformly to every element kind your process model contains: activities, tasks,
process steps, decisions, gateways, validations, business rules, conditions, events, integrations,
data stores, documents, notifications, exceptions, outcomes, connectors, and process artefacts.
There is exactly one rendering engine; there is no per-element-type template to maintain.

## The core principle: denylist, not allowlist

The generator does **not** maintain a fixed list of "known" business fields that are allowed
through to the drawer. Instead, it strips only true layout/engine plumbing from a node (pixel
coordinates, box dimensions, internal config objects) and passes **everything else through
verbatim** as that node's `meta`. Whatever field name you invent — `sourceSystem`, `slaTarget`,
`escalationOwner`, `contractRef`, anything — reaches the browser and is rendered automatically.

**This means:**
- You never need to edit `scripts/generate.js`, `assets/template.html`, or any drawer markup to
  add a new kind of metadata to your diagram. Add the field to your spec's JSON; it appears.
- No information in your source data can be silently hidden, truncated, simplified, or discarded.
  A field the drawer doesn't have a named group for still renders, under "Additional Details".
- Two diagrams with completely different metadata shapes (say, a customer journey map with `nps`
  and `emotionalState` fields vs. a technical integration diagram with `apiEndpoint` and
  `authMethod`) both work correctly with zero code changes.

## Enabling the feature

Set `interactive: true` at the top level of your spec:

```json
{
  "title": "My Process",
  "interactive": true,
  "flow": [
    { "type": "start", "label": "Start" },
    { "type": "step", "id": "review", "kind": "manual", "title": "Review Request" },
    { "type": "end", "label": "Complete" }
  ]
}
```

## Adding metadata to a node

Add **any** fields you want to any `step` or `decision` node. There is no schema you must match —
below is a curated list of field names the drawer already recognises and groups nicely, but this
list is a **convenience**, not a ceiling. Anything not on this list still renders correctly, just
under "Additional Details" instead of a named group.

### Recognised field groups (drawer display order)

| Group | Field names recognised (add any of these — none are required) |
|---|---|
| Overview | `description`, `desc` (array), `purpose`, `businessContext`, `meaning`, `kind`, `variant` |
| Ownership & Actors | `actor`, `actors`, `owner`, `team`, `responsibleParty` |
| Systems & Integration | `sourceSystem`, `targetSystem`, `systems`, `systemInteractions`, `apiDetails`, `integration`, `endpoint` |
| Data | `inputDesc`, `outputDesc`, `dataIn`, `dataInput`, `dataOut`, `dataOutput`, `dataEntities`, `dataTransformation`, `payload` |
| Business Rules & Validation | `businessRules`, `policyConstraints`, `validationRules`, `validationOutcome` |
| Decision Logic | `decisionLogic`, `evaluationCriteria`, `ruleExpression`, `conditions`, `outcomes` |
| Conditions, Triggers & Events | `entryCondition`, `exitCondition`, `triggerEvent`, `triggeringEvent`, `resultingEvent`, `precondition`, `preconditions`, `postcondition`, `postconditions` |
| Dependencies & Process Impact | `dependencies`, `prerequisites`, `upstreamImpact`, `downstreamImpact` |
| Outcomes & Exception Paths | `successPath`, `failurePath`, `exceptionPath`, `fallbackPath`, `rejectionPath`, `escalationPath` |
| Notifications & Status | `notifications`, `statusTransitions`, `stateTransitions` |
| Audit, Compliance & Governance | `audit`, `compliance`, `governance` |
| KPIs, SLAs & Metrics | `kpis`, `slas`, `metrics` |
| References & Related Items | `documents`, `references`, `relatedJourneys`, `capabilities`, `requirements`, `relatedElements` |
| Flow Labels | `edgeLabel`, `yesLabel`, `noLabel`, `wrapLabel` |
| Example | `example` — rendered as an italic **callout card**, not a plain paragraph |
| *(anything else)* | **Additional Details** — automatic, no configuration needed |

### Value shapes the renderer understands

- **String / number / boolean** → rendered as a short paragraph.
- **Flat array of strings** → rendered as a bulleted list
  (e.g. `"businessRules": ["Must hold valid consent", "Max 3 retries"]`), **unless** every entry is
  a single bare token (no spaces, 40 chars or fewer) — then it renders as inline **chips**
  (e.g. `"dataEntities": ["ProductCode", "Customer.legalName", "SYS-01"]`).
  The choice is made from the *shape* of the values, never the field name, so any field holding an
  identifier set gets chips without being added to a list somewhere. The whitespace test is what
  draws the line: `"Prospective Customer"` under `actors` is just as short as `"SessionToken"` but
  is a phrase, and chipping phrases makes them read as enum values rather than as a list.
- **Array of objects** (e.g. `"outcomes": [{ "label": "Approved", "condition": "score >= 80", ... }]`)
  → rendered as one card per entry, listing every key in that object as its own label/value row.
  This is how decision outcomes, integration contracts, or any other structured, repeating record
  should be modelled.
- **Plain object** (e.g. `"audit": { "loggedBy": "system", "retention": "7 years" }`)
  → rendered as one **card per key**, with the key stacked as an uppercase label above its value.
  Stacked rather than inline because these values are frequently full sentences (business meaning,
  downstream impact); an inline `Key: sentence` row wraps its later lines into a narrow ragged
  column hanging off the key. Array-of-object entries use the same stacked treatment inside their
  card, so both shapes read identically.

### Example — a fully-populated activity node

```json
{
  "type": "step",
  "id": "kyc-check",
  "kind": "automated",
  "role": "Compliance Engine",
  "title": "KYC Verification",
  "desc": ["Identity + sanctions", "screening"],
  "edgeLabel": "verification result",
  "purpose": "Confirms the customer's identity and screens against sanctions/PEP lists before account activation.",
  "businessContext": "Required by AML regulation before any funds can be held for a new customer.",
  "actor": "Compliance Engine (automated)",
  "owner": "Compliance Operations",
  "sourceSystem": "Onboarding Portal",
  "targetSystem": "KYC Provider (Refinitiv World-Check)",
  "systemInteractions": "Synchronous REST call; 3 retries with exponential backoff on timeout.",
  "inputDesc": "Customer legal name, DOB, government ID number, address",
  "outputDesc": "Verification status (pass/fail/manual-review), match confidence score",
  "dataEntities": ["Customer.legalName", "Customer.dob", "Customer.govId"],
  "businessRules": ["Match confidence >= 95% auto-passes", "60-94% routes to manual review", "<60% auto-rejects"],
  "validationRules": ["Government ID must not be expired", "Address must match a supported jurisdiction"],
  "preconditions": ["Customer has submitted a complete application"],
  "postconditions": ["Customer.kycStatus is set to pass, fail, or review"],
  "dependencies": ["Onboarding Portal must have captured a valid ID scan"],
  "downstreamImpact": "A fail or review result blocks account activation until Compliance Operations resolves it.",
  "exceptionPath": "Provider timeout after 3 retries routes to manual queue with an SLA-breach alert.",
  "notifications": ["Customer notified of pending review status", "Compliance Operations paged on provider outage"],
  "audit": { "loggedBy": "system", "retention": "7 years", "regulatoryBasis": "AML/BSA" },
  "kpis": ["Auto-pass rate", "Average verification latency"],
  "slas": ["95% of checks complete within 30 seconds"],
  "documents": ["AML Policy v4.2", "KYC Provider SLA"],
  "example": "A customer applying from a supported jurisdiction with a valid passport auto-passes in 4 seconds."
}
```

Every one of these fields appears in the drawer, grouped as shown in the table above, with zero
additional configuration.

## Decisions and gateways

Decision/gateway nodes get everything a regular step gets, plus special support for branch-level
detail via the `outcomes` field (an array of objects), which the Decision Logic group renders as
individual outcome cards:

```json
{
  "type": "decision",
  "id": "risk-tier",
  "title": ["Risk", "Tier?"],
  "yesLabel": "Low/Medium",
  "noLabel": "High",
  "no": { "to": "manual-review" },
  "decisionLogic": "Composite score from identity confidence, transaction velocity, and geography risk.",
  "evaluationCriteria": "Weighted sum of 6 risk factors, threshold recalibrated quarterly.",
  "ruleExpression": "riskScore = 0.4*identityConf + 0.3*velocityFlag + 0.3*geoRisk; HIGH if riskScore > 0.7",
  "outcomes": [
    {
      "label": "Low/Medium risk",
      "condition": "riskScore <= 0.7",
      "to": "auto-approve",
      "businessImpact": "Customer proceeds to instant activation.",
      "exceptionPath": "None."
    },
    {
      "label": "High risk",
      "condition": "riskScore > 0.7",
      "to": "manual-review",
      "businessImpact": "Activation delayed pending human review; adds 1-2 business days.",
      "exceptionPath": "Escalates to Fraud Ops if unresolved after 48 hours.",
      "escalationPath": "Fraud Ops Tier 2 queue"
    }
  ]
}
```

Combined with the always-present Incoming/Outgoing Paths section (which already shows the
Yes/No — or any other labelled — branches as graph edges), this satisfies the full decision
requirement set: all incoming and outgoing paths, decision logic and evaluation criteria,
true/false-style conditions, rule expressions, branch-specific outcomes, exception/escalation
paths, and the business impact of each outcome.

## Connectors and transitions

**Connectors are clickable too.** Every rendered connector — a flow arrow between consecutive
steps, a decision's negative branch, a loop-back, an exception path, a row-wrap continuation — is
wrapped as an interactive control. Clicking (or Enter/Space-activating) one opens the same drawer,
populated for that connector instead of a node.

By default the drawer shows, for any connector: **Source Element**, **Target Element**,
**Connector Style**, and — if the connector carries a label — **Transition Condition**. To attach
richer connector metadata, add a `meta` object at the point the connector is declared in your spec:

- **On a flow edge** (the implicit connector between two consecutive `flow[]` entries): attach an
  `edgeMeta` object to the **source** node.
- **On a decision's negative branch**: attach `meta` inside the `no` object.
- **On a loop / exception path** (`spec.loops[]`): attach `meta` on that loop entry.
- **On a row-wrap continuation**: attach a `wrapMeta` object to the source node.

```json
{
  "type": "step",
  "id": "submit-application",
  "kind": "manual",
  "title": "Submit Application",
  "edgeLabel": "application payload",
  "edgeMeta": {
    "routingPurpose": "Hands the completed application to automated underwriting.",
    "triggerEvent": "Customer clicks Submit",
    "dataTransferred": "Application.json (customer profile, requested product, consents)",
    "businessMeaning": "Marks the customer's formal request; starts the SLA clock.",
    "downstreamImpact": "Underwriting cannot begin until this transfer completes successfully."
  }
}
```

```json
{
  "type": "decision",
  "id": "credit-check",
  "title": "Credit OK?",
  "no": {
    "to": "manual-underwriting",
    "meta": {
      "routingPurpose": "Routes borderline applications to a human underwriter.",
      "condition": "creditScore < 650",
      "businessMeaning": "Automated approval is not confident enough to proceed unattended.",
      "downstreamImpact": "Adds 1 business day to the application timeline."
    }
  }
}
```

```json
{
  "loops": [
    {
      "from": "manual-underwriting",
      "to": "credit-check",
      "label": "re-score",
      "style": "revision",
      "meta": {
        "triggerEvent": "Underwriter requests updated bureau pull",
        "dataTransferred": "Refreshed credit report",
        "businessMeaning": "Ensures the decision uses current data before a final call."
      }
    }
  ]
}
```

Any field you place in a connector's `meta`/`edgeMeta`/`wrapMeta` object is rendered the same
metadata-driven way as node fields — grouped where a Connection/Condition/Data/Business Meaning
heading applies, or under Additional Details otherwise.

## Complete field-name reference (edges)

| Group | Field names recognised |
|---|---|
| Connection | `source`, `target`, `style`, `routingPurpose` *(source/target/style are computed automatically)* |
| Condition & Trigger | `transitionCondition` *(auto-derived from the connector's label if not set)*, `condition`, `triggerEvent`, `triggeringEvent` |
| Data | `dataTransferred`, `payload` |
| Business Meaning & Impact | `businessMeaning`, `upstreamImpact`, `downstreamImpact` |
| *(anything else)* | Additional Details — automatic |

## Styling & layout

The drawer uses a **fixed-width right panel** that can be resized by:
- **Dragging** the left edge handle (mouse/touch)
- **Keyboard** arrow keys (when the handle is focused)
- **Clamped range**: 320px (minimum readable width) to 760px (maximum)

### Key CSS classes (if hand-authoring)

**Heading hierarchy.** Primary section headings (Overview, Ownership & Actors, Data, and the
connector-mode equivalents) render at `#000000`; the per-field subheadings beneath them
(`.pf-field-label`) stay at `#6b7280`. The two ranks were previously the same grey, which flattened
the hierarchy and made a section title read as just another field label. The black rule is scoped
to `#pfDynamic`, so the Paths card's INCOMING/OUTGOING labels — the same `<h3>` element, but
labelling two columns *within* one section rather than a section itself — deliberately stay muted.

```css
.pf-drawer-meaning   /* scalar-valued field rendered as a paragraph */
.pf-field-label      /* the uppercase label above a rendered field's value */
.pf-meta-list        /* bulleted list for a flat array field */
.pf-meta-card        /* one card per entry of an array-of-objects field (e.g. decision outcomes) */
.pf-meta-row         /* one label/value row inside a card or plain-object field */
.pf-meta-key         /* the label half of a .pf-meta-row */
.pf-meta-val         /* the value half of a .pf-meta-row */
```

All body text uses `font-size: 0.75rem` (or `0.72rem` inside cards) and `color: #cbd5e1`/`#e2e8f0`
for consistency with the rest of the drawer.

## Empty states

- **No metadata at all on an element**: the dynamic body shows "No additional details were
  provided for this element in the source data."
- **No inbound edges**: "Nothing flows into this element."
- **No outbound edges**: "Nothing flows out of this element."

All empty-state text uses `color: #475569` and `font-style: italic` to distinguish it from actual
content.

## Accessibility

- Drawer is a `role="dialog"` with `aria-labelledby` pointing to the element title.
- Both nodes and connectors are keyboard-focusable (`tabindex="0"`, `role="button"`) with a
  descriptive `aria-label`.
- Keyboard support: `Esc` to close (returns focus to whatever control opened the drawer, node or
  connector), arrow keys to resize.
- All text is readable (min 10px / 0.75rem after scale).

## Implementation notes

The feature is **purely additive**:
- When `interactive` is false or omitted, no drawer markup, CSS, or JavaScript is emitted. The HTML
  remains byte-identical to the static design system.
- All interactive functionality requires explicit opt-in via `interactive: true`.
- The full node and edge metadata is embedded in the page (`<script>`) as `PF_NODES` / `PF_EDGES`,
  so no additional server calls are needed and the file remains a single, offline-viewable artefact.
- The metadata-driven renderer (`pfRenderGroups`, `pfRenderValue`) is generic: it does not special
  case any field name in its logic. `PF_NODE_GROUPS` / `PF_EDGE_GROUPS` are ordered lookup tables
  used only to choose a heading and a display order — every field the tables don't mention is still
  rendered, just later, under Additional Details.

## Best practices

1. **Use the recognised field names where they fit** — they get a proper section heading and sit in
   a sensible reading order. Anything else still works, just less prominently grouped.
2. **Model repeating, structured facts (decision outcomes, integration contracts, notification
   rules) as arrays of objects**, not as prose — the renderer turns each entry into its own card
   with every sub-field labelled, which is far more scannable than a paragraph.
3. **Attach connector metadata at the point the connector is declared** (`edgeMeta` on the source
   node, `meta` inside `no`, `meta` on a loop entry) rather than duplicating it on both endpoints.
4. **Never worry about "will this field show up"** — if it's on the node or edge object in your
   spec, it shows up. There is no allowlist to update.
5. **Keep the underlying data complete rather than terse.** Because nothing is truncated or
   summarised by the renderer, the drawer is exactly as good as the data you put into the spec.

## Testing

To verify the drawer is working:

1. Set `interactive: true` in your spec.
2. Add rich metadata (several field groups, at least one array-of-objects field, and at least one
   connector `meta`/`edgeMeta`) to a handful of elements.
3. Generate the diagram with `node scripts/generate.js spec.json out.html`.
4. Open `out.html` in a browser.
5. Click a node — the drawer should slide in, showing header, Incoming/Outgoing Paths, and every
   metadata group your fields populated, in the documented order, with any unmapped field under
   Additional Details.
6. Click a connector (a thin line/path between two nodes) — the drawer should open with Source,
   Target, and whatever connector metadata you attached, and the Incoming/Outgoing Paths section
   should be hidden.
7. Click another node/connector — the drawer should update in place.
8. Press `Esc` to close; click again to re-open. Confirm focus returns to what you clicked.

---

**For full interactive conformance rules, see `references/conformance-standard.md` §11.3.**
