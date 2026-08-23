# Vodafone Qatar DXP — Master Prompt for Figma Make

**Purpose of this document:** paste the sections below into Figma Make to generate the design for
Vodafone Qatar's new agent-facing CRM / Digital Experience Platform (DXP) — the replacement for the
legacy Siebel/ECR/VSA stack. This prompt is built entirely from the `blueprint/` reconstruction corpus
(308 requirements, 213 screens, 111 user journeys, 346 business rules, 66 personas, 145 RBAC entries,
106 design tokens, across 16 functional modules), which was itself reconstructed from ~83 real Vodafone
Qatar workshop recordings, BRSDs, business-process decks, and guided-journey screenshot walkthroughs.

**How to use it:** Sections 1–11 are the design brief — feed them to Figma Make in order, or as one
combined prompt if it accepts long input. Section 12 is a standing instruction for Figma Make to follow
throughout the build (traceability tagging). Section 13 is your own build-sequencing reference, not
something to paste. Section 14 lists everything in this prompt that is inferred/assumed rather than
directly evidenced — read it before you trust any single line elsewhere in the document. Section 15 lists
what this prompt deliberately does **not** cover — read it before assuming silence means "not required."

---

## 0. Project Context & Objective

Design a web application for **internal Vodafone Qatar staff** (retail agents, back-office/fulfilment
teams, field technicians, managers/approvers, enterprise account managers, IT operations) to create,
manage, and fulfil customer orders across mobile (prepaid/postpaid), fixed line/fibre, FWA/5G home,
enterprise/IoT, MNP/FNP porting, billing, ticketing, and identity-management workflows. This is **not**
a customer-facing app — no public marketing surface, no anonymous access; every screen sits behind
role-based access control.

The product replaces a legacy Siebel-based CRM (referenced throughout source material as "Open UI",
"ECR", "VSA"). The new DXP should feel like a modern, data-dense enterprise console — closer to a
Salesforce/ServiceNow console than a consumer app — while carrying Vodafone's brand identity (color,
type, spacing — see §1) into that enterprise context.

**Two agent-facing device channels are evidenced and must both be designed: Desktop and Tablet** (see
§9). Do not design a phone/mobile breakpoint for agent-facing screens — it is not evidenced anywhere in
the source corpus (§14).

---

## 1. Design System

### 1.0 Provenance — read this before applying anything below

The visual tokens in this section come from a third-party Vodafone **brand-analysis package**
(`nexu-io/open-design`, subtree `design-systems/vodafone/`), not from an official Vodafone design file
and not from the VFQ requirements corpus itself (which contains zero visual-design evidence — it is
workshop transcripts, BRSDs, and screenshots of legacy Siebel screens). Treat the **tokens** (color,
type scale, spacing, radius, motion) as a credible, specific starting point grounded in real brand
research. Do **not** treat the **components** that ship with this same package as CRM-ready — they are
editorial/marketing components (`Card`, `FeaturedCard`, `ShareTicker`, `ImpactMap`, pill-shaped
marketing CTAs) built for a public brand site, not for a data-dense internal console. Re-express them as
enterprise primitives per §2.

If real Vodafone brand assets (logo files, icon set, proprietary typeface, production Figma library)
become available, replace the placeholders in §1.7 with them — everything there is an explicit stand-in.

**Brand voice:** Vodafone Red (`#e60000`) is the single dominant accent — no second brand hue. Voice is
institutional, third-person, never casual. Uppercase reserved for display headlines/nav/micro-labels;
everything else sentence case. No emoji anywhere in the product UI. There is no drop-shadow elevation
model in the source system — "elevation" there is simulated by surface-color shifts, not shadows; for
this dense enterprise console, use the one real shadow token provided (`--elev-raised`) sparingly for
modals/popovers rather than inventing a heavier shadow system.

### 1.1 Color Palette

**Brand & semantic**

| Token | Value | Usage |
|---|---|---|
| `--accent` | `#e60000` | Primary brand red — primary buttons, active nav, key dividers |
| `--accent-hover` | accent mixed 8% toward black | Button hover |
| `--accent-active` | accent mixed 14% toward black | Button press |
| `--accent-on` | `#ffffff` | Text/icon on accent background |
| `--deep-red` | `#ac1811` | Secondary institutional red |
| `--meta` | `#a61218` | Tertiary red (metadata accents) |
| `--signal-blue` | `#3860be` | Links |
| `--success` | `#008a00` | Success states, "Active"/"Complete"/"Approved" status pills |
| `--warn` | `#f5b400` | Warning states, "Pending"/"In Progress" status pills |
| `--danger` | `#bd0000` | Error states, "Rejected"/"Failed"/"Blacklisted" status pills |

**Neutrals & surfaces**

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#ffffff` | Page canvas |
| `--surface` | `#f4f4f4` | Card/panel surface |
| `--surface-warm` | `#fff1f1` | Warm near-accent surface (e.g. highlighted advisory banners) |
| `--light-neutral` | `#f2f2f2` | Filled-neutral tag pills |
| `--border` | `#d8d8d8` | Hairline border |
| `--border-soft` | `#eeeeee` | Softer hairline (table row dividers) |
| `--charcoal-panel` | `#25282b` | Reserve for chrome/utility panels, not primary content |
| `--fg` | `#1f1f1f` | Primary text |
| `--fg-2` | `#4a4d4e` | Secondary text |
| `--grey-body` | `#7e7e7e` | Body/meta copy |
| `--grey-form` | `#333333` | Form control text/border |
| `--grey-disabled` | `#bebebe` | Disabled state |
| `--muted` | `#6f7375` | Muted/helper text |

**Overlays:** `--white-glass-10`, `--black-glass-5`, `--white-80`/`--black-80`, `--divider-on-dark`
(25% white). `--focus-ring: 0 0 0 4px rgba(230,0,0,.22)` — use this accent-tinted ring for all keyboard
focus states, not a generic blue ring (also required for WCAG focus-visible compliance, §10).

### 1.2 Typography

**Font family:** Inter (weights 300/400/600/700/800) as an explicit substitute for Vodafone's real
proprietary typeface (unavailable in source). `--font-body`/`--font-display` → `"Inter","Helvetica
Neue",Arial,sans-serif`. `--font-mono` → `ui-monospace,"SF Mono",Menlo,monospace` (use for order numbers,
MSISDNs, QIDs, error codes like `SBL-EXL-00151`).

**Scale** — use the enterprise-relevant tiers; the hero/display tier (144/126/90px) is marketing-only,
skip it for CRM screens:

| Tier | Tokens | Values | CRM usage |
|---|---|---|---|
| Headings | `--fs-h1`…`--fs-h5` | 48/40/32/24/20px | Page titles down to card/section titles |
| Body | `--fs-lead`, `--fs-body-lg`, `--fs-body` | 20/18/16px | Lead text, primary body, default body |
| Small | `--fs-eyebrow`, `--fs-caption`, `--fs-caption-upper`, `--fs-tag` | 14/12/14/14px | Field labels, helper text, status pills |
| Controls | `--fs-btn`, `--fs-btn-compact`, `--fs-micro`, `--fs-label` | 14.4/12/12/16px | Buttons, form labels |
| Secondary scale | `--text-xs/sm/base/lg/xl/2xl/3xl` | 12/14/16/19/24/36/48px | General utility scale for tables/dashboards |

**Weights:** 700 for emphasis (buttons, tags, table headers), 400 for body, 600 for sub-headings. Avoid
800 (reserved for marketing display) in CRM contexts. Line-heights: `--leading-tight` 1.08 (headings),
`--leading-body` 1.48 (body/paragraphs, tables).

### 1.3 Spacing Scale

8px base unit.

| Token | Value | Token | Value |
|---|---|---|---|
| `--space-1` | 4px | `--space-5` | 20px |
| `--space-2` | 8px | `--space-6` | 24px |
| `--space-3` | 12px | `--space-8` | 32px |
| `--space-4` | 16px | `--space-12` | 48px |

Card/panel interiors: 12–16px padding. Section-to-section rhythm on dense CRM pages should be tighter
than the source's marketing rhythm (96/68/48px) — use `--space-8`/`--space-6` (32/24px) as the working
default between major page sections, reserving 48px+ for rare, clearly-separated zones. Container gutter:
36px desktop, 24px tablet (see §9 — no phone tier needed).

### 1.4 Border Radius Scale

| Token | Value | Usage |
|---|---|---|
| `--radius-button` | 2px | All form buttons and inputs — sharp, utilitarian |
| `--radius-card` | 6px | Cards, panels, modals |
| `--radius-sm/md/lg` | 8/16/24px | Generic secondary scale — use `sm` for tags/pills where 2px reads too sharp |
| `--radius-pill` | 9999px | Status pills/badges only |
| `--radius-circle` | 50% | Avatar/icon-button circles |
| `--radius-hairline` | 1px | Hairline dividers |

Skip the marketing-only tokens (`--radius-asymmetric`, `--radius-cta-pill`, `--radius-glass-pill`) —
they belong to editorial CTAs, not enterprise UI.

### 1.5 Elevation

No drop-shadow system in the source beyond one token. Use:
- `--elev-flat: none` — default for cards/panels sitting on `--surface`
- `--elev-ring: 0 0 0 1px var(--border)` — default separation method (prefer hairline over shadow)
- `--elev-raised: 0 18px 44px rgba(0,0,0,.12)` — reserve for modals, popovers, and dropdown menus that
  must visually float above page content

### 1.6 Motion

`--motion-fast` 150ms, `--motion-base` 220ms, `--ease-standard` `cubic-bezier(.2,0,0,1)`. **Flagged in
source as inferred, not confirmed** — treat as a reasonable default, not a hard requirement. Hover/press:
primary buttons darken via `color-mix` toward black on hover, 0.9 opacity on press; secondary/ghost
buttons swap border+text to accent red on hover. No lift, no scale, no shadow-growth on hover — keep
motion flat and functional, consistent with the no-elevation philosophy. Full interaction/motion detail
in §11.

### 1.7 Explicit Placeholders — do not present these as final assets

| Element | Status | What to do |
|---|---|---|
| Logo | No real asset in source | Use a plain "VF" text roundel on Vodafone Red as a placeholder; flag for swap-in of the real speech-mark logo |
| Icon set | Source references a corporate `icomoon` font but ships no file | Use Lucide icons as an open substitute (not source-backed — a design choice, not a requirement) |
| Form input visual spec | Source states these are inferred, not exposed | Best-effort per §2.2 primitives — expect revision once real specs surface |
| Animation timing | Not documented in source | Use §1.6 defaults; do not treat as contractually specified |

---

## 2. Component Library

Build enterprise primitives and domain components — **do not** import the source's marketing components
(`Card`, `FeaturedCard`, `CircularMedia`, `TopNav`/dark-hero-nav, `Footer`, `RedBand`, `ShareTicker`,
`ImpactMap`) into CRM screens. Only `Button`, `IconButton`, `Input`, and `TagPill` have real enterprise
analogs worth carrying forward directly.

### 2.1 Carried-forward components (from the brand source, adapted)

| Component | Adaptation for DXP |
|---|---|
| `Button` | Keep the 2px-radius rect variant (`primary-rect`/`ghost-rect`) as the CRM standard; drop the pill variants (editorial-only). States: default / hover / active (0.9 opacity) / disabled (0.45 opacity) |
| `IconButton` | Circular 32–40px, white bg / charcoal icon — use for table row actions, close buttons, carousel-style pagination |
| `Input` | 1px charcoal border, 2px radius, default/error(red)/disabled states — base for `TextInput` in §2.2 |
| `TagPill` | Extend beyond the source's 2 variants (`outlined-red`, `filled-neutral`) to a full **status-pill set**: success (green), warning (amber), danger (red), neutral (grey), info (blue) — required for Order/Lead/Ticket/Asset lifecycle states throughout the app |

### 2.2 Core primitives (build these first — everything else depends on them)

Derived from 970 evidenced form fields and 213 evidenced screens:

| Primitive | Purpose | Scale of use |
|---|---|---|
| `TextInput` | Free text entry | 214 fields |
| `Select` / `Dropdown` | Enum/dropdown selection | ~187 fields |
| `NumberInput` | Numeric/currency entry | 77 fields |
| `FileUpload` | Document/attachment upload | 45 fields |
| `DatePicker` | Date entry | 32 fields |
| `Checkbox` | Boolean toggle | 22 fields |
| `Textarea` | Multi-line free text | 18 fields |
| `SignaturePad` | Captured e-signature | 16 fields |
| `EmailInput` | Email entry | 13 fields |
| `Badge` / `StatusPill` | Lifecycle-state display | Every list/detail screen with a stateful entity |
| `Modal` | Dialog overlay | Backs 32 screens |
| `Popup` | Lightweight dismiss-only overlay | Backs 6 screens |
| `Tabs` | Sectioned single-page view | Backs Customer 360 / Account 360 |
| `Stepper` / `WizardShell` | Multi-step guided flow shell | Backs 58 wizard screens |
| `DataTable` | List/grid display with sort/filter | Backs every queue/list screen |
| `Toast` / `Alert` / `ConfirmDialog` | Notifications, confirmations | See §8 |

### 2.3 Domain-specific components (thin wrappers around a primitive, bound to one entity)

| Component | Built from | Bound entity | Appears in |
|---|---|---|---|
| `QidInput` | `TextInput` + format validation (QID/Passport/GCC/Diplomatic ID) | Customer/Contact | ID lookup step, nearly every activation journey |
| `MsisdnPicker` | `Select` + live reservation-token feedback | MSISDN/Number | Number Selection step |
| `SimSerialScanner` | `TextInput` + barcode icon + real-time UIM inventory validation | SIM | SIM Capture step |
| `CreditLimitEditor` | `Select` (constrained) + business-rule threshold check | Credit Limit | Plan/Limit modal |
| `BillingProfileSelector` | `Select` | Billing Profile | Billing/plan steps |
| `AddressForm` | Composite Zone/Street/Building/Apt/Area `TextInput`s + validation | Address | New-connection wizards |
| `AttachmentTile` | `FileUpload` + mandatory-gating badge | CAF / Supplementary Forms | Attachment Upload panel |
| `ApprovalActionBar` | Button group (Approve / Reject-Correction / Reject-Drop) + `ConfirmDialog` | Order | Order Approval Queue |

**Build order:** (1) primitives → (2) `CreditLimitEditor`, `MsisdnPicker`, `SimSerialScanner` (appear in
nearly every activation wizard) → (3) remaining domain components → (4) the 18 patterns in §2.4, in the
tier order given.

### 2.4 Reusable Screen Patterns (build-priority ranked, 18 total)

Every one of the 213 screens is an instance of one of these patterns. Build the pattern once, then
generate screen instances by swapping fields/copy — do not design each screen bespoke.

**Tier 1 — backbone, build first**
1. **Guided Multi-Step Wizard** — accordion steps with a "You are here" breadcrumb; canonical step
   sequence: Contact → Address → Plan/Billing → Number → SIM → Add-on → CAF → Activity → Submit
2. **Customer/Contact Lookup** — QID/Kahramaa-ID scan + MOI (Ministry of Interior) validation

**Tier 2**
3. **Number Selection / Reservation Step** — pick + reserve MSISDN, live token feedback
4. **SIM/Device Serial Capture** — scan/enter serial with real-time inventory (UIM) validation
5. **Plan/Promotion Detail Modal with Limit Editing** — view plan, edit credit/bill limit inline

**Tier 3**
6. **CAF/Contract Signature Capture** — e-signature modal, laptop/tablet view shift at this exact step
7. **Document/Attachment Upload Panel** — mandatory-file gating, drag/drop or scan
8. **Appointment Booking Modal** — cluster/slot picker for field-technician scheduling
9. **Activity/Comments Finalization Step** — free-text notes + Save-and-Finish, closes most wizards

**Tier 4 — navigation shells**
10. **Account/Customer 360 Summary View** — tab-based partial refresh (Overview/Order/Tickets/Assets/Billing/Credit Risk)
11. **Asset 360 / Asset Detail Drill-Down** — read-only detail with Get-Due-Amount/Get-Usages/Get-Next-Best-Offer actions
12. **App/Module Launcher Home Screen** — tile grid, role-filtered visibility, universal entry point

**Tier 5 — workflow/queue**
13. **Order Approval Queue + Detail** — queue → drill-in (tabs: Attachments/Order Details/Activities/Agents Details) → Approve/Reject-Correction/Reject-Drop
14. **Lead List + Owner/Status Management** — filtered by owner/creator/team/org, reassignment picker
15. **Cross-Sales / Migration Offer Acceptance Card** — pre-populated offer, "Autobase" accept-and-confirm pattern

**Tier 6 — specialized (build last)**
16. **Bulk Operation Portal** — template upload, async processing, per-row pass/fail (Excel-style)
17. **In-Progress Journey Resume List** — *medium confidence, inferred pattern* — resumable draft orders
18. **Manager/Field-Technician Reassignment Dialog** — *medium confidence, inferred pattern* — move/reassign an activity

---

## 3. Information Architecture & Navigation

### 3.1 Module Hierarchy (16 modules)

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

### 3.2 Sitemap Pattern

Real evidenced route-naming convention to follow, e.g. `/mobile-postpaid/dxp-product-catalog-target-state`,
`/fixed-line-fibre/...`, `/fwa-5g-home/...` — module-slug-prefixed paths. Each module's sitemap entry
should expose: a landing/home page, its wizards (activation/change/disconnect flows), its list/queue
views, and its detail/360 views, per the screen index (§6) and patterns (§2.4).

### 3.3 Channel Architecture

Four device/channel contexts are evidenced, with very uneven coverage — **do not treat them as equally
weighted**:

| Channel | Screens | Journeys | Note |
|---|---|---|---|
| Desktop (Open UI) | 95 | 13 | Primary console |
| Tablet | 65 | 25 | First-class parallel channel, not a stripped-down view (§9) |
| Desktop Vanilla/Manual | 32 | 8 | Manual/fallback flows |
| Digital Self-Service | 0 | 1 | Referenced but no UI evidenced — do not design screens for it without new source material |

Of the 165 catalogued journey/workflow items: 143 are CBU (Consumer), 127 are EBU (Enterprise), 105 apply
to both. Design with a persona/segment switch in mind (see §4) rather than duplicating screens per
segment. **Legacy ECR/VSA references are explicitly excluded from this rebuild.** Field/WFM mobile app
and the separate MVA app are explicitly **out of scope** — the WFM screens in this corpus are the
back-office/technician-facing web views only, not a native field app.

### 3.4 Dashboards

Five true analytics dashboards are evidenced — build these as actual data-dashboards (charts, counters,
grids), not just list views:

- **SCR-021 Customer 360** — customer-level dashboard
- **SCR-185 Account 360** — account-level dashboard
- **SCR-060 TM SR Queue** — service-request/approval queue dashboard
- **SCR-183 Bulk Jobs** — bulk-operation monitoring dashboard
- **SCR-211 Tickets Dashboard** — *flagged as a content gap in source* — build the shell/layout but expect thin evidenced detail

Six other screens are labeled "dashboard" in source but are actually simple tile-launcher home screens
(Pattern 12, §2.4) — don't over-build these as analytics; a role-filtered tile grid is sufficient.

### 3.5 Search, Filter, Sort

13 screens have dedicated search, 5 have filtering, and only 1 has explicit sort — **do not
over-engineer this**. Add search/filter/sort affordances only where the source evidences them (primarily
on queue/list screens — Leads, Orders, Approvals, Tickets), not uniformly across every `DataTable`
instance.

### 3.6 Notification Framework

- **39 automatic SMS templates** across 3 categories (order confirmations, appointment reminders,
  status updates) — design the underlying trigger/copy system, not agent-facing screens (these are
  customer-directed SMS, out of the agent console's visual scope, but the *triggering* action in the
  agent UI should be represented, e.g. a confirmation toast when an SMS is queued).
- **79 of 970 fields carry an in-app error message** — see §7 for message-shape patterns.
- **4 confirmation-dialogue patterns** recur — standardize on `ConfirmDialog` (§2.2).
- **Recommended 4-primitive system: Toast / Banner / Modal / Inline field error.** Explicit source
  instruction: **do not carry forward native browser `alert()`** — every legacy alert must be replaced
  with one of these four primitives.

---

## 4. Personas & Access Control

### 4.1 Persona Roster (66 personas, 8 categories)

Design role-aware UI (visible modules, available actions, default landing screen) around these
categories. Full roster available in `blueprint/personas.md`/`personas.json` for granular RBAC binding
during build — the categories below give you the navigation/permission shape:

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
the suspension/resume journey (§5, UJ-107/UJ-108) around the back-office/ticket-driven path as the
primary flow (higher-confidence source), and treat any retail-counter-initiated entry point as an
optional, clearly-secondary affordance pending business confirmation.

### 4.2 RBAC Summary

Of 66 personas: **30 are module-mapped** (explicit persona × module access evidenced), **31 are
evidenced but not mapped to a specific module** (build for them generically — least-privilege default),
and **5 have zero access evidence** — for these 5, default to no access and surface nothing rather than
guessing a permission set.

**Core convention: a blank/no-evidence cell means "no evidence found," not "no access."** When building
RBAC gating in the design (e.g. via a permissions/variants system in Figma Make), default unmapped
combinations to **hidden**, not merely disabled — an unevidenced permission should not silently expose a
control. Where evidence exists, use this access-level vocabulary consistently across the whole app: Full
(F), Approve (A), Edit (E), Create (C), View-only (V), Restricted/partial (~), No access (X).

### 4.3 Key Permission Patterns to Encode in the UI

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
9. **Back-office-only suspension** — manual suspension is restricted to back-office roles (see §4.1
   caveat).
10. **Enterprise credit approval** — routed through MS Dynamics discount-approval hierarchy, distinct
    from consumer credit-limit editing.
11. **DOA-tiered adjustments** — Delegation-of-Authority tiers gate adjustment amounts.
12. **Regulator override path** — a distinct, rarely-used escalation route; design as a hidden/advanced
    action, not a primary button.
13. **IT Ops exclusive source-system access** — certain system-configuration screens are IT-Ops-only.
14. **Offshore visibility scoping** — some roles have geographically/organizationally scoped visibility.
15. **Field-tech exclusions** — flagged in source for removal; do not design new field-tech restrictions
    beyond what's already in the WFM screens (§3.3 scope note).

---

## 5. User Journeys & Workflows

111 journeys (UJ-001 through UJ-111) span the 16 modules; every module except the 4 noted in §3.1 has
dedicated journeys. Build the wizards/queues per §2.4's patterns, populated with the real step sequences
below for the highest-priority (**flagship**) journeys — use these as the canonical reference for how
every other journey in the same family should behave.

### 5.1 Flagship Journey — New Fixed Line / New Postpaid / Cross-Sales (activation family)

Canonical step skeleton (Pattern 1): **Contact → Address → Plan → Add-on & Discount → Number Selection →
SIM Serial → CAF/Attachments → Activity/Comments → Submit.** This exact sequence repeats across New Fixed
Line, FWA, MNP, and Postpaid wizards — implement it once as the `WizardShell` default and vary only the
field sets and copy per module.

**New Fixed Line Tablet (canonical reject → correct → approve reference flow):** the fullest evidenced
example of the whole lifecycle including manager rejection-with-correction and resubmission — use this as
your reference implementation for the Order Approval Queue pattern (Pattern 13) end to end.

### 5.2 Flagship Journey — MNP/FNP Port-In (Desktop & Tablet)

**Actors:** Agent, Customer, NPAS (National Porting Administration System — external), donor operator.
**Workflow:** capture MSISDN/donor details → consent capture → submit to NPAS → donor accept/reject/
conditional-accept → porting window countdown → ported. **Design implication:** this needs an
externally-dependent status/waiting state (not a simple submit-and-done) — build a status tracker showing
"submitted to NPAS → awaiting donor response → porting window → complete," since the source's Order/MNP
lifecycle explicitly has this multi-stage external wait.

### 5.3 Flagship Journey — SIM Swap (multi-channel: UJ-020/090/091)

**Workflow:** identify subscriber → validate eligibility → capture new SIM serial (real-time UIM
validation) → generate approval task → **Approval Queue** (Pattern 13) → Approve/Reject. **Channel
divergence is concrete here (§9.1)** — Desktop uses "SIM Swap Queue" as the entry point and a simpler
Approve/Reject; Tablet uses "Order Approval Queue" (different name), adds a "Validate Attachments" step
before the approval action, and lands the approver back on "My Activities Page" after completion (Desktop
implicitly returns to the queue). Build both explicitly rather than deriving one from the other.

### 5.4 Flagship Journey — TON Retail BAU (UJ-019, four-queue pattern)

A back-office/retail order-management flow structured around four parallel queues — use this as the
reference for any multi-queue back-office screen (queue segmentation by status/type, not a single flat
list).

### 5.5 Flagship Journey — Disconnection (UJ-025/UJ-111)

Standard disconnect workflow — identify subscriber → validate no blocking conditions (e.g. unbilled
balance) → submit → confirm. Reuse the Approval Queue pattern where the disconnect requires sign-off.

### 5.6 Flagship Journey — Suspension/Resume (UJ-107/UJ-108) — *medium confidence, see caveat*

**Workflow (Suspension):** request suspension → identify subscriber (search by MSISDN/Account) → fetch
customer & billing details → validate suspend-eligibility (**unbilled balance must be cleared first** —
a hard precondition, encode as a blocking validation) → agent changes plan to a "Park Plan" → send
customer communication → create ticket, route for approval → capture suspension payment (WinCash
integration point) → submit order. **Resume (UJ-108)** mirrors this, reverting Park Plan back to the base
plan. **Confidence caveat — reflect this in the flow, don't silently resolve it:** the source scored this
at Medium-Low confidence, and its claim that suspension can be initiated via Email/Phone/Retail Counter
conflicts with a higher-confidence source stating manual suspension is explicitly "not a retail journey"
and is back-office/ticket-driven only. Build the back-office/ticket-driven path as primary (§4.1).

### 5.7 Flagship Journey — Enterprise Account Creation & Lead-to-Order (UJ-004/UJ-008)

**Actors:** Fulfilment agent, Business Finance, Customer, EBU operations, Account Manager, Credit
Control. **Workflow:** capture CR (Commercial Registration) number and type, agent ID, business type
(incl. B2B2C) → assign credit limit — **enterprise credit limits have no default and always require
Business Finance approval**, unlike consumer credit limits which have an Agent-Minimum floor (§4.3) → set
up parent/sub-account structure. Lead path: customer enquiry via website callback/chat/WhatsApp/business
care/business-in-retail → lead qualification by EBU operations → assignment to account manager → document
collection (CAF, MSA, service-specific forms) → credit control → discount approval routed through **MS
Dynamics** discount-approval hierarchy → handover to fulfilment for account creation and number
activation. Design a distinct "Discount Approval Hierarchy" screen for this MS-Dynamics-routed step —
it's structurally different from the consumer Order Approval Queue.

### 5.8 Flagship Journey — New FWA Outdoor Dual Play with WFM Installation (UJ-057)

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

### 5.9 Flagship Journey — New FWA Tablet with Manager Approval (UJ-063)

Triggered specifically when a customer already has 2+ postpaid connections (an advisory banner should
surface at the Contact step when this condition is detected). Full wizard through SIM serial capture
(with negative-path UIM validation states, §7) → CAF e-signature → **Supplementary Form required** (a
recurring mandatory-attachment pattern, appears on 20+ screens — build `AttachmentTile`'s mandatory-gating
behavior to block submission until satisfied) → routes to Manager's TM SR Queue → manager reviews
Attachments/Order Details tabs → **Approve requires an attestation checkbox** ("I have verified all the
documents and details to proceed with submission") — build this as a required, unchecked-by-default
checkbox on the Approve action, not an optional nicety.

### 5.10 Flagship Journey — Home Move (UJ-067, Guided Journey, Desktop)

Enter KID (location ID) → **check Fiber-ready eligibility at the new location** (a hard gate before
proceeding) → enter existing Fixed Number → verify address → check Free-Home-Move eligibility (if
first-time) → book appointment → WFM technician flow mirrors §5.8 (verify ONT in inventory, assess
activity, service activation, Home Move checklist with signature) → order Complete.

### 5.11 Flagship Journey — Prepaid-to-Postpaid Migration / "Autobase" (UJ-087)

**Distinctive collapsed-wizard pattern — reuse this shape for any campaign-driven/pre-approved offer
acceptance flow (also applies to UJ-077 Cross Sales, UJ-068 Cross Sales MNP):** open account → asset
flyout shows a system-generated migration offer (sourced from a Unica campaign, status "Offered",
pre-populated) → agent clicks Accept → compressed 3-step confirm (Contact confirm → Offer Summary review
→ Activity/comments) → Save and Finish → backend **Bulk Job** processes the migration asynchronously →
order completes. Design implication: this is deliberately *not* a full cart/catalog/quote flow — build a
lightweight "Accept Offer" card (Pattern 15) as a genuinely shorter path, not a disguised full wizard.

### 5.12 Flagship Journey — Future Dated Order (FDO) Lifecycle (UJ-092)

Agent raises an FDO request with a future execution date/time slot → notifications sent (submission + a
3-day-prior reminder) → request remains editable/cancellable while status is "Initial" → at execution
time: order-type-specific validations run → success (order fulfilled, notification sent) or failure
(auto-retry ×3, then cancel-and-notify if still unresolved). Build a dedicated "FDO Requests" tab/view
(distinct from the live order queue) showing status: Initial / Success / Failed / Cancelled, with the
edit/cancel actions only enabled while Initial.

### 5.13 Flagship Journey — Passport-to-QID Update (UJ-076)

A short, linear identity-update wizard: select journey → enter MSISDN & Passport Number → enter new QID
→ fetch customer details via MOI validation → scan/upload QID front & back → system generates an
identification-change form → customer signs (e-signature) → form attached → finish. Good reference for
any short single-purpose identity-correction flow.

### 5.14 Flagship Journey — Lead Full Lifecycle (UJ-074, 4 personas)

The fullest lead-lifecycle demonstration — use as the reference for the Lead List pattern (Pattern 14)
and its cross-role visibility rules: agent creates lead → sets a callback date/time (auto-transitions
status to "In Progress/Call Back") → **manager reassigns the lead owner via a picker** — reassignment
removes the lead from the prior owner's "My Leads" view but it persists in their "My Created Leads" view
(created-by and owned-by are tracked independently — build both as separate filterable lists, not one) →
new owner edits fields → admin views org-wide under "All Leads" with Reject/Retire actions available only
at that admin tier.

---

## 6. Screens

213 screens (SCR-001–SCR-213) map onto the 6 screen-type/pattern families in §2.4: **93 Detail/List/Queue
(largest bucket), 58 Wizard, 32 Modal, 13 Page/Landing, 11 Dashboard, 6 Popup.** Generate the full screen
set module-by-module from the journey step sequences in §5 and the module list in §3.1 — every screen a
journey step touches should exist as a named, routable screen instance of one of the 6 pattern families,
carrying its journey's step name (e.g. "New Fixed Line — Address," "SIM Swap — Approval Queue").

Do not invent screens outside a journey's evidenced step sequence. Where §5's flagship journeys list
specific screens touched (e.g. "SCR-034, SCR-207, SCR-115, SCR-116" for Home Move), treat those as the
minimum required screen set for that journey — build exactly that set before considering additions.

---

## 7. Business Rules, Validation & Business Processes

### 7.1 Business Rule Categories (346 rules total)

Encode these as the underlying logic layer behind every form/wizard, weighted by category volume:
**Validation (137) · Eligibility (50) · Routing (46) · Derivation (44) · Calculation (30) · Permission
(28) · Visibility (11).** Representative real examples to anchor tone/specificity (module: Lead
Management, Mobile Postpaid, MNP/FNP, Fixed Line/Fibre/FWA, Identity, Billing, Enterprise, Order
Management, Ticketing/SIM, CAF, Access Governance): e.g. "Customer already has 2 or more Post-paid
connections" (triggers an advisory, §5.9); credit-limit floor rules (§4.3 Agent Minimum); donor
accept/reject branching in MNP (§5.2).

### 7.2 Validation Patterns (418 entries: 281 field-level, 137 business-rule-level)

Build these as **reusable validation rule-sets applied consistently**, not bespoke per-screen logic:

- **Address validation** — blank-field checks, non-numeric/oversized Building No./Street No., an
  explicit "Skip Address" escape hatch. Recurs on ~9 screens.
- **SIM/CPE Serial validation** — "must be 19 digits; must exist and not already be assigned in UIM."
  Recurs on ~15 screens.
- **Mandatory Supplementary Form** — the single most common exception tag, recurring on 20+ screens
  across every screen type. Build `AttachmentTile`'s gating behavior once, reuse everywhere.
- **Format errors, mandatory-field errors, backend/inventory errors** (including raw backend codes like
  `SBL-EXL-00151`), threshold validations, permission-flavored validation messages, and
  confirmation/warning dialogs are all real, evidenced message *shapes* — see §7.3 for exact copy
  patterns to follow.
- **Known data-quality gap, worth fixing not replicating:** email/address fields in source have
  presence-only (not format) validation in places (e.g. a ZSP Entry screen) — implement proper format
  validation in the rebuild rather than reproducing this gap.

### 7.3 Error & Success Message Copy Patterns

Follow these exact templates for consistency (do not invent new message shapes):

- **Terminal order-completion success:** `"{JourneyName} completed successfully. Order Number:- '{orderNumber}'"` — e.g. *"Fixed Line completed successfully. Order Number:- '1-29793912388'"*. Apply universally across every activation-type journey's final step.
- **Reservation success:** embeds a token plus a backend success code, e.g. *"SUCCESS:Reservation Token:1001357812(SBL-EXL-00151)"*.
- **Limit-floor blocking error:** tied to the same code family, e.g. *"SL Limit Amount must not be lower than the product's Agent Min Value or order validation fails"* / *"Bill Limit can not be set lower than Agent Minimum 80/50."* Apply this pattern to any "editable up to a configured floor" field.
- **Generic submission confirmation:** *"Order request is submitted successfully. Please check installed asset of the account to confirm."* — sometimes paired with a business advisory in the same message.
- **Step-level (non-terminal) success** uses a lighter green-checkmark/"Saved!" micro-confirmation — reserve full modal confirmation dialogs for terminal/order-submission actions only; do not overuse modal confirmations mid-wizard.

### 7.4 Exception & Failure Handling

Four categories, in priority order for design attention:

1. **Validation failures** — the richest evidenced category (11 real FWA negative-scenario examples).
   Design clear, specific inline errors — never a raw stack trace. **Explicit corpus directive: do not
   reproduce native browser alerts, raw backend codes as user-facing copy, or stale/leftover banners** —
   route every failure through the Toast/Banner/Modal/Inline-error system (§3.6).
2. **Permission failures** — default pattern is **hide, not disable**: an action a role can't perform
   should not render as a greyed-out button (which invites "why can't I click this" support tickets) — it
   should not render at all, consistent with the RBAC default in §4.2.
3. **Workflow failures** — only ~14% of workflow steps have an evidenced exception branch (130/945). For
   the branches not evidenced, design a generic "step failed, retry or escalate" fallback rather than
   inventing specific business logic.
4. **Technical/interruption failures** — network/system interruption handling is mostly an engineering
   default (session recovery, draft persistence) rather than a specifically evidenced UX — implement
   standard resilience patterns (auto-save drafts, resumable wizards per Pattern 17) rather than treating
   this as a documented requirement.

### 7.5 Feature Toggles

The thinnest-evidenced area in the corpus — only Current-state → Target-state pairs are evidenced, with
no flag-management UI documented anywhere. **Do not invent a feature-flag admin screen** — where a
toggle-like behavior is evidenced (e.g. a module being Current vs. Target state), represent it as a
simple state difference in the relevant screen, not as a standalone toggles product surface.

### 7.6 Test Scenario Coverage (for QA/acceptance criteria reference, not screens)

775 real test scenarios exist in source (493 module-level, 213 navigation, 40 security, 29 boundary) —
these aren't screens to design, but a strong signal of what "correct behavior" means per flow. When a
flow's behavior is ambiguous, consult the matching module's test scenarios (via `blueprint/` directly)
before guessing.

---

## 8. Notification & Confirmation System

Standardize on **4 primitives**, replacing every legacy native-alert reference in source material:

| Primitive | Use for |
|---|---|
| **Toast** | Transient, non-blocking confirmations (step saved, SMS queued, reservation token issued) |
| **Banner** | Persistent, page-level advisories (e.g. "Customer already has 2+ postpaid connections," fiber-readiness status) |
| **Modal (Confirm/Alert)** | Blocking confirmations for consequential actions (Approve/Reject with attestation, Order Correction, Drop Order) |
| **Inline field error** | Per-field validation failures, shown at the field, not in a global banner |

39 automatic SMS templates exist for customer-facing notifications (order confirmations, appointment
reminders) — represent these in the agent UI only as the triggering confirmation moment (a Toast
confirming "Confirmation SMS sent to customer"), not as designable customer-facing screens.

---

## 9. Responsiveness & Channel Behavior

### 9.1 Two evidenced form factors: Desktop and Tablet — build both explicitly

Do not derive Tablet from Desktop via CSS breakpoints alone; treat them as two maintained UI variants
sharing the same component set. Coverage: Desktop 95 screens/13 journeys, Tablet 65 screens/25 journeys,
Desktop Vanilla 32 screens/8 journeys. Where a journey has source documentation for both channels (e.g.
SIM Swap, §5.3), implement the evidenced differences directly rather than assuming parity:

- SIM Swap: different queue naming ("SIM Swap Queue" vs. "Order Approval Queue"), an extra "Validate
  Attachments" step on Tablet, different post-approval landing screen.
- CAF Signature Capture: the layout explicitly shifts between laptop and tablet views specifically at
  the signature-capture step — a targeted form-factor change, not a uniform breakpoint reflow.

Where no specific divergence is documented for a given journey, apply standard responsive reflow
(stacking, touch-target sizing) rather than inventing new tablet-specific steps.

### 9.2 Do not build a phone breakpoint for agent-facing screens

No source document shows an agent-facing phone-sized UI. Phone-adjacent references in the corpus are
customer-facing (My Vodafone app, SMS deep-links) — an entirely separate, out-of-scope channel with zero
UI evidenced. If Figma Make's default workflow wants to generate a mobile variant, override it: this
product's minimum viewport is tablet width.

---

## 10. Accessibility Requirements

**Explicitly flagged: the source corpus has no dedicated accessibility catalogue.** Nothing below is
evidenced from Vodafone Qatar workshop material — it is a standard baseline **assumed** appropriate for
an enterprise internal tool, following common practice for agent-facing government/telecom console
software. Treat this section as a sensible default to build to, not a traced requirement — flag it as
such in any downstream documentation.

- **Baseline standard:** WCAG 2.1 Level AA.
- **Color contrast:** all text/background pairs from §1.1 must meet 4.5:1 (normal text) / 3:1 (large
  text, 18px+/14px+bold) — spot-check `--grey-body` (#7e7e7e) and `--muted` (#6f7375) against `--bg`
  (#ffffff) specifically, as mid-grey tones are the most common contrast failure point in this palette.
- **Focus states:** every interactive element must show the `--focus-ring` (accent-tinted, §1.1) on
  keyboard focus — never rely on browser default outline removal without a replacement.
- **Keyboard navigation:** full keyboard operability for every wizard (Tab/Shift-Tab through fields,
  Enter to advance, Esc to close modals/popups), every DataTable (arrow-key row navigation, Enter to
  open), and every approval action.
- **Screen reader support:** semantic form labels for every primitive in §2.2 (no placeholder-only
  labels); status pills (§2.1) must carry a text equivalent, not rely on color alone to convey
  success/warning/danger; role labels must not carry decorative icon glyphs that get read aloud
  redundantly ahead of the label text (consistent with the source design system's own "no emoji on role
  labels" convention, §1.0).
- **Error identification:** every inline field error (§7.2) must be programmatically associated with its
  field (e.g. `aria-describedby`) and not conveyed by color/border alone.
- **Touch targets (Tablet):** minimum 44×44px for all interactive controls, given Tablet is a first-class
  input channel (§9.1), not just a resized desktop view.
- **Motion:** respect `prefers-reduced-motion` — the app's own motion (§1.6/§11) is already minimal (no
  lift/scale/shadow animation), so this should be low-cost to satisfy.

---

## 11. Interaction & Motion Details

- **Buttons:** primary (`--accent`) darkens toward black on hover (`--accent-hover`), drops to 0.9
  opacity on press (`--accent-active`), 0.45 opacity when disabled. Ghost/secondary buttons swap
  border+text color to accent red on hover. No lift, scale, or shadow growth on hover/press — flat,
  functional motion throughout, consistent with the near-absent elevation model (§1.5).
- **Timing:** 150ms for micro-interactions (hover, toggle), 220ms for larger transitions (modal
  open/close, panel expand), easing `cubic-bezier(.2,0,0,1)`. Flagged as inferred defaults — reasonable
  to ship, not a hard spec.
- **Wizard step transitions:** Continue advances linearly to the next step; Go Back returns to the prior
  step; Abandon/Cancel exits with drafts persisted for resume (Pattern 17). Step completion shows a
  lightweight green-checkmark/"Saved!" micro-confirmation — not a full modal (§7.3).
- **Approval actions:** Approve requires an attestation checkbox where evidenced (§5.9) — unchecked by
  default, blocking the action until checked. Reject has two distinct sub-flows: **Reject-Correction**
  (returns to the agent for fix-and-resubmit via a dedicated correction wizard) and **Reject-Drop Order**
  (terminal cancellation) — always offer both as separate actions, never collapse them into one generic
  "Reject."
- **Hub navigation (dashboards/tile-launchers):** tile or row click drills into a detail screen or
  module; no forward/back sequence; tab/sub-navigation lives within the destination screen (Customer 360's
  Overview/Order/Tickets/Assets/Billing/Credit Risk tab set is the reference model).
- **Overlay navigation (modals/popups):** opened from a parent-screen action; closed via Confirm/Save
  (commits) or Cancel/Close (discards, no side effects); modals show a confirmation before closing,
  popups just dismiss on acknowledgment.

---

## 12. Traceability Instructions — apply throughout the build

To keep every generated screen/component traceable back to this corpus, Figma Make should:

1. **Name every top-level frame/screen using its pattern family + module + step name** (e.g. "Wizard —
   Fixed Line — Address," "Queue — SIM Swap Approval — Desktop," "Modal — CAF Signature Capture") so a
   reviewer can map each frame back to §5/§6 without needing a separate lookup table.
2. **Tag inferred/assumed elements visibly during design review** — anything from §10 (Accessibility,
   entirely assumed), §1.6 (motion timing, inferred), §9.2 caveat, Patterns 16/18 (§2.4, medium
   confidence), and the Suspension/Resume flow (§5.6, medium-low confidence) should carry a distinct
   visual marker (e.g. a small "assumed" annotation layer or comment) during the build, removable once
   confirmed by the business.
3. **Preserve real screen/journey identifiers where they exist** — where this prompt cites an SCR-xxx or
   UJ-xxx ID (§5, §6), carry that ID into the frame's naming or description metadata so the design can be
   cross-referenced against `blueprint/screens.md` and `blueprint/journeys.md` directly.
4. **Do not silently invent screens, fields, or flows beyond what §5–§8 specify.** If a gap appears
   during the build that this prompt doesn't cover, prefer leaving a clearly-marked placeholder over
   fabricating detail — flag it back to the requester rather than guessing.

---

## 13. Build Sequencing Recommendation (reference for you, not part of the Figma Make prompt)

1. Design tokens (§1) → core primitives (§2.2) → carried-forward components (§2.1).
2. Domain components (§2.3), starting with the three most-referenced (`CreditLimitEditor`,
   `MsisdnPicker`, `SimSerialScanner`).
3. Patterns Tier 1–2 (§2.4 #1–5) — the wizard backbone and lookup/selection steps.
4. Flagship journeys §5.1–§5.2 (activation + MNP) end to end, screen by screen, to validate the pattern
   library against real complexity before scaling out.
5. Remaining patterns (Tiers 3–6) and remaining flagship journeys (§5.3–§5.14).
6. Full screen set (§6) generated from the validated patterns.
7. Notification system (§8), accessibility pass (§10), responsive Tablet variants (§9) — apply across
   the already-built screen set rather than as an afterthought per screen.

---

## 14. What's Assumed vs. Evidenced — read before treating anything above as settled

| Area | Status |
|---|---|
| Design tokens (§1.1–1.5) | Evidenced, but from a third-party brand-analysis package, not Vodafone's own production design files or the VFQ corpus |
| Motion timing (§1.6, §11) | Explicitly flagged as inferred/not confirmed by its own source |
| Logo, icon set, typeface, form-input visual spec (§1.7) | Explicit placeholders — no real assets exist anywhere in the source chain |
| Marketing components (Card, FeaturedCard, TopNav, Footer, RedBand, ShareTicker, ImpactMap) | Real, but out of scope for this CRM — do not use |
| Core primitives (§2.2) | Assumed/generic, but backed by real field-count evidence (970 fields) |
| Domain components (§2.3) | Assumed wrappers around evidenced field groups |
| Patterns 16 (Resume List) and 18 (Reassignment Dialog) (§2.4) | Medium confidence — thinner evidence base (2–3 screens) than the other 16 patterns |
| Suspension/Resume journey (§5.6) | Medium-low confidence, contains an unresolved source conflict — back-office path treated as primary |
| Generic screen UI states (Initial/Loading/Empty) (not separately detailed above — see source `screen-state-model.md`) | Assumed, not extracted — only Draft/Submitted/Approved/Rejected-type states are directly evidenced per entity |
| Phone/mobile breakpoint | Not evidenced — explicitly recommended against building one (§9.2) |
| Accessibility requirements (§10) | Entirely assumed — no accessibility catalogue exists in the VFQ corpus; WCAG 2.1 AA is a reasonable external baseline, not a traced requirement |
| Feature toggle UI (§7.5) | Thinnest-evidenced area — do not build a flag-management surface |
| Digital Self-Service channel (§3.3) | Referenced but zero UI evidenced — do not design screens for it |

**Everything else in this document — the module structure, journey step sequences, screen counts,
persona/RBAC data, business rules, validation message copy, and screen-behavior patterns — is drawn
directly from the 83-document VFQ requirements corpus via the `blueprint/` reconstruction package, at
high or medium-high confidence unless a caveat says otherwise inline.**

---

## 15. Explicitly Out of Scope for This Prompt

This section lists what this document does **not** attempt to cover — either because the underlying data
exists but wasn't condensed into this brief, or because the capability is a deliberate exclusion. Treat
silence elsewhere in this document as "not specified here," not as "not required" — consult `blueprint/`
directly (or commission a follow-up prompt) for anything below before assuming it's out of scope for the
product itself.

### 15.1 Corpus data not itemized in this prompt (exists in `blueprint/`, not condensed here)

| Not included here | Where it actually lives | Why it's not in this prompt |
|---|---|---|
| Full literal list of all 308 requirements (REQ-IDs) | `blueprint/requirements.md` | Categorized/referenced by theme in §5–§7 instead of itemized — a 308-row ID list would dwarf the rest of the brief without adding design-actionable detail |
| All 111 journeys | `blueprint/journeys.md` | Only 14 flagships (§5.1–§5.14) are detailed step-by-step; the other ~97 exist only as counts/module groupings (§3.1, §5) |
| All 213 screens, per-screen field/copy spec | `blueprint/screens.md`, `blueprint/field-inventory.md` | §6 gives pattern + count coverage only; no per-SCR-ID field list or copy deck is embedded |
| Full 970-field inventory | `blueprint/field-inventory.md` | §7.2 gives pattern-level validation rules (address, SIM serial, mandatory attachments, etc.), not a field-by-field spec |
| The actual REQ→UJ→SCR→BR traceability matrix | `blueprint/traceability-matrix.md` (or equivalent workbook) | §12 instructs Figma Make on a *naming convention* so generated frames can be cross-referenced, but the real coverage/mapping table itself isn't embedded as data |

### 15.2 Known corpus issues not carried into this prompt

| Not included here | Where it actually lives | Why it's not in this prompt |
|---|---|---|
| 2 of the 3 logged data conflicts — REQ-292/Launch X, and REQ-299/302 vs. PERSONA-021 | `blueprint/conflict-report.md` | Only the PERSONA-015/PERSONA-021 suspension-channel conflict (§4.1, §5.6) made it into this prompt's design-relevant caveats; the other two conflicts don't currently bear on a screen/flow decision covered in §5, but should be reviewed before building Enterprise (Launch X) or any REQ-299/302-adjacent flows |
| The 21 genuinely-gapped items and 31 N/A items from the Stage K gap re-mining pass | `blueprint/gap-analysis.md` (Stage K addendum) | Out of scope for a design brief — these are corpus-completeness findings, not design requirements, but any of the 21 "genuinely gapped, Recommended Assumption" items could surface as a missing flow during build |
| The 2 true User-Journey-type gaps identified in Phase 2 review | `blueprint/gap-analysis.md` ("The two true User-Journey-type gaps" section) | Confirmed real gaps in journey coverage — not designed around here since no source detail exists to design from; flag for business follow-up if the build reaches those areas |

### 15.3 Product surface areas not covered

- **Test scenarios (775 of them) are referenced as a QA cross-check resource only** (§7.6) — not converted into design acceptance criteria. If you want per-flow acceptance criteria embedded in the design brief itself, that requires a separate pass through `blueprint/test-scenarios.md`.
- **Reporting/BI beyond the 5 named dashboards** (§3.4) — no general-purpose report builder, export-to-BI-tool, or ad-hoc analytics surface is specified.
- **Help/onboarding UX** — no tooltips framework, guided-tour/walkthrough mechanism, or in-app training content is specified anywhere in this prompt.
- **Offline/low-connectivity behavior** — relevant to field technicians (§5.8 WFM installation flow) but not addressed; no offline-draft-sync or degraded-connectivity design guidance is given.
- **Print/PDF export UX for the DXP itself** — beyond CAF e-signature capture (§2.4 Pattern 6) and the Export menu convention documented on this prompt's own generator tooling (unrelated to the DXP product), no print-friendly views or document-export UX for orders/tickets/customer records is specified.
- **Deep global search architecture** — §3.5 explicitly instructs Figma Make *not* to over-build this; only the 13 evidenced search screens and 5 filter screens get search/filter affordances.
- **Enterprise/IoT/B2B2C features beyond the one lead-to-order flagship (§5.7)** — parent/sub-account management depth, IoT-specific device provisioning, and B2B2C hierarchy administration screens are not detailed beyond that single flagship journey.

**If any of §15.1–15.3 turns out to matter for your build, treat it as a follow-up prompt rather than an
assumption to fill in silently** — each row above has a real source location to pull from rather than
requiring invention.
