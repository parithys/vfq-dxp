/** One fact on a Star-number card: a muted label and a bold value. `alert` is the red upfront charge. */
export function StarStat({ label, value, alert = false, plainValue = false }: { label: string; value: string; alert?: boolean; plainValue?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={`text-[length:var(--fs-caption)] ${alert ? 'text-accent' : 'text-fg-2'}`}>{label}</p>
      <p className={`${plainValue ? 'font-normal' : 'font-bold'} text-[length:var(--fs-body)] leading-tight ${alert ? 'text-accent' : 'text-fg'}`}>{value}</p>
    </div>
  );
}
