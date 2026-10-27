import { Button } from '../../components/primitives/Button';
import { EmptyState } from '../../components/primitives/EmptyState';
import { useEffect, useState } from 'react';
import { Icon } from '../../components/primitives/Icon';
import { TabStrip } from '../../components/primitives/TabStrip';
import { SegmentedTabs } from '../../components/primitives/SegmentedTabs';
import { CARD_IDLE, CARD_SELECTED, SelectedTick, SelectedCardTexture } from '../../components/primitives/offerCardParts';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { isAddonEligible, type AddonEligibilityContext, type AddonEligibilityRule } from '../../engines/addonEligibility';
import { ADDON_CATEGORIES, ADDON_PRICING_FILTERS, DEFAULT_ADDON_PRICING, addonsFor, selectedPerCategory, type AddonCategory, type AddonPricing, type AddonPricingModel, addonPriceDisplay } from '../../engines/addonCategories';
import { formatAmount } from '../../lib/format';

interface AddonProduct {
  productId: string;
  name: string;
  type: string;
  mrcQAR: number;
  description?: string;
  /** Optional conditions for being offered this add-on - see addonEligibility.ts. */
  eligibility?: AddonEligibilityRule;
  /** The add-on's category on the Add-ons page (see addonCategories.ts). */
  addonCategory?: string;
  pricing?: 'free' | 'paid';
  /** How it is charged (see addonCategories.ts); decides Free / Paid and the price wording. */
  pricingModel?: AddonPricingModel;
  introPriceQAR?: number;
  /** The catalogue's own wording for a price that is not a plain QAR amount (TBC, Plan-based, QR 10 after promotional period ...). */
  priceLabel?: string;
  /** The catalogue's status (Confirmed, Demo Only / TBC ...). Kept with the data; not displayed. */
  addonStatus?: string;
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
  /** 'rows': one full-width row per add-on (icon, name and description, Optional/Added tag, price). Default: a grid of cards. */
  layout?: 'cards' | 'rows';
  /**
   * Where the add-ons come from: 'catalogue' (default) the postpaid add-on products, offered by plan eligibility; 'prepaid' the add-ons
   * the prepaid pack carries (addons-discounts for `eligibilityContext.planId`), priced as a one-off charge.
   */
  source?: 'catalogue' | 'prepaid';
  /**
   * The dedicated Add-ons page: two levels of navigation - the category tabs (Local Data, Local Minutes, International, Roaming, Combo, Others) and, under
   * them, the Free / Paid filter, which applies to the category selected. Rows layout, catalogue add-ons.
   */
  categorized?: boolean;
  /**
   * The Paid / Free filter, when the page owns it (it sits in the page's top row, right-aligned, and is kept across the category tabs): the picker
   * then draws no filter of its own and starts it on Paid, every time it is shown. Omitted: the picker keeps the filter itself, under the categories.
   */
  pricing?: AddonPricing;
  onPricingChange?: (pricing: AddonPricing) => void;
}

// "Plan & Add-ons" (reference flow step 5) - optional, non-gating multi-select
// of catalogue products where type === 'Add-on', alongside the mandatory
// single-select Plan above it in ProductPlanStep.
const CHEVRON = 'M9 18l6-6-6-6';

const PHONE_ICON = 'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z M11 18h2';

export function AddonsPicker({ selectedIds, onChange, hideHeader, eligibilityContext, emptyMessage, layout = 'cards', source = 'catalogue', categorized = false, pricing: pricingProp, onPricingChange }: AddonsPickerProps) {
  const [category, setCategory] = useState<AddonCategory>(ADDON_CATEGORIES[0]);
  const [ownPricing, setOwnPricing] = useState<AddonPricing>(DEFAULT_ADDON_PRICING);
  const pricing = pricingProp ?? ownPricing;
  const setPricing = onPricingChange ?? setOwnPricing;
  // The page-owned filter opens on Paid whenever the page is loaded; switching category tabs never touches it.
  useEffect(() => {
    onPricingChange?.(DEFAULT_ADDON_PRICING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
    const load: Promise<AddonProduct[]> =
      source === 'prepaid'
        ? mockDataEngine
            .list<{ addonDiscountId: string; name: string; addonType: string; price: number; category: string; description?: string; planId?: string }>('addons-discounts')
            .then((all) =>
              all
                .filter((d) => d.category === 'Paid Add-on' && d.planId === eligibilityContext?.planId)
                .map((d) => ({ productId: d.addonDiscountId, name: d.name, type: d.addonType, mrcQAR: d.price, description: d.description }))
            )
        : mockDataEngine.list<AddonProduct>('products').then((all) => all.filter((p) => p.type === 'Add-on'));
    load
      .then((list) => {
        if (cancelled) return;
        setAllAddons(list);
        setStatus('ready');
      })
      .catch(() => !cancelled && setStatus('error'));
    return () => {
      cancelled = true;
    };
  }, [attempt, source, eligibilityContext?.planId]);

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
      <div role="alert" className="rounded-[var(--radius-card)] border border-[var(--warn)] bg-tone-warn-soft px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[var(--warn-text)] text-[length:var(--fs-body)]">Add-ons could not be loaded. You can continue without them.</p>
        <Button variant="tertiary" compact onClick={() => { setStatus('loading'); setAttempt((n) => n + 1); }}>
          Retry
        </Button>
      </div>
    );
  }
  if (addons.length === 0) {
    return status === 'ready' && emptyMessage ? (
      <EmptyState compact message={emptyMessage} />
    ) : null;
  }

  // The add-ons on screen: all of them, or - on the Add-ons page - the selected category's, narrowed by Free / Paid.
  const useTabs = categorized && layout === 'rows' && source === 'catalogue';
  const shown = useTabs ? addonsFor(addons, category, pricing) : addons;
  const perCategory = selectedPerCategory(addons, selectedIds);
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
      {useTabs && (
        <div className="space-y-3">
          {/* Level 1: the category (navigation) - the underline tabs, with how many of the chosen add-ons each holds. */}
          <TabStrip
            label="Add-On Categories"
            items={ADDON_CATEGORIES.map((c) => ({ key: c, label: c, count: perCategory[c] > 0 ? perCategory[c] : undefined }))}
            active={category}
            onChange={setCategory}
          />
          {/* Level 2: Paid / Free (a filter of the same list) - applies to the category selected above. Drawn here only when the page does not own it. */}
          {pricingProp === undefined && <SegmentedTabs label="Paid or Free Add-Ons" items={ADDON_PRICING_FILTERS} active={pricing} onChange={setPricing} />}
        </div>
      )}
      {/* Add-on cards share the plan cards' standard (shared idle / selected states, selected texture, tick).
          Multi-select: each card toggles only itself, so choosing one never clears another. */}
      <div className={layout === 'rows' ? `grid grid-cols-1 gap-3 md:grid-cols-2 ${open || hideHeader ? '' : 'hidden'}` : `grid grid-cols-[repeat(auto-fill,minmax(max(15rem,calc((100%-2rem)/3)),1fr))] gap-4 ${open || hideHeader ? '' : 'hidden'}`}>
        {shown.map((a) => {
          const selected = selectedIds.includes(a.productId);
          if (layout === 'rows') {
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
                className={`relative flex items-center gap-4 rounded-[var(--radius-card)] border p-4 cursor-pointer transition-colors focus:outline-none focus-visible:shadow-[var(--focus-ring)] ${
                  selected ? CARD_SELECTED : CARD_IDLE
                }`}
              >
                {selected && <SelectedTick />}
                <span className="flex h-12 w-12 shrink-0 items-center justify-center card text-[var(--brand-plum)] shadow-[var(--shadow-icon-tile)]">
                  <Icon path={PHONE_ICON} className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-fg font-semibold text-[length:var(--fs-body)]">
                    {a.name}
                  </p>
                  {a.description && <p className="text-fg-2 text-[length:var(--fs-caption)]">{a.description}</p>}
                </div>
                <div className="shrink-0 text-right">
                  {addonPriceDisplay(a) ? (
                    <>
                      <p className="text-fg text-[length:var(--fs-h4)] font-bold">{addonPriceDisplay(a)!.primary}</p>
                      {addonPriceDisplay(a)!.secondary && <p className="text-fg-2 text-[length:var(--fs-caption)] max-w-48 ml-auto">{addonPriceDisplay(a)!.secondary}</p>}
                    </>
                  ) : a.pricing === 'free' || (!a.pricing && a.mrcQAR === 0) ? (
                    <p className="text-fg text-[length:var(--fs-h4)] font-bold">Free</p>
                  ) : a.priceLabel && /QR\s*\d/.test(a.priceLabel) ? (
                    // Only wording that states a QAR amount ("QR 50 per additional SIM") is shown; open prices (TBC, Plan-based, Plan-dependent) are not displayed.
                    <p className="text-fg text-[length:var(--fs-body)] font-bold max-w-48">{a.priceLabel}</p>
                  ) : a.priceLabel ? null : (
                    <p className="text-fg">
                      <span className="text-[length:var(--fs-caption)]">QAR </span>
                      <span className="text-[length:var(--fs-h4)] font-bold">{formatAmount(a.mrcQAR)}</span>
                      <span className="text-fg-2 text-[length:var(--fs-caption)]">{source === 'prepaid' ? ' one-off' : ' /mo'}</span>
                    </p>
                  )}
                </div>
              </div>
            );
          }
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
                selected ? CARD_SELECTED : CARD_IDLE
              }`}
            >
              {selected && <SelectedCardTexture />}
              {selected && <SelectedTick />}
              <p className="text-fg font-bold text-[length:var(--fs-h5)] leading-snug">{a.name}</p>
              {a.description && <p className="text-fg-2 text-[length:var(--fs-caption)]">{a.description}</p>}
              <p className="text-accent mt-auto">
                <span className="text-[length:var(--fs-body)] font-semibold">QAR </span>
                <span className="text-[length:var(--fs-h3)] font-bold">{formatAmount(a.mrcQAR)}</span>
                <span className="text-fg-2 text-[length:var(--fs-caption)]">{source === 'prepaid' ? ' one-off' : ' /mo'}</span>
              </p>
            </div>
          );
        })}
      </div>
      {useTabs && shown.length === 0 && (
        <EmptyState compact message={`No ${pricing === 'free' ? 'free' : 'paid'} add-ons in ${category}.`} />
      )}
    </div>
  );
}
