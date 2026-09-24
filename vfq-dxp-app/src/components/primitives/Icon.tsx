// Lightweight inline stroke-icon primitive - no icon library dependency.
// Path data is hand-authored per icon, not pulled from a design-system spec.
export function Icon({ path, className = 'w-5 h-5' }: { path: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={path} />
    </svg>
  );
}
