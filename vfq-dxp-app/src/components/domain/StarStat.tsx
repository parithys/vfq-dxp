import { Icon } from '../primitives/Icon';

/** One fact on a Star-number card: an icon tile, a muted label and a bold value. `alert` is the red upfront charge. */
export function StarStat({ icon, label, value, alert = false, plainValue = false }: { icon: string; label: string; value: string; alert?: boolean; plainValue?: boolean }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-button)] ${alert ? 'bg-surface-warm text-accent' : 'bg-surface text-fg-2'}`}
      >
        <Icon path={icon} className="w-5 h-5" />
      </span>
      <div className="min-w-0">
        <p className={`text-[length:var(--fs-caption)] ${alert ? 'text-accent' : 'text-fg-2'}`}>{label}</p>
        <p className={`${plainValue ? 'font-normal' : 'font-bold'} text-[length:var(--fs-body)] leading-tight ${alert ? 'text-accent' : 'text-fg'}`}>{value}</p>
      </div>
    </div>
  );
}
