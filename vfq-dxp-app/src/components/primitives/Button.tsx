import type { ButtonHTMLAttributes } from 'react';

// Real Vodafone Button per design-system.md §7 (5 variants). primary-rect/ghost-rect
// are the recommended fit for a form-heavy enterprise app (2px corners); the pill
// variants are editorial/marketing-oriented per component-catalogue.md §5 but kept
// available since the source does specify them.
export type ButtonVariant = 'primary-rect' | 'primary-pill' | 'ghost-rect' | 'glass-pill' | 'content-ghost-pill';

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
const variantClasses: Record<ButtonVariant, string> = {
  'primary-rect': 'bg-accent text-accent-on border border-transparent enabled:hover:bg-accent-hover enabled:active:bg-accent-active enabled:active:scale-[0.99] disabled:opacity-100 disabled:bg-[var(--accent-disabled)] rounded-[var(--radius-button)] px-4 py-2',
  'primary-pill': 'bg-accent text-accent-on border border-transparent enabled:hover:bg-accent-hover enabled:active:bg-accent-active enabled:active:scale-[0.99] disabled:opacity-100 disabled:bg-[var(--accent-disabled)] rounded-[var(--radius-cta-pill)] px-6 py-2.5',
  'ghost-rect': 'bg-transparent text-fg border border-border enabled:hover:bg-surface rounded-[var(--radius-button)] px-4 py-2',
  'glass-pill': 'bg-[var(--white-glass-10)] backdrop-blur text-fg border border-transparent rounded-[var(--radius-glass-pill)] px-5 py-2',
  'content-ghost-pill': 'bg-transparent text-accent border border-transparent enabled:hover:bg-surface-warm rounded-[var(--radius-glass-pill)] px-4 py-1.5',
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
