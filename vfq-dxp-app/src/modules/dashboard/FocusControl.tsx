import type { FocusMode } from './dashboardLayout';

// Order requested 2026-09-24: the two single-zone views first, the combined
// view last. Display order only - `both` remains the DEFAULT focus (see
// focusFromParam), so the initially-selected pill is now the third one rather
// than the middle one.
const OPTIONS: { key: FocusMode; label: string }[] = [
  { key: 'customer-ops', label: 'Customer Ops' },
  { key: 'product', label: 'Product' },
  { key: 'both', label: 'Both' },
];

// Reuses ModuleScreenList's filter-pill class strings verbatim, so this is a
// composition of an existing control rather than a new primitive.
//
// Writes to ?focus= rather than component state, matching how /tasks?filter=
// is already read - the view stays linkable and survives a refresh.
export function FocusControl({ focus, onChange }: { focus: FocusMode; onChange: (f: FocusMode) => void }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Dashboard focus">
      <span className="text-muted text-[length:var(--fs-caption)] mr-1">Focus</span>
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          aria-pressed={focus === o.key}
          className={`rounded-[var(--radius-pill)] border px-3 py-1.5 text-[length:var(--fs-caption)] ${
            focus === o.key
              ? 'border-accent bg-accent text-accent-on'
              : 'border-border-soft text-fg-2 hover:bg-surface'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
