import { Icon } from '../primitives/Icon';

/** One fact on a Star-number card: a bare icon, a muted label and a bold value. `alert` is the red upfront charge. */
export function StarStat({ icon, label, value, alert = false, plainValue = false }: { icon: string; label: string; value: string; alert?: boolean; plainValue?: boolean }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {/* No tile and no padding around the icon: the card is narrow, and the room goes to the value beside it. */}
      <Icon path={icon} className={`w-5 h-5 shrink-0 ${alert ? 'text-accent' : 'text-fg-2'}`} />
      <div className="min-w-0">
        <p className={`text-[length:var(--fs-caption)] ${alert ? 'text-accent' : 'text-fg-2'}`}>{label}</p>
        <p className={`${plainValue ? 'font-normal' : 'font-bold'} text-[length:var(--fs-body)] leading-tight ${alert ? 'text-accent' : 'text-fg'}`}>{value}</p>
      </div>
    </div>
  );
}
