# VFQ DXP — Figma Make Prompt 3 of 3: Full Screen Set, Business Logic & Polish

**Use this third and last, in the same Figma Make project as Prompts 1 and 2.** It assumes the design
system, component library, navigation structure, RBAC model, and 14 flagship journeys from Prompts 1–2
already exist. This prompt fills out the remaining screen set and layers in validation, notifications,
responsiveness, accessibility, and interaction polish across everything built so far.

**Continue following the traceability convention from Prompt 1** (frame naming by pattern+module+step,
visible tagging of anything below marked lower-confidence/assumed, preserving real IDs, no silent
invention beyond what's specified across all three prompts).

---

## 1. Full Screen Set

213 screens (SCR-001–SCR-213) map onto the 6 screen-type/pattern families already established in Prompt 1
§2.4: **93 Detail/List/Queue (largest bucket), 58 Wizard, 32 Modal, 13 Page/Landing, 11 Dashboard, 6
Popup.** Generate the full screen set module-by-module (16 modules, Prompt 2 §1.1) from the journey step
sequences already built in Prompt 2 §3 — every screen a journey step touches should exist as a named,
routable screen instance of one of the 6 pattern families, carrying its journey's step name (e.g. "New
Fixed Line — Address," "SIM Swap — Approval Queue").

Do not invent screens outside a journey's evidenced step sequence. Where Prompt 2's flagship journeys
list specific screens touched (e.g. "SCR-034, SCR-207, SCR-115, SCR-116" for Home Move), treat those as
the minimum required screen set for that journey — build exactly that set before considering additions.

For modules/screens not covered by a flagship journey in Prompt 2, generate screens as instances of the
nearest matching pattern (§2.4 in Prompt 1), reusing the same field/copy conventions established in the
flagship journeys — do not design bespoke one-off screens.

---

## 2. Business Rules, Validation & Business Processes

### 2.1 Business Rule Categories (346 rules total)

Encode these as the underlying logic layer behind every form/wizard, weighted by category volume:
**Validation (137) · Eligibility (50) · Routing (46) · Derivation (44) · Calculation (30) · Permission
(28) · Visibility (11).** Representative real examples to anchor tone/specificity (module: Lead
Management, Mobile Postpaid, MNP/FNP, Fixed Line/Fibre/FWA, Identity, Billing, Enterprise, Order
Management, Ticketing/SIM, CAF, Access Governance): e.g. "Customer already has 2 or more Post-paid
connections" (triggers an advisory); credit-limit floor rules (Agent Minimum, Prompt 2 §2.3); donor
accept/reject branching in MNP.

### 2.2 Validation Patterns (418 entries: 281 field-level, 137 business-rule-level)

Build these as **reusable validation rule-sets applied consistently** across the full screen set, not
bespoke per-screen logic:

- **Address validation** — blank-field checks, non-numeric/oversized Building No./Street No., an
  explicit "Skip Address" escape hatch. Recurs on ~9 screens.
- **SIM/CPE Serial validation** — "must be 19 digits; must exist and not already be assigned in UIM."
  Recurs on ~15 screens.
- **Mandatory Supplementary Form** — the single most common exception tag, recurring on 20+ screens
  across every screen type. Reuse `AttachmentTile`'s gating behavior (already built in Prompt 1)
  everywhere this applies.
- **Format errors, mandatory-field errors, backend/inventory errors** (including raw backend codes like
  `SBL-EXL-00151`), threshold validations, permission-flavored validation messages, and
  confirmation/warning dialogs are all real, evidenced message *shapes* — see §2.3 for exact copy
  patterns to follow.
- **Known data-quality gap, worth fixing not replicating:** email/address fields in source have
  presence-only (not format) validation in places (e.g. a ZSP Entry screen) — implement proper format
  validation in the rebuild rather than reproducing this gap.

### 2.3 Error & Success Message Copy Patterns

Follow these exact templates for consistency across all screens (do not invent new message shapes):

- **Terminal order-completion success:** `"{JourneyName} completed successfully. Order Number:- '{orderNumber}'"` — e.g. *"Fixed Line completed successfully. Order Number:- '1-29793912388'"*. Apply universally across every activation-type journey's final step.
- **Reservation success:** embeds a token plus a backend success code, e.g. *"SUCCESS:Reservation Token:1001357812(SBL-EXL-00151)"*.
- **Limit-floor blocking error:** tied to the same code family, e.g. *"SL Limit Amount must not be lower than the product's Agent Min Value or order validation fails"* / *"Bill Limit can not be set lower than Agent Minimum 80/50."* Apply this pattern to any "editable up to a configured floor" field.
- **Generic submission confirmation:** *"Order request is submitted successfully. Please check installed asset of the account to confirm."* — sometimes paired with a business advisory in the same message.
- **Step-level (non-terminal) success** uses a lighter green-checkmark/"Saved!" micro-confirmation — reserve full modal confirmation dialogs for terminal/order-submission actions only; do not overuse modal confirmations mid-wizard.

### 2.4 Exception & Failure Handling

Four categories, in priority order for design attention:

1. **Validation failures** — the richest evidenced category (11 real FWA negative-scenario examples).
   Design clear, specific inline errors — never a raw stack trace. **Explicit corpus directive: do not
   reproduce native browser alerts, raw backend codes as user-facing copy, or stale/leftover banners** —
   route every failure through the Toast/Banner/Modal/Inline-error system (§3 below).
2. **Permission failures** — default pattern is **hide, not disable**: an action a role can't perform
   should not render as a greyed-out button (which invites "why can't I click this" support tickets) — it
   should not render at all, consistent with the RBAC default from Prompt 2 §2.2.
3. **Workflow failures** — only ~14% of workflow steps have an evidenced exception branch (130/945). For
   the branches not evidenced, design a generic "step failed, retry or escalate" fallback rather than
   inventing specific business logic.
4. **Technical/interruption failures** — network/system interruption handling is mostly an engineering
   default (session recovery, draft persistence) rather than a specifically evidenced UX — implement
   standard resilience patterns (auto-save drafts, resumable wizards per Pattern 17) rather than treating
   this as a documented requirement.

### 2.5 Feature Toggles

The thinnest-evidenced area in the corpus — only Current-state → Target-state pairs are evidenced, with
no flag-management UI documented anywhere. **Do not invent a feature-flag admin screen** — where a
toggle-like behavior is evidenced (e.g. a module being Current vs. Target state), represent it as a
simple state difference in the relevant screen, not as a standalone toggles product surface.

### 2.6 Test Scenario Coverage — reference only, not screens to design

775 real test scenarios exist in source (493 module-level, 213 navigation, 40 security, 29 boundary) —
these aren't screens to design, but a strong signal of what "correct behavior" means per flow. Use them as
a sanity check while building §1's screens, not as a separate deliverable.

---

## 3. Notification & Confirmation System

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

Apply this system retroactively across every screen built in Prompt 2 and §1 above — replace any ad-hoc
confirmation/error treatment with one of these four primitives.

---

## 4. Responsiveness & Channel Behavior

### 4.1 Two evidenced form factors: Desktop and Tablet — build both explicitly

Do not derive Tablet from Desktop via CSS breakpoints alone; treat them as two maintained UI variants
sharing the same component set. Coverage: Desktop 95 screens/13 journeys, Tablet 65 screens/25 journeys,
Desktop Vanilla 32 screens/8 journeys. Where a journey has source documentation for both channels (e.g.
SIM Swap, Prompt 2 §3.3), implement the evidenced differences directly rather than assuming parity:

- SIM Swap: different queue naming ("SIM Swap Queue" vs. "Order Approval Queue"), an extra "Validate
  Attachments" step on Tablet, different post-approval landing screen.
- CAF Signature Capture: the layout explicitly shifts between laptop and tablet views specifically at
  the signature-capture step — a targeted form-factor change, not a uniform breakpoint reflow.

Where no specific divergence is documented for a given journey, apply standard responsive reflow
(stacking, touch-target sizing) rather than inventing new tablet-specific steps.

### 4.2 Do not build a phone breakpoint for agent-facing screens

No source document shows an agent-facing phone-sized UI. Phone-adjacent references in the corpus are
customer-facing (My Vodafone app, SMS deep-links) — an entirely separate, out-of-scope channel with zero
UI evidenced. If Figma Make's default workflow wants to generate a mobile variant, override it: this
product's minimum viewport is tablet width.

---

## 5. Accessibility Requirements

**Explicitly flagged: the source corpus has no dedicated accessibility catalogue.** Nothing below is
evidenced from Vodafone Qatar workshop material — it is a standard baseline **assumed** appropriate for
an enterprise internal tool, following common practice for agent-facing government/telecom console
software. Treat this section as a sensible default to build to, not a traced requirement — flag it as
such in any downstream documentation.

- **Baseline standard:** WCAG 2.1 Level AA.
- **Color contrast:** all text/background pairs from the Prompt 1 palette must meet 4.5:1 (normal text) /
  3:1 (large text, 18px+/14px+bold) — spot-check `--grey-body` (#7e7e7e) and `--muted` (#6f7375) against
  `--bg` (#ffffff) specifically, as mid-grey tones are the most common contrast failure point in this
  palette.
- **Focus states:** every interactive element must show the `--focus-ring` (accent-tinted, from Prompt 1)
  on keyboard focus — never rely on browser default outline removal without a replacement.
- **Keyboard navigation:** full keyboard operability for every wizard (Tab/Shift-Tab through fields,
  Enter to advance, Esc to close modals/popups), every DataTable (arrow-key row navigation, Enter to
  open), and every approval action.
- **Screen reader support:** semantic form labels for every primitive (no placeholder-only labels);
  status pills must carry a text equivalent, not rely on color alone to convey success/warning/danger;
  role labels must not carry decorative icon glyphs that get read aloud redundantly ahead of the label
  text (consistent with the source design system's own "no emoji on role labels" convention).
- **Error identification:** every inline field error (§2.2 above) must be programmatically associated
  with its field (e.g. `aria-describedby`) and not conveyed by color/border alone.
- **Touch targets (Tablet):** minimum 44×44px for all interactive controls, given Tablet is a first-class
  input channel (§4.1), not just a resized desktop view.
- **Motion:** respect `prefers-reduced-motion` — the app's own motion (§6 below) is already minimal (no
  lift/scale/shadow animation), so this should be low-cost to satisfy.

Apply this pass across every screen built in Prompt 2 and §1 above — this is a retrofit pass, not a
separate set of screens.

---

## 6. Interaction & Motion Details

- **Buttons:** primary (`--accent`) darkens toward black on hover (`--accent-hover`), drops to 0.9
  opacity on press (`--accent-active`), 0.45 opacity when disabled. Ghost/secondary buttons swap
  border+text color to accent red on hover. No lift, scale, or shadow growth on hover/press — flat,
  functional motion throughout, consistent with the near-absent elevation model from Prompt 1.
- **Timing:** 150ms for micro-interactions (hover, toggle), 220ms for larger transitions (modal
  open/close, panel expand), easing `cubic-bezier(.2,0,0,1)`. Flagged as inferred defaults — reasonable
  to ship, not a hard spec.
- **Wizard step transitions:** Continue advances linearly to the next step; Go Back returns to the prior
  step; Abandon/Cancel exits with drafts persisted for resume (Pattern 17). Step completion shows a
  lightweight green-checkmark/"Saved!" micro-confirmation — not a full modal (§2.3).
- **Approval actions:** Approve requires an attestation checkbox where evidenced (Prompt 2 §3.9) —
  unchecked by default, blocking the action until checked. Reject has two distinct sub-flows:
  **Reject-Correction** (returns to the agent for fix-and-resubmit via a dedicated correction wizard) and
  **Reject-Drop Order** (terminal cancellation) — always offer both as separate actions, never collapse
  them into one generic "Reject."
- **Hub navigation (dashboards/tile-launchers):** tile or row click drills into a detail screen or
  module; no forward/back sequence; tab/sub-navigation lives within the destination screen (Customer 360's
  Overview/Order/Tickets/Assets/Billing/Credit Risk tab set is the reference model).
- **Overlay navigation (modals/popups):** opened from a parent-screen action; closed via Confirm/Save
  (commits) or Cancel/Close (discards, no side effects); modals show a confirmation before closing,
  popups just dismiss on acknowledgment.

---

## 7. Final Traceability Pass

Before considering the build complete:

1. Confirm every top-level frame/screen generated across all three prompts is named per the Prompt 1 §3
   convention (pattern family + module + step name).
2. Confirm everything flagged as inferred/assumed/medium-confidence anywhere across all three prompts
   still carries its visible marker (motion timing; Patterns 16/18; the Suspension/Resume journey; the
   entire Accessibility section §5 above).
3. Do a pass for anything invented beyond what the three prompts specify — flag it rather than leaving it
   unmarked.

---

**This completes the three-prompt build.** For what's deliberately excluded even after all three prompts
(reporting/BI beyond the 5 dashboards, help/onboarding UX, offline behavior, print/PDF export, deep
search, full Enterprise/IoT/B2B2C depth, and several corpus items not condensed into this series), see the
"Explicitly Out of Scope" section of the full master prompt document
(`VFQ_DXP_Figma_Make_Master_Prompt.md`, §15) — treat those as candidates for a follow-up prompt, not gaps
to fill in silently.
