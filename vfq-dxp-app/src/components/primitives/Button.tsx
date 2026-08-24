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
  'inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed';

// Hover/active use the `enabled:` variant so disabled buttons never shift
// color on hover — the visual affordance must match the cursor (not-allowed)
// and the lack of a real click handler (UI cursor remediation, Phase 6).
const variantClasses: Record<ButtonVariant, string> = {
  'primary-rect': 'bg-accent text-accent-on enabled:hover:bg-accent-hover enabled:active:bg-accent-active rounded-[var(--radius-button)] px-4 py-2',
  'primary-pill': 'bg-accent text-accent-on enabled:hover:bg-accent-hover enabled:active:bg-accent-active rounded-[var(--radius-cta-pill)] px-6 py-2.5',
  'ghost-rect': 'bg-transparent text-fg border border-border enabled:hover:bg-surface rounded-[var(--radius-button)] px-4 py-2',
  'glass-pill': 'bg-[var(--white-glass-10)] backdrop-blur text-fg rounded-[var(--radius-glass-pill)] px-5 py-2',
  'content-ghost-pill': 'bg-transparent text-accent enabled:hover:bg-surface-warm rounded-[var(--radius-glass-pill)] px-4 py-1.5',
};

export function Button({ variant = 'primary-rect', compact, className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      className={`${base} ${variantClasses[variant]} ${compact ? 'text-[length:var(--fs-btn-compact)]' : 'text-[length:var(--fs-btn)]'} ${className}`}
      style={{ letterSpacing: 'var(--tracking-btn)' }}
      {...rest}
    >
      {children}
    </button>
  );
}
