import { useEffect, useState } from 'react';
import { Icon } from '../primitives/Icon';
import { CARD_IDLE, CARD_SELECTED, CARD_SELECTED_SURFACE, SelectedCardTexture } from '../patterns/offerCardParts';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { isAddonEligible, type AddonEligibilityContext, type AddonEligibilityRule } from '../../engines/addonEligibility';

interface AddonProduct {
  productId: string;
  name: string;
  type: string;
  mrcQAR: number;
  description?: string;
  /** Optional conditions for being offered this add-on - see addonEligibility.ts. */
  eligibility?: AddonEligibilityRule;
}

interface AddonsPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /**
   * Set by PostpaidPlanAddonsStep's own "Add-ons (optional)" TAB (2026-09-28
   * tabbed redesign) - the tab bar itself now names and counts this section,
   * so repeating "Add-ons (optional)" as a second, collapsible heading
   * directly under it was a redundant control doing the tab's job a second
   * time. The one other caller (none currently - this is still this
   * component's only call site) keeps the original collapsible heading by
   * simply omitting this prop.
   */
  hideHeader?: boolean;
  /** Who the add-ons are for. Only add-ons this customer is eligible for are shown. */
  eligibilityContext?: AddonEligibilityContext;
  /** Shown when no add-on is available. Omitted: nothing is rendered in that case. */
  emptyMessage?: string;
}

// "Plan & Add-ons" (reference flow step 5) - optional, non-gating multi-select
// of catalogue products where type === 'Add-on', alongside the mandatory
// single-select Plan above it in ProductPlanStep.
const CHEVRON = 'M9 18l6-6-6-6';

export function AddonsPicker({ selectedIds, onChange, hideHeader, eligibilityContext, emptyMessage }: AddonsPickerProps) {
  const [allAddons, setAllAddons] = useState<AddonProduct[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [attempt, setAttempt] = useState(0);
  // Eligibility is evaluated BEFORE anything renders: an add-on the customer is not
  // eligible for is not in the list at all, so it can be neither seen nor selected.
  const addons = eligibilityContext ? allAddons.filter((a) => isAddonEligible(a, eligibilityContext)) : allAddons;
  // Collapsed by default (2026-09-27). Add-ons are optional and most orders
  // take none, so the list was occupying the step for a decision usually
  // answered "no" - but the count in the header means a collapsed section
  // still reports what is inside it, which is the part that makes collapsing
  // safe rather than hiding state. Moot when hideHeader is set: there is no
  // collapsible heading to default shut, so the list always renders open.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    mockDataEngine
      .list<AddonProduct>('products')
      .then((all) => {
        if (cancelled) return;
        setAllAddons(all.filter((p) => p.type === 'Add-on'));
        setStatus('ready');
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // A selection that stopped being eligible (the plan or customer type changed) is dropped.
  const eligibleIds = addons.map((a) => a.productId).join(',');
  useEffect(() => {
    if (allAddons.length === 0) return;
    const kept = selectedIds.filter((id) => addons.some((a) => a.productId === id));
    if (kept.length !== selectedIds.length) onChange(kept);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibleIds, allAddons.length]);

  if (status === 'loading' && emptyMessage) return <p className="text-muted text-[length:var(--fs-caption)]">Loading add-ons…</p>;
  if (status === 'error') {
    return (
      <div role="alert" className="rounded-[var(--radius-card)] border border-[var(--warn)] bg-[color-mix(in_oklab,var(--warn),var(--bg)_92%)] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[var(--warn-text)] text-[length:var(--fs-body)]">Add-ons could not be loaded. You can continue without them.</p>
        <button
          type="button"
          onClick={() => {
            setStatus('loading');
            setAttempt((n) => n + 1);
          }}
          className="text-fg underline font-medium text-[length:var(--fs-body)]"
        >
          Retry
        </button>
      </div>
    );
  }
  if (addons.length === 0) {
    return status === 'ready' && emptyMessage ? (
      <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface px-4 py-6 text-center">
        <p className="text-fg-2 text-[length:var(--fs-body)]">{emptyMessage}</p>
      </div>
    ) : null;
  }

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
      {!hideHeader && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 text-left"
        >
          <Icon path={CHEVRON} className={`w-4 h-4 text-muted transition-transform ${open ? 'rotate-90' : ''}`} />
          <h3 className="text-fg font-semibold text-[length:var(--fs-body-lg)]">
            Add-ons{selectedIds.length > 0 ? ` (${selectedIds.length} selected)` : ' (optional)'}
          </h3>
        </button>
      )}
      {/* Add-on cards share the plan cards' standard (shared idle / selected states, selected texture, tick).
          Multi-select: each card toggles only itself, so choosing one never clears another. */}
      <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 ${open || hideHeader ? '' : 'hidden'}`}>
        {addons.map((a) => {
          const selected = selectedIds.includes(a.productId);
          return (
            <div
              key={a.productId}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              onClick={() => toggle(a.productId)}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  toggle(a.productId);
                }
              }}
              className={`relative isolate flex flex-col gap-3 rounded-[var(--radius-card)] border p-5 cursor-pointer transition-colors focus:outline-none focus-visible:shadow-[var(--focus-ring)] ${
                selected ? `${CARD_SELECTED} ${CARD_SELECTED_SURFACE}` : CARD_IDLE
              }`}
            >
              {selected && <SelectedCardTexture />}
              {selected && (
                <span aria-hidden="true" className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white ring-2 ring-bg">
                  <Icon path="M20 6L9 17l-5-5" className="w-3.5 h-3.5" strokeWidth={3} />
                </span>
              )}
              <p className="text-fg font-bold text-[length:var(--fs-h5)] leading-snug">{a.name}</p>
              {a.description && <p className="text-fg-2 text-[length:var(--fs-caption)]">{a.description}</p>}
              <p className="text-accent mt-auto">
                <span className="text-[length:var(--fs-body)] font-semibold">QR </span>
                <span className="text-[length:var(--fs-h3)] font-bold">{a.mrcQAR}</span>
                <span className="text-fg-2 text-[length:var(--fs-caption)]"> /mo</span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
