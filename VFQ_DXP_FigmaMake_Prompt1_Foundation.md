# VFQ DXP — Figma Make Prompt 1 of 3: Foundation (Design System & Components)

**Use this first, as your opening Figma Make prompt.** It establishes the design tokens, component
library, and traceability convention that Prompts 2 and 3 will build on top of in the same project. After
Figma Make generates from this prompt, move on to Prompt 2 (`VFQ_DXP_FigmaMake_Prompt2_IA_Personas_Journeys.md`).

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

**Two agent-facing device channels will be designed: Desktop and Tablet** (full detail in Prompt 3). Do
not design a phone/mobile breakpoint for agent-facing screens.

This is a large, multi-phase build — 16 functional modules, 111 journeys, 213 screens. **For this first
prompt, build only:** the design tokens/theme, the core component library (§2), and a basic app shell
(top-level navigation frame + a placeholder tile-launcher home screen) so later prompts have a shell to
populate. Do not attempt full screens or journeys yet.

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
focus states, not a generic blue ring (required for WCAG focus-visible compliance — full accessibility
spec comes in Prompt 3).

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
36px desktop, 24px tablet.

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
motion flat and functional, consistent with the no-elevation philosophy. (Full interaction/motion detail
follows in Prompt 3.)

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
| `Toast` / `Alert` / `ConfirmDialog` | Notifications, confirmations | Detailed further in Prompt 3 |

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

Every screen in the eventual app is an instance of one of these patterns. Build the pattern once, then
generate screen instances by swapping fields/copy in later prompts — do not design each screen bespoke.
**For this prompt, just register the pattern names/structure as components; do not build full screen
instances yet.**

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
12. **App/Module Launcher Home Screen** — tile grid, role-filtered visibility, universal entry point — **build this one as an actual screen now**, it's the app's front door

**Tier 5 — workflow/queue**
13. **Order Approval Queue + Detail** — queue → drill-in (tabs: Attachments/Order Details/Activities/Agents Details) → Approve/Reject-Correction/Reject-Drop
14. **Lead List + Owner/Status Management** — filtered by owner/creator/team/org, reassignment picker
15. **Cross-Sales / Migration Offer Acceptance Card** — pre-populated offer, "Autobase" accept-and-confirm pattern

**Tier 6 — specialized (build last)**
16. **Bulk Operation Portal** — template upload, async processing, per-row pass/fail (Excel-style)
17. **In-Progress Journey Resume List** — *medium confidence, inferred pattern* — resumable draft orders
18. **Manager/Field-Technician Reassignment Dialog** — *medium confidence, inferred pattern* — move/reassign an activity

---

## 3. Traceability Instruction — apply from this prompt onward, for the rest of the build

This is a standing instruction for every remaining prompt in this series, not just this one:

1. **Name every top-level frame/screen using its pattern family + module + step name** (e.g. "Wizard —
   Fixed Line — Address," "Queue — SIM Swap Approval — Desktop," "Modal — CAF Signature Capture") so a
   reviewer can map each frame back to source documentation without needing a separate lookup table.
2. **Tag inferred/assumed elements visibly during design review** (e.g. motion timing, anything called out
   as "medium confidence" or "inferred" in later prompts) with a distinct visual marker — a small
   "assumed" annotation layer or comment — removable once confirmed by the business.
3. **Preserve real screen/journey identifiers where later prompts cite one** (e.g. an SCR-xxx or UJ-xxx
   ID) — carry that ID into the frame's naming or description metadata.
4. **Do not silently invent screens, fields, or flows beyond what this prompt series specifies.** If a gap
   appears during the build, prefer a clearly-marked placeholder over fabricated detail.

---

**What to build from this prompt:** the design token/theme setup, the full component library (§2.1–2.3),
placeholder component slots for the 18 patterns (§2.4), and one real built screen — the App/Module
Launcher Home (Pattern 12) — as the navigation entry point. Then continue with Prompt 2.
