// Real Vodafone TagPill per design-system.md §7 has 2 variants; broader status-pill
// usage (Order/Lead/Ticket lifecycle states) needs more - extended per
// component-catalogue.md §5 rather than replaced.
export type BadgeVariant = 'outlined-red' | 'filled-neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

// Status pills follow the 2026-09-24 reference: outlined rather than filled -
// a --bg interior, a 1px tinted border and a coloured label. That replaces the
// 12%-tint fills these carried before, which the reference does not use
// anywhere. `info` is new, for the reference's violet "Requires Approval"
// chip; no call site is rewired to it here, it is only made available.
//
// The leading status dot went with it - the reference's pills are label-only.
// It cost nothing in accessibility terms: the dot was aria-hidden and took
// its colour from the text, so the pill's own label was always what conveyed
// the status, not the colour. Corner drops 32px -> 4px for the same reason.
const variantClasses: Record<BadgeVariant, string> = {
  'outlined-red': 'border border-accent text-accent bg-transparent',
  'filled-neutral': 'bg-light-neutral text-fg-2',
  success: 'bg-bg border border-[var(--success-border)] text-success',
  warning: 'bg-bg border border-[var(--warn-border)] text-[var(--warn-text)]',
  danger: 'bg-bg border border-[var(--danger-border)] text-danger',
  info: 'bg-bg border border-[var(--info-border)] text-[var(--info)]',
  accent: 'bg-accent text-accent-on',
};

export function Badge({ variant = 'filled-neutral', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-tag)] px-2.5 py-0.5 text-[length:var(--fs-tag)] font-medium ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
