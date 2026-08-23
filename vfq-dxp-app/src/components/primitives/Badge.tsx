// Real Vodafone TagPill per design-system.md §7 has 2 variants; broader status-pill
// usage (Order/Lead/Ticket lifecycle states) needs more — extended per
// component-catalogue.md §5 rather than replaced.
export type BadgeVariant = 'outlined-red' | 'filled-neutral' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  'outlined-red': 'border border-accent text-accent bg-transparent',
  'filled-neutral': 'bg-light-neutral text-fg-2',
  success: 'bg-[color-mix(in_oklab,var(--success),white_85%)] text-success',
  warning: 'bg-[color-mix(in_oklab,var(--warn),white_80%)] text-[var(--warn)]',
  danger: 'bg-[color-mix(in_oklab,var(--danger),white_85%)] text-danger',
};

export function Badge({ variant = 'filled-neutral', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-badge-pill)] px-2.5 py-0.5 text-[length:var(--fs-tag)] font-medium ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
