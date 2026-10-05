export function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex gap-2 px-5 py-4">
      {Array.from({ length: pages }, (_, i) => (
        <button key={i} type="button" onClick={() => onChange(i)} className={`w-9 h-9 rounded-[var(--radius-button)] border text-[length:var(--fs-body)] ${i === page ? 'bg-accent text-accent-on border-accent' : 'bg-bg border-border hover:bg-surface'}`}>
          {i + 1}
        </button>
      ))}
    </div>
  );
}
