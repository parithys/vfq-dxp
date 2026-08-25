import { useEffect, useState } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';

interface AddonProduct {
  productId: string;
  name: string;
  type: string;
  mrcQAR: number;
  description?: string;
}

interface AddonsPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

// "Plan & Add-ons" (reference flow step 5) — optional, non-gating multi-select
// of catalogue products where type === 'Add-on', alongside the mandatory
// single-select Plan above it in ProductPlanStep.
export function AddonsPicker({ selectedIds, onChange }: AddonsPickerProps) {
  const [addons, setAddons] = useState<AddonProduct[]>([]);

  useEffect(() => {
    mockDataEngine.list<AddonProduct>('products').then((all) => setAddons(all.filter((p) => p.type === 'Add-on')));
  }, []);

  if (addons.length === 0) return null;

  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id]);

  return (
    <div className="space-y-2">
      <p className="text-fg-2 text-[length:var(--fs-caption)]">Add-ons (optional)</p>
      <div className="grid grid-cols-1 gap-2">
        {addons.map((a) => (
          <label
            key={a.productId}
            className={`flex items-center justify-between gap-2 rounded-[var(--radius-card)] border p-3 cursor-pointer ${
              selectedIds.includes(a.productId) ? 'border-accent bg-surface-warm' : 'border-border-soft hover:border-accent'
            }`}
          >
            <span className="flex items-center gap-2">
              <input type="checkbox" checked={selectedIds.includes(a.productId)} onChange={() => toggle(a.productId)} />
              <span>
                <span className="text-fg">{a.name}</span>
                {a.description && <span className="block text-[length:var(--fs-caption)] text-muted">{a.description}</span>}
              </span>
            </span>
            <span className="text-fg shrink-0">QR {a.mrcQAR}/mo</span>
          </label>
        ))}
      </div>
    </div>
  );
}
