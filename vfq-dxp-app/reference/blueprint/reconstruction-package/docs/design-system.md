# Design System (Phase 21) — Vodafone DXP

## 0. Provenance — read this before using anything below

This design system is **not** an official Vodafone deliverable and is **not** derived from the 83-document VFQ requirements corpus (which has zero design evidence — see the note this section replaces, still preserved in git history). It comes from a separate artifact the user supplied: a Claude-Design project (`vodafone-design-system/`) which is itself explicit that it was built from a **third-party brand-analysis package**, not a live pull of Vodafone's real design files:

> "This system is derived from a curated brand-analysis package, not a live pull of Vodafone's production codebase or a connected Figma file." — source: `nexu-io/open-design`, subtree `design-systems/vodafone/`, primarily its hand-authored `DESIGN.md` visual/brand analysis.

**Concretely, this means:**
- **Colors, type scale, spacing, and radii are specific, real values** (e.g. `#e60000`) grounded in `DESIGN.md`'s brand analysis — treat these as a well-researched approximation of Vodafone's actual brand, not a guess, but also not a pixel-exact export from Vodafone's own systems.
- **No real Vodafone logo, icon set, font files, or production codebase were available anywhere in the source chain.** Every place these would appear is an explicit, labeled placeholder (see §6).
- Classification per item follows this blueprint's evidence model, but scoped to *this* source (the design-system project), not the VFQ requirements corpus: tokens are `Explicit` (literal values in the source files), component APIs are `Explicit` (real `.jsx`/`.d.ts` source), and anything under §6 (logo/font/icons/animation) is `Assumed`/placeholder by the source's own admission.

**If the real Vodafone brand codebase, Figma file, logo, icon set, or font files become available, this entire document should be rebuilt from those instead** — the source project says so explicitly and repeatedly.

---

## 1. Brand Idea & Voice

- **Vodafone Red (`#e60000`) is the single dominant accent.** No second brand hue is ever introduced (no teal/purple/orange). Everything else — flat white/charcoal surfaces, restrained typography, near-zero shadow — exists to get out of its way.
- **Voice:** institutional but human — "corporate newsroom," not corporate jargon. Third-person brand voice ("Vodafone Group"), not casual "we/you."
- **Casing rule:** uppercase reserved for monumental display headlines, nav labels, and micro-labels. Everything H1-and-smaller (including all body copy) is sentence case — never mixed.
- **Numbers as content:** investor/sustainability surfaces treat precise numbers as headline-scale visual elements ("116.05 GBX", "15-min delayed"), not footnotes.
- **No emoji anywhere**, in any surface.
- **Surfaces cycle through exactly three states:** white editorial canvas → red chapter band → charcoal institutional panel (`#25282b`) — this is the system's entire "elevation" model; there is no drop-shadow-based elevation.

## 2. Color Tokens

### Brand & semantic
| Token | Value | Usage |
|---|---|---|
| `--accent` | `#e60000` | Primary brand red — CTAs, dividers, logo placeholder |
| `--accent-hover` | `color-mix(in oklab, var(--accent), black 8%)` | Button hover |
| `--accent-active` | `color-mix(in oklab, var(--accent), black 14%)` | Button press |
| `--accent-on` | `#ffffff` | Text/icon on accent background |
| `--deep-red` | `#ac1811` | Secondary institutional red accent |
| `--meta` | `#a61218` | Tertiary red (metadata) |
| `--signal-blue` | `#3860be` | Links |
| `--success` / `--warn` / `--danger` | `#008a00` / `#f5b400` / `#bd0000` | Semantic states |

### Neutrals & surfaces
| Token | Value | Usage |
|---|---|---|
| `--bg` | `#ffffff` | Editorial canvas |
| `--surface` | `#f4f4f4` | Card/image placeholder surface |
| `--surface-warm` | `#fff1f1` | Warm-tinted surface (near-accent) |
| `--light-neutral` | `#f2f2f2` | Filled-neutral tag pills |
| `--border` / `--border-soft` | `#d8d8d8` / `#eeeeee` | Hairline borders |
| `--charcoal-panel` | `#25282b` | Footer, ticker, impact-map, institutional panels |
| `--fg` / `--fg-2` | `#1f1f1f` / `#4a4d4e` | Primary / secondary text |
| `--grey-body` | `#7e7e7e` | Body copy, meta text |
| `--grey-form` | `#333333` | Form control text/border |
| `--grey-disabled` | `#bebebe` | Disabled state |

### Overlays & glass effects
`--white-glass-10` (10% white, glass pills on dark hero photography) · `--black-glass-5` (5% black, lowest-emphasis inline CTA) · `--white-80` / `--black-80` (80% opacity variants) · `--divider-on-dark` (25% white) · `--focus-ring` (`0 0 0 4px` accent @ 22% opacity — accent-tinted, not generic blue)

## 3. Typography

**Substitute font (see §6):** Inter (300/400/600/700/800), Google Fonts — standing in for Vodafone's real proprietary corporate typeface, which was not available anywhere in the source chain.

**Scale:** `--fs-hero-xl/-l/-m` 144/126/90px (up to weight 800, uppercase, tight negative tracking `-0.015em`) · `--fs-h1`–`--fs-h5` 48/40/32/24/20px · `--fs-lead` 20px · `--fs-body-lg` 18px · `--fs-body` 16px · `--fs-eyebrow` / `--fs-caption` 14px/12px · `--fs-btn` 14.4px.

**Only 3 weights do the real work:** 800 (display), 700 (bold/buttons/tags), 400 (body); 300 is reserved for occasional "calmer" 40-48px editorial headlines.

## 4. Spacing, Layout & Grid

8px base unit. `--space-1`…`--space-8`: 4/8/12/16/20/24/32px, plus `--space-3xl` 38px and `--space-12` 48px — **32px and 38px recur as universal rhythm constants** across page templates. Card interiors stay tight (12-16px); section-to-section rhythm is generous (`--section-y-desktop/tablet/phone`: 96/68/48px). `--container-max` 1200px, gutters 36/24/16px (desktop/tablet/phone) — three responsive tiers, corroborating (and extending with a phone tier) the Desktop+Tablet split already evidenced in `responsive-behaviour-catalogue.md`.

**Layout rhythm (every page template):** dark atmospheric hero → monumental headline → full-width red band → white editorial grid → charcoal institutional panel → charcoal footer.

## 5. Radius, Elevation & Motion

**Radius — two-tier and deliberate:** `--radius-button` 2px (utility/form buttons, inputs) · `--radius-card` 6px (cards, images) · `--radius-asymmetric` `0 6px 0 0` (signature single-corner shape for featured cards, echoing the speech-mark logo) · `--radius-cta-pill` 60px (editorial CTAs) · `--radius-circle`/`--radius-portrait` 50%/100% (icon buttons, portraits).

**Elevation — deliberately near-absent:** no drop shadows anywhere; the only "elevation" is the white↔charcoal surface-color shift (§1). The one real shadow-family token is `--focus-ring` (inset-style focus indicator). `--elev-flat: none`, `--elev-ring: 0 0 0 1px border`.

**Motion:** `--motion-fast` 150ms / `--motion-base` 220ms, `--ease-standard` cubic-bezier(.2,0,0,1). **Explicitly flagged as inferred, not confirmed** — `DESIGN.md` itself states timing/easing was "intentionally not documented" in the source material. Hover/press: primary buttons darken via `color-mix` toward black on hover, drop to 0.9 opacity on press; ghost buttons swap border/text to red on hover. No lift, no scale, no shadow-based hover — consistent with the no-elevation philosophy.

---

## 6. Explicit Placeholders — do not treat these as real assets

| Element | Status | What's used instead |
|---|---|---|
| **Logo** | No SVG/PNG asset anywhere in the source chain; per the source project's own policy, nothing was drawn or reconstructed from memory | Plain "VF" text roundel on Vodafone Red, in `TopNav` and `Footer` — swap for the real speech-mark logo when available |
| **Typeface** | Proprietary Vodafone corporate sans not available | Inter (see §3) — needs tighter tracking at 80px+ display sizes to fully match the intended feel |
| **Icons** | `DESIGN.md` references a corporate `icomoon` icon font (18/24/48px pictographs) but no font file/sprite/SVG set was included | Not wired in. If needed: [Lucide](https://lucide.dev) suggested as the closest open match — flagged as a substitution, not a source-backed choice. The "▶"/"✕" glyphs seen in the Button/IconButton demo are placeholder stand-ins only |
| **World-map illustration** (`ImpactMap`) | No real map asset supplied; this system does not hand-draw illustrations | Labeled placeholder area |
| **Animation timing** | Not documented in source (`DESIGN.md` explicitly flags this) | Generic token defaults (§5), inferred not confirmed |
| **Form input specs** (`Input` component) | `DESIGN.md`: "form input styles... are not exposed on these page templates; their specs are inferred from the ghost-button pattern" | Best-effort inference, flagged unconfirmed in the source itself |

---

## 7. Component Catalogue — real, with full prop APIs

**This section replaces the earlier version's gap** ("component-level specs were not recoverable"). The design-system project ships actual `.jsx` source + `.d.ts` TypeScript interfaces for every component — read directly, not inferred. All are `Explicit` relative to the design-system source (§0 governs how much weight to give the source itself).

### Buttons (`components/buttons/`)
**`Button`** — Vodafone's two-tier button system: tight 2px rectangles for utility/forms, fully-rounded pills for editorial CTAs. Both are equally "primary," chosen by context, not hierarchy.
```ts
interface ButtonProps {
  variant?: "primary-rect" | "primary-pill" | "ghost-rect" | "glass-pill" | "content-ghost-pill";
  disabled?: boolean; children?: ReactNode; onClick?: MouseEventHandler; style?: CSSProperties;
}
```
States: default, hover (darken/red per variant), active (opacity 0.9), disabled (opacity 0.45).

**`IconButton`** — circular, 32-40px, white background, charcoal icon; video play/pause, carousel arrows, close controls.
```ts
interface IconButtonProps { children?: ReactNode; size?: number; ariaLabel?: string; onClick?: MouseEventHandler; style?: CSSProperties; }
```

### Forms (`components/forms/`)
**`Input`** — labeled text field, 1px charcoal border, 2px radius. *(Inferred from the ghost-button pattern — flagged unconfirmed, see §6.)*
```ts
interface InputProps { label?: string; id?: string; value?: string; placeholder?: string; error?: string; type?: string; readOnly?: boolean; onChange?: ChangeEventHandler; }
```
States: default, error (red border + red helper text), disabled/read-only.

### Cards (`components/cards/`)
**`Card`** — editorial/news tile: 16:9 image, eyebrow date, red-outlined uppercase tag pill, bold H4 title, no shadow.
```ts
interface CardProps { image?: ReactNode; eyebrow?: string; tag?: string; title: string; href?: string; }
```
**`FeaturedCard`** — hero/featured tile with the signature asymmetric radius (`0 6px 0 0`).
```ts
interface FeaturedCardProps { image?: ReactNode; eyebrow?: string; title: string; children?: ReactNode; }
```
**`CircularMedia`** — perfect-circle frame (80-120px) for executive portraits / ESG pictograms.
```ts
interface CircularMediaProps { image?: ReactNode; size?: number; alt?: string; }
```

### Badges (`components/badges/`)
**`TagPill`** — `outlined-red` (uppercase, red border, article metadata) or `filled-neutral` (quieter tags).
```ts
interface TagPillProps { variant?: "outlined-red" | "filled-neutral"; children?: ReactNode; }
```

### Navigation (`components/navigation/`)
**`TopNav`** — light (solid white, interior pages) or dark (transparent over hero photography, reversed text).
```ts
interface TopNavProps { links?: string[]; dark?: boolean; }
```
**`Footer`** — universal charcoal-panel footer, 4-column link grid, legal line, repeating logo placeholder. `interface FooterProps {}` (no props — fully static).

### Marketing panels (`components/marketing/`)
**`RedBand`** — full-width red divider between every hero and body content; 64-80px desktop, ~40px mobile.
```ts
interface RedBandProps { height?: number; }
```
**`ShareTicker`** — institutional strip anchoring the investor template: large numeric share price + delay/timestamp.
```ts
interface ShareTickerProps { price?: string; currency?: string; delay?: string; timestamp?: string; }
```
**`ImpactMap`** — sustainability panel: charcoal surface, red location markers, rotated "IMPACT" wordmark, placeholder world-map illustration.
```ts
interface ImpactMapProps { markers?: string[]; }
```

### Intentional additions (not directly named in the underlying brand analysis, but added because the pattern recurs)
- **`IconButton`** — the icon-control shape/sizing rule recurs throughout the source material without being named as its own family.
- **`Input`** — best-effort inference per the source's own noted gap in form specs.

No component families were invented beyond what the design-system source (`components.manifest.json` + `DESIGN.md`) explicitly documents.

---

## 8. Reconciling with the rest of the blueprint

- **`component-catalogue.md`** (Stage H) — its generic Assumed primitive tier (`<TextInput>`, `<Select>`, `<Modal>`, etc.) should be reconciled against this file's *real* component set where they overlap: `Input` here is the real evidenced text-field spec; `Button`/`TagPill`/`Card` here supersede the generic placeholders there. Components with no analog here (DataTable, Stepper, SignaturePad, DatePicker) remain Assumed, since the source design-system project doesn't cover data-dense enterprise-app patterns — it's built for a marketing/editorial/investor site, not a CRM. This is an important mismatch to flag explicitly (§9).
- **`reconstruction-package/config/design-tokens.json`** — already generated (106 tokens) and verified against the canonical `tokens/*.css` files in this session; no changes needed.
- **`responsive-behaviour-catalogue.md`** — this system's 3-tier responsive grid (phone/tablet/desktop) corroborates the Desktop+Tablet evidence there and adds a phone tier not evidenced in the requirements corpus.

## 9. Important mismatch to flag: this is a marketing site's design system, not an enterprise CRM's

**Read this before applying §7's components directly to the DXP agent-facing screens.** The source design-system project (`vodafone-design-system/`) was built for a public-facing *corporate/marketing website* (Home, Investors, Sustainability page templates — see `ui_kits/corporate-website/`) — editorial cards, share tickers, impact maps, hero photography. The actual DXP application being reconstructed in this blueprint is an **internal, data-dense, agent-facing CRM/order-management tool** (guided wizards, approval queues, data tables, RBAC-gated screens — per `reusable-patterns.md`'s 18 patterns).

**What transfers directly:** color tokens, typography scale, spacing/radius/motion tokens (§2-5) — these are brand-level and apply everywhere.
**What does NOT transfer directly:** the component set in §7 (Card/FeaturedCard/ShareTicker/ImpactMap are editorial/marketing components) — the DXP needs `component-catalogue.md`'s enterprise primitives (DataTable, Stepper, Modal-based wizards, form-heavy inputs) far more than it needs `ShareTicker` or `ImpactMap`. Use this file for **brand tokens** (§2-5) applied to `component-catalogue.md`'s enterprise component set — don't literally reuse `Card`/`FeaturedCard` for order/lead list screens without adapting them to the data density `screens.md` actually evidences.
