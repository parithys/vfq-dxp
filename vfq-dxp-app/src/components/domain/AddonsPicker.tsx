import { useEffect, useState } from 'react';
import { Checkbox } from '../primitives/Checkbox';
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

// "Plan & Add-ons" (reference flow step 5) - optional, non-gating multi-select
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
    // Heading and spacing match the "Eligible Discounts" section this now sits
    // above (2026-09-26). It was a muted caption at --fs-caption, which read as
    // a field label rather than as one of the step's three sections - so the
    // agent saw two headings and a label where there are three equal choices to
    // make. Same element, size and weight as its sibling; the "(optional)"
    // stays because it is the one thing that distinguishes this section from
    // the other two, both of which require an answer.
    <div className="space-y-4">
      <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)]">Add-ons (optional)</h3>
      <div className="grid grid-cols-1 gap-2">
        {addons.map((a) => (
          <label
            key={a.productId}
            className={`flex items-center justify-between gap-2 rounded-[var(--radius-card)] border p-3 cursor-pointer ${
              selectedIds.includes(a.productId) ? 'border-[var(--field-card-selected)] bg-[var(--field-card-selected-bg)]' : 'border-border-soft hover:border-[var(--field-card-selected)]'
            }`}
          >
            <span className="flex items-center gap-2">
              {/* Sizing, radius and border classes dropped - the primitive
                  owns them. This was the one call site that had already
                  hand-rolled a 19px tile, which is what --radius-checkbox and
                  the 18px box now express for all ten. */}
              <Checkbox checked={selectedIds.includes(a.productId)} onChange={() => toggle(a.productId)} />
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
