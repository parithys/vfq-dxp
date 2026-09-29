import type { ButtonHTMLAttributes } from 'react';

// Real Vodafone Button per design-system.md §7 (5 variants). primary-rect/ghost-rect
// are the recommended fit for a form-heavy enterprise app (2px corners); the pill
// variants are editorial/marketing-oriented per component-catalogue.md §5 but kept
// available since the source does specify them.
// `secondary-rect` is a SIXTH variant with no §7 counterpart, added 2026-09-27.
// See SECONDARY_SURFACE below for what it is and when to reach for it instead
// of `ghost-rect`.
export type ButtonVariant = 'primary-rect' | 'primary-pill' | 'ghost-rect' | 'glass-pill' | 'content-ghost-pill' | 'secondary-rect';

// The warm/secondary surface: colour only, no geometry. Exported because this
// treatment predates the variant and had spread to three call sites that
// CANNOT be a <Button> - two <Link>s (category chips, not-yet-built links) and
// an action tile whose shape is a two-line card on --radius-card, not a button.
// Those keep their own radius/padding and compose this for colour, so the
// palette lives in one place and a link can never drift from the button.
//
// Choosing between the two secondaries:
//   ghost-rect      - neutral, recedes. Cancel/Back/Close; the thing you press
//                     to NOT do the action. Transparent on --border.
//   secondary-rect  - warm, invites. A real action that simply isn't the
//                     page's primary one: quick actions, category chips.
//
// Colours per secondary-normal.svg / secondary-hover.svg (2026-09-27). Both
// assets are a 1px #E60000 stroke around a fill that is the ONLY thing which
// changes between states: white at rest, #FFF0F0 on hover. Every value already
// existed as a token, so nothing new was minted - `white` is --bg, `#FFF0F0` is
// --surface-warm, `#E60000` is --accent.
//
// Note this INVERTS the previous model. --surface-warm used to be the resting
// fill and the border did the hovering (transparent -> accent); now the border
// is accent in BOTH states and the fill does the work (--bg -> --surface-warm).
// The short-lived --surface-warm-border token existed only to be that resting
// border, so it was deleted with this change rather than left orphaned.
//
// Label is --deep-red, NOT the assets' #E60000. That is the one value here that
// does not follow the SVGs, and it is deliberate: #e60000 on the #FFF0F0 hover
// fill measures 4.35:1, under SC 1.4.3's 4.5:1 for the 14px these render at
// (it passes on the white resting fill, at 4.81:1 - it is only the hover state
// that fails). --deep-red is 10.29:1 on white and 9.30:1 on #FFF0F0, and still
// reads unmistakably red. Confirmed with the user 2026-09-27.
//
// Resting colour only - the hover is deliberately NOT bundled in, because the
// two element families need different selectors for it. `enabled:hover:` (what
// every other variant here uses, so a disabled button never shifts colour under
// the cursor) compiles to `:enabled`, which matches form controls only: on an
// <a> it silently never fires, so folding it in here would have left the links
// with no hover at all. Buttons add `enabled:hover:`, links add plain `hover:`.
export const SECONDARY_SURFACE =
  'border-accent bg-bg text-[var(--deep-red)]';

// The primary fill, standardised 2026-09-27: --accent-gradient, white label,
// no visible border. Exported for the same reason as SECONDARY_SURFACE - the
// selected state of every chip/toggle group uses this exact treatment and none
// of them is a <Button>, so the gradient lives in one place.
//
// `bg-[image:...]` and not `bg-[...]`: the value is a background-image. The
// `image:` hint is load-bearing - without it Tailwind resolves the bare var()
// to background-COLOR, which silently paints nothing for a gradient.
//
// Border is 1px TRANSPARENT rather than the specified `0px solid #e60000`.
// Visually identical - background-clip defaults to border-box, so the gradient
// paints straight through a transparent border, and the specified border is
// 0-width (invisible) either way. Keeping the 1px preserves the box-model
// parity documented below: at 0px a filled button is 2px shorter than
// ghost-rect and the two stop sitting level side by side.
export const PRIMARY_SURFACE =
  'border-transparent bg-[image:var(--accent-gradient)] text-accent-on';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  compact?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-2 font-medium tracking-[var(--tracking-btn)] transition-[color,background-color,border-color,transform] duration-150 disabled:opacity-40 disabled:cursor-not-allowed';

// Hover/active use the `enabled:` variant so disabled buttons never shift
// color on hover - the visual affordance must match the cursor (not-allowed)
// and the lack of a real click handler (UI cursor remediation, Phase 6).
//
// Two changes from the 2026-09-24 reference, both on the primary variants:
//
// - No --shadow-brand glow. That asset contains zero <filter>/feDropShadow
//   elements anywhere: every surface in it is separated by a 1px border, not
//   elevation. Floating overlays (dropdown, modal, drawer, toast, tooltip)
//   deliberately keep their shadows - the reference shows no overlay, so
//   there is nothing in it to copy, and a panel over content needs the
//   separation that an in-flow button does not.
// - Disabled is a flat --accent-disabled fill instead of inheriting the
//   base `disabled:opacity-40`. The reference's disabled CTAs are solid
//   #ffb3b3, which holds up over both --bg and --surface where a 40%
//   translucent red shifts with whatever sits behind it.
// Every variant carries a 1px border, transparent where the design has none.
// Without it a filled variant is 2px shorter than `ghost-rect`, whose border
// sits outside the padding box - so a primary and a secondary side by side
// (Finish / Abandoned in the topbar) rendered 37px against 39px. Declaring the
// border everywhere equalises the box model instead of tuning padding per
// variant, which would have shifted the label rather than the edge.
// The three pill variants used --radius-cta-pill (60px) / --radius-glass-pill
// (24px) until 2026-09-27, then briefly --radius-pill (9999px) for an
// app-wide pill-radius pass. As of the SAME day, every button variant in the
// app - including these - was flattened to --radius-button (8px) for radius
// consistency: nothing currently uses these three variants (grepped: zero
// call sites), so their "-pill" suffix is now a naming leftover, not a
// rendered shape - they are visually identical to primary-rect/ghost-rect,
// distinguished only by fill/padding.
const variantClasses: Record<ButtonVariant, string> = {
  // `disabled:bg-none` is REQUIRED, not tidy-up: it clears the gradient
  // background-image so the flat --accent-disabled background-color underneath
  // can show. Without it a disabled primary still renders the full-strength
  // gradient and reads as enabled.
  //
  // The press state lost its colour shift (`enabled:active:bg-accent-active`)
  // and is now `scale-[0.99]` alone. That class set a background-COLOR, which
  // the gradient image covers completely - it had become dead code the moment
  // the fill became an image. The 2026-09-27 spec defines only a normal and a
  // hover state, so rather than invent a third gradient this keeps the tactile
  // press and drops the shade. Hover also no longer eases: CSS cannot
  // interpolate between two linear-gradients, so it is an instant swap
  // regardless of the transition list in `base`.
  'primary-rect': `${PRIMARY_SURFACE} border enabled:hover:bg-[image:var(--accent-gradient-hover)] enabled:active:scale-[0.99] disabled:opacity-100 disabled:bg-none disabled:bg-[var(--accent-disabled)] rounded-[var(--radius-button)] px-4 py-2`,
  'primary-pill': `${PRIMARY_SURFACE} border enabled:hover:bg-[image:var(--accent-gradient-hover)] enabled:active:scale-[0.99] disabled:opacity-100 disabled:bg-none disabled:bg-[var(--accent-disabled)] rounded-[var(--radius-button)] px-6 py-2.5`,
  // `bg-bg` (white) at rest, not `bg-transparent`: a transparent fill on
  // --page-bg (#f5f7f9) left only a 1px border to read the button by, which
  // measured no different resting-vs-disabled since `disabled:opacity-40`
  // had no fill to fade - an enabled Cancel/Back/Close read as inactive.
  // White-at-rest / --surface-on-hover mirrors secondary-rect's own
  // resting/hover pair below.
  'ghost-rect': 'bg-bg text-fg border border-border enabled:hover:bg-surface rounded-[var(--radius-button)] px-4 py-2',
  'glass-pill': 'bg-[var(--white-glass-10)] backdrop-blur text-fg border border-transparent rounded-[var(--radius-button)] px-5 py-2',
  // Same fix as ghost-rect above - was bg-transparent AND border-transparent,
  // i.e. no visible chrome at all until hover.
  'content-ghost-pill': 'bg-bg text-accent border border-border enabled:hover:bg-surface-warm rounded-[var(--radius-button)] px-4 py-1.5',
  // Same px-4 py-2 box as primary-rect, so the two sit level side by side.
  'secondary-rect': `${SECONDARY_SURFACE} border enabled:hover:bg-surface-warm transition-colors rounded-[var(--radius-button)] px-4 py-2`,
};

export function Button({ variant = 'primary-rect', compact, className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      className={`${base} ${variantClasses[variant]} ${compact ? 'text-[length:var(--fs-btn-compact)]' : 'text-[length:var(--fs-btn)]'} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
