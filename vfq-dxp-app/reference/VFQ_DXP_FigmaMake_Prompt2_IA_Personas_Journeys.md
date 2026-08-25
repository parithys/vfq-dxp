# VFQ DXP — Figma Make Prompt 2 of 3: Navigation, Roles & Core Journeys

**Use this second, in the same Figma Make project as Prompt 1.** It assumes the design tokens, component
library, and traceability convention from Prompt 1 already exist — reuse them rather than redefining
anything. This prompt adds the app's information architecture, role-based access model, and the flagship
end-to-end journeys/wizards. After this, move on to Prompt 3
(`VFQ_DXP_FigmaMake_Prompt3_Screens_BusinessLogic_Polish.md`).

**Continue following the traceability convention from Prompt 1** (frame naming by pattern+module+step,
visible tagging of anything called out below as lower-confidence, preserving real IDs, no silent
invention beyond what's specified here).

---

## 1. Information Architecture & Navigation

### 1.1 Module Hierarchy (16 modules)

Organize the entire app's primary navigation around these 16 modules. Fixed Line/Fibre is the largest
(49 screens); Mobile Prepaid currently has zero dedicated evidenced screens (it inherits shared
postpaid/prepaid flows — do not invent standalone Prepaid screens without new evidence). Use the
relative screen counts as a rough proxy for how much navigation weight/prominence each module deserves.

Modules: **Lead Management · Mobile Postpaid · Mobile Prepaid · MNP/FNP (Number Porting) · Fixed
Line/Fibre · FWA/5G Home · Enterprise/IoT/B2B · Identity & Customer Management · Billing & Adjustments ·
Order Management · Cross-Sales & Migration · Ticketing & SIM Management · CAF/Attachments/Forms ·
Access/Roles/Approval Governance · Field/WFM (installation) · Platform Governance & Architecture.**

Note: Billing & Adjustments, Access/Roles/Approval Governance, CAF/Attachments/Forms, and Platform
Governance & Architecture have supporting screens but **no dedicated end-to-end user-journey (UJ)**
narrative in the source — they're accessed as steps within other modules' journeys, not standalone flows.
Reflect this by making them accessible via contextual entry points (e.g., CAF appears inside activation
wizards) as well as a direct module-level landing page, not as an isolated top-level flow.

Wire the App/Module Launcher Home built in Prompt 1 to route into these 16 modules.

### 1.2 Sitemap Pattern

Real evidenced route-naming convention to follow, e.g. `/mobile-postpaid/dxp-product-catalog-target-state`,
`/fixed-line-fibre/...`, `/fwa-5g-home/...` — module-slug-prefixed paths. Each module's sitemap entry
should expose: a landing/home page, its wizards (activation/change/disconnect flows), its list/queue
views, and its detail/360 views (screens are generated in Prompt 3 — for now, stub the routes/nav
structure).

### 1.3 Channel Architecture

Four device/channel contexts are evidenced, with very uneven coverage — **do not treat them as equally
weighted**:

| Channel | Screens | Journeys | Note |
|---|---|---|---|
| Desktop (Open UI) | 95 | 13 | Primary console |
| Tablet | 65 | 25 | First-class parallel channel, not a stripped-down view |
| Desktop Vanilla/Manual | 32 | 8 | Manual/fallback flows |
| Digital Self-Service | 0 | 1 | Referenced but no UI evidenced — do not design screens for it without new source material |

Of the 165 catalogued journey/workflow items: 143 are CBU (Consumer), 127 are EBU (Enterprise), 105 apply
to both. Design with a persona/segment switch in mind (see §2 below) rather than duplicating screens per
segment. **Legacy ECR/VSA references are explicitly excluded from this rebuild.** Field/WFM mobile app
and the separate MVA app are explicitly **out of scope** — the WFM screens in this corpus are the
back-office/technician-facing web views only, not a native field app.

### 1.4 Dashboards

Five true analytics dashboards are evidenced — build these as actual data-dashboards (charts, counters,
grids), not just list views, when their screens are generated in Prompt 3:

- **SCR-021 Customer 360** — customer-level dashboard
- **SCR-185 Account 360** — account-level dashboard
- **SCR-060 TM SR Queue** — service-request/approval queue dashboard
- **SCR-183 Bulk Jobs** — bulk-operation monitoring dashboard
- **SCR-211 Tickets Dashboard** — *flagged as a content gap in source* — build the shell/layout but expect thin evidenced detail

Six other screens are labeled "dashboard" in source but are actually simple tile-launcher home screens
(Pattern 12 from Prompt 1) — don't over-build these as analytics; a role-filtered tile grid is sufficient.

### 1.5 Search, Filter, Sort

13 screens have dedicated search, 5 have filtering, and only 1 has explicit sort — **do not
over-engineer this**. Add search/filter/sort affordances only where evidenced (primarily on queue/list
screens — Leads, Orders, Approvals, Tickets), not uniformly across every `DataTable` instance.

---

## 2. Personas & Access Control

### 2.1 Persona Roster (66 personas, 8 categories)

Design role-aware UI (visible modules, available actions, default landing screen) around these
categories:

- **A. Frontline/Sales** — retail agents, sales reps (primary users of activation wizards)
- **B. Back-Office/Fulfilment/Support** — order processors, billing support, back-office suspension/resume handlers
- **C. Field/Installation** — field technicians, dispatchers/WFM users
- **D. Enterprise/EBU** — account managers, EBU operations, business finance/credit control
- **E. External/Customer/Third-Party** — regulator, partner-facing roles (no direct DXP screens designed for these — access is indirect/API-mediated)
- **F. System/Automated** — background job actors (Bulk Job engine, scheduled FDO executor) — represent as system-attributed activity log entries, not as users with screens
- **G. Management/Approval** — managers/supervisors who approve orders, reassign work
- **H. Internal Delivery/Governance** — IT Ops, platform/access governance roles

**Known data conflict (carry the caveat into design, don't silently pick a side):** one persona
(back-office suspension/resume handler) has a source conflict over whether suspension requests can be
customer-initiated via Email/Phone/Retail Counter, or are strictly back-office/ticket-driven only. Design
the suspension/resume journey (§3.6 below) around the back-office/ticket-driven path as the primary flow
(higher-confidence source), and treat any retail-counter-initiated entry point as an optional, clearly-
secondary affordance pending business confirmation.

### 2.2 RBAC Summary

Of 66 personas: **30 are module-mapped** (explicit persona × module access evidenced), **31 are
evidenced but not mapped to a specific module** (build for them generically — least-privilege default),
and **5 have zero access evidence** — for these 5, default to no access and surface nothing rather than
guessing a permission set.

**Core convention: a blank/no-evidence cell means "no evidence found," not "no access."** When building
RBAC gating in the design (e.g. via a permissions/variants system in Figma Make), default unmapped
combinations to **hidden**, not merely disabled — an unevidenced permission should not silently expose a
control. Where evidence exists, use this access-level vocabulary consistently across the whole app: Full
(F), Approve (A), Edit (E), Create (C), View-only (V), Restricted/partial (~), No access (X).

### 2.3 Key Permission Patterns to Encode in the UI

These 15 patterns recur across the corpus and should shape component behavior (not just documentation):

1. **Agent Minimum floor** — credit/bill-limit fields have a role-based minimum (e.g. "Agent Minimum
   80/50") below which the value cannot be set; encode as a `CreditLimitEditor` constraint, not just a
   validation message.
2. **QID re-scan-only restriction** — some roles can re-scan/re-verify ID but not edit the underlying
   record directly.
3. **Cross-sell discretion stripping** — certain roles see cross-sell offers but cannot action them.
4. **AutoPay/primary-contact restrictions** — editing these fields is gated to specific roles.
5. **Approver/creator segregation** — the person who creates an order can never be its approver (hard
   rule — encode as a UI-level check, not just a backend assumption).
6. **Single-use correction** — a Reject-Correction cycle is allowed once per order before escalation.
7. **Sole-authority FDO cancellation** — only specific roles can cancel a Future Dated Order.
8. **Billing-cycle restriction** — some billing actions are locked outside the active billing cycle
   window.
9. **Back-office-only suspension** — manual suspension is restricted to back-office roles (see §2.1
   caveat).
10. **Enterprise credit approval** — routed through MS Dynamics discount-approval hierarchy, distinct
    from consumer credit-limit editing.
11. **DOA-tiered adjustments** — Delegation-of-Authority tiers gate adjustment amounts.
12. **Regulator override path** — a distinct, rarely-used escalation route; design as a hidden/advanced
    action, not a primary button.
13. **IT Ops exclusive source-system access** — certain system-configuration screens are IT-Ops-only.
14. **Offshore visibility scoping** — some roles have geographically/organizationally scoped visibility.
15. **Field-tech exclusions** — flagged in source for removal; do not design new field-tech restrictions
    beyond what's already in the WFM screens (§1.3 scope note).

---

## 3. User Journeys & Workflows

111 journeys (UJ-001 through UJ-111) span the 16 modules; every module except the 4 noted in §1.1 has
dedicated journeys. Build the wizards/queues using the patterns registered in Prompt 1, populated with the
real step sequences below for the highest-priority (**flagship**) journeys — use these as the canonical
reference for how every other journey in the same family should behave. **This is the core build target
for this prompt — generate each flagship journey as a working, navigable flow of screens.**

### 3.1 Flagship Journey — New Fixed Line / New Postpaid / Cross-Sales (activation family)

Canonical step skeleton (Pattern 1): **Contact → Address → Plan → Add-on & Discount → Number Selection →
SIM Serial → CAF/Attachments → Activity/Comments → Submit.** This exact sequence repeats across New Fixed
Line, FWA, MNP, and Postpaid wizards — implement it once as the `WizardShell` default and vary only the
field sets and copy per module.

**New Fixed Line Tablet (canonical reject → correct → approve reference flow):** the fullest evidenced
example of the whole lifecycle including manager rejection-with-correction and resubmission — use this as
your reference implementation for the Order Approval Queue pattern (Pattern 13) end to end.

### 3.2 Flagship Journey — MNP/FNP Port-In (Desktop & Tablet)

**Actors:** Agent, Customer, NPAS (National Porting Administration System — external), donor operator.
**Workflow:** capture MSISDN/donor details → consent capture → submit to NPAS → donor accept/reject/
conditional-accept → porting window countdown → ported. **Design implication:** this needs an
externally-dependent status/waiting state (not a simple submit-and-done) — build a status tracker showing
"submitted to NPAS → awaiting donor response → porting window → complete," since the source's Order/MNP
lifecycle explicitly has this multi-stage external wait.

### 3.3 Flagship Journey — SIM Swap (multi-channel: UJ-020/090/091)

**Workflow:** identify subscriber → validate eligibility → capture new SIM serial (real-time UIM
validation) → generate approval task → **Approval Queue** (Pattern 13) → Approve/Reject. **Channel
divergence is concrete here** — Desktop uses "SIM Swap Queue" as the entry point and a simpler
Approve/Reject; Tablet uses "Order Approval Queue" (different name), adds a "Validate Attachments" step
before the approval action, and lands the approver back on "My Activities Page" after completion (Desktop
implicitly returns to the queue). Build both explicitly rather than deriving one from the other.

### 3.4 Flagship Journey — TON Retail BAU (UJ-019, four-queue pattern)

A back-office/retail order-management flow structured around four parallel queues — use this as the
reference for any multi-queue back-office screen (queue segmentation by status/type, not a single flat
list).

### 3.5 Flagship Journey — Disconnection (UJ-025/UJ-111)

Standard disconnect workflow — identify subscriber → validate no blocking conditions (e.g. unbilled
balance) → submit → confirm. Reuse the Approval Queue pattern where the disconnect requires sign-off.

### 3.6 Flagship Journey — Suspension/Resume (UJ-107/UJ-108) — *medium confidence, see caveat*

**Workflow (Suspension):** request suspension → identify subscriber (search by MSISDN/Account) → fetch
customer & billing details → validate suspend-eligibility (**unbilled balance must be cleared first** —
a hard precondition, encode as a blocking validation) → agent changes plan to a "Park Plan" → send
customer communication → create ticket, route for approval → capture suspension payment (WinCash
integration point) → submit order. **Resume (UJ-108)** mirrors this, reverting Park Plan back to the base
plan. **Confidence caveat — reflect this in the flow, don't silently resolve it:** the source scored this
at Medium-Low confidence, and its claim that suspension can be initiated via Email/Phone/Retail Counter
conflicts with a higher-confidence source stating manual suspension is explicitly "not a retail journey"
and is back-office/ticket-driven only. Build the back-office/ticket-driven path as primary (§2.1).

### 3.7 Flagship Journey — Enterprise Account Creation & Lead-to-Order (UJ-004/UJ-008)

**Actors:** Fulfilment agent, Business Finance, Customer, EBU operations, Account Manager, Credit
Control. **Workflow:** capture CR (Commercial Registration) number and type, agent ID, business type
(incl. B2B2C) → assign credit limit — **enterprise credit limits have no default and always require
Business Finance approval**, unlike consumer credit limits which have an Agent-Minimum floor (§2.3) → set
up parent/sub-account structure. Lead path: customer enquiry via website callback/chat/WhatsApp/business
care/business-in-retail → lead qualification by EBU operations → assignment to account manager → document
collection (CAF, MSA, service-specific forms) → credit control → discount approval routed through **MS
Dynamics** discount-approval hierarchy → handover to fulfilment for account creation and number
activation. Design a distinct "Discount Approval Hierarchy" screen for this MS-Dynamics-routed step —
it's structurally different from the consumer Order Approval Queue.

### 3.8 Flagship Journey — New FWA Outdoor Dual Play with WFM Installation (UJ-057)

The fullest field-fulfilment (technician/WFM) journey in the corpus — use as the reference for any
journey involving physical installation:

Contact/Account/Order creation → line items added → number reservation → ship-to address set → **Book
Appointment** (Pattern 8, cluster/slot picker) → CPE serial entry (indoor/outdoor) → order submitted
(status: Open) → WFM activity created (possibly reassigned via a Move/reassignment dialog, Pattern 18) →
inventory transferred to technician → technician view: "My Route" → activity details → assess activity →
serial-number check → service activation → **Installation Checklist completed with customer signature**
(reuse `SignaturePad`) → activity ended → order status: Complete → billing buckets confirmed active.
**Design note:** mid-flow appointment reschedule / technician reassignment is a normal exit path here, not
a hard failure — the Move dialog should be a first-class, low-friction action, not buried in a menu.

### 3.9 Flagship Journey — New FWA Tablet with Manager Approval (UJ-063)

Triggered specifically when a customer already has 2+ postpaid connections (an advisory banner should
surface at the Contact step when this condition is detected). Full wizard through SIM serial capture
(with negative-path UIM validation states — full validation detail in Prompt 3) → CAF e-signature →
**Supplementary Form required** (a recurring mandatory-attachment pattern, appears on 20+ screens — build
`AttachmentTile`'s mandatory-gating behavior to block submission until satisfied) → routes to Manager's TM
SR Queue → manager reviews Attachments/Order Details tabs → **Approve requires an attestation checkbox**
("I have verified all the documents and details to proceed with submission") — build this as a required,
unchecked-by-default checkbox on the Approve action, not an optional nicety.

### 3.10 Flagship Journey — Home Move (UJ-067, Guided Journey, Desktop)

Enter KID (location ID) → **check Fiber-ready eligibility at the new location** (a hard gate before
proceeding) → enter existing Fixed Number → verify address → check Free-Home-Move eligibility (if
first-time) → book appointment → WFM technician flow mirrors §3.8 (verify ONT in inventory, assess
activity, service activation, Home Move checklist with signature) → order Complete.

### 3.11 Flagship Journey — Prepaid-to-Postpaid Migration / "Autobase" (UJ-087)

**Distinctive collapsed-wizard pattern — reuse this shape for any campaign-driven/pre-approved offer
acceptance flow (also applies to UJ-077 Cross Sales, UJ-068 Cross Sales MNP):** open account → asset
flyout shows a system-generated migration offer (sourced from a Unica campaign, status "Offered",
pre-populated) → agent clicks Accept → compressed 3-step confirm (Contact confirm → Offer Summary review
→ Activity/comments) → Save and Finish → backend **Bulk Job** processes the migration asynchronously →
order completes. Design implication: this is deliberately *not* a full cart/catalog/quote flow — build a
lightweight "Accept Offer" card (Pattern 15) as a genuinely shorter path, not a disguised full wizard.

### 3.12 Flagship Journey — Future Dated Order (FDO) Lifecycle (UJ-092)

Agent raises an FDO request with a future execution date/time slot → notifications sent (submission + a
3-day-prior reminder) → request remains editable/cancellable while status is "Initial" → at execution
time: order-type-specific validations run → success (order fulfilled, notification sent) or failure
(auto-retry ×3, then cancel-and-notify if still unresolved). Build a dedicated "FDO Requests" tab/view
(distinct from the live order queue) showing status: Initial / Success / Failed / Cancelled, with the
edit/cancel actions only enabled while Initial.

### 3.13 Flagship Journey — Passport-to-QID Update (UJ-076)

A short, linear identity-update wizard: select journey → enter MSISDN & Passport Number → enter new QID
→ fetch customer details via MOI validation → scan/upload QID front & back → system generates an
identification-change form → customer signs (e-signature) → form attached → finish. Good reference for
any short single-purpose identity-correction flow.

### 3.14 Flagship Journey — Lead Full Lifecycle (UJ-074, 4 personas)

The fullest lead-lifecycle demonstration — use as the reference for the Lead List pattern (Pattern 14)
and its cross-role visibility rules: agent creates lead → sets a callback date/time (auto-transitions
status to "In Progress/Call Back") → **manager reassigns the lead owner via a picker** — reassignment
removes the lead from the prior owner's "My Leads" view but it persists in their "My Created Leads" view
(created-by and owned-by are tracked independently — build both as separate filterable lists, not one) →
new owner edits fields → admin views org-wide under "All Leads" with Reject/Retire actions available only
at that admin tier.

---

**What to build from this prompt:** the 16-module navigation structure wired to the Prompt-1 launcher,
role-aware visibility (RBAC gating per §2), and all 14 flagship journeys as working wizard/queue flows
using the components and patterns from Prompt 1. Then continue with Prompt 3.
