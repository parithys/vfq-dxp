import { Icon } from '../primitives/Icon';
import { Button } from '../primitives/Button';
import { ConnectionTypeTag } from '../primitives/ConnectionTypeTag';
import { CARD_HIGHLIGHT, CARD_IDLE, CARD_SELECTED, ICON_CALL, ICON_CARD, ICON_DATA, ICON_GIFT, STAR_ICON, planFeatureRows } from '../primitives/offerCardParts';
import type { PostpaidPlan } from './postpaidPlanModel';
import { formatQar, formatAmount } from '../../lib/format';

interface PostpaidPlanCardProps {
  p: PostpaidPlan;
  selectedProductId: string | undefined;
  billLimit: number | undefined;
  onSelectProduct: (productId: string) => void;
  onDeselectProduct?: () => void;
  setDetailPlan: (plan: PostpaidPlan) => void;
}

export function PostpaidPlanCard({ p, selectedProductId, billLimit, onSelectProduct, onDeselectProduct, setDetailPlan }: PostpaidPlanCardProps) {
      const selected = selectedProductId === p.productId;
      // Card per plan: name, price, bill limit, one Select button.
      // The full allowance table, benefits and contract term live in
      // the details drawer ("View details", which stops propagation
      // so opening it never selects the plan), so the cards stay
      // comparable at a glance.
      // The limit shown is what the Bill Limit editor will start at
      // for this plan (its MRC), or the agent's own figure once this
      // plan is the selected one.
      // Whole card selects; clicking it again unselects.
      const toggle = () => (selected && onDeselectProduct ? onDeselectProduct() : onSelectProduct(p.productId));
      const shownLimit = selected ? billLimit ?? p.mrcQAR : p.mrcQAR;
  return (
    <div
      key={p.productId}
      id={`plan-card-${p.productId}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          toggle();
        }
      }}
      className={`relative flex flex-col gap-3 rounded-[var(--radius-card)] border p-5 cursor-pointer transition-colors focus:outline-none focus-visible:shadow-[var(--focus-ring)] ${
        selected ? CARD_SELECTED : p.popular ? CARD_HIGHLIGHT : CARD_IDLE
      }`}
    >
      {/* Same card as Recommended offers: the flag (hidden, not removed, when absent so
          titles line up) on the left, the service on the right. */}
      <div className="flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-accent text-on-dark px-2.5 py-0.5 text-[length:var(--fs-tag)] font-medium ${p.popular ? '' : 'invisible'}`}
          aria-hidden={!p.popular}
        >
          <Icon path={STAR_ICON} className="w-3 h-3" />
          Popular
        </span>
        <ConnectionTypeTag category="Postpaid" />
      </div>
      <div className="flex-1 flex flex-col gap-2">
        <p className="text-fg font-bold text-[length:var(--fs-h5)] leading-snug">{p.name}</p>
        <p className="text-accent pt-1">
          <span className="text-[length:var(--fs-body)] font-semibold">QAR </span>
          <span className="text-[length:var(--fs-h3)] font-bold">{formatAmount(p.mrcQAR)}</span>
          <span className="text-fg-2 text-[length:var(--fs-caption)]"> /month</span>
        </p>
        {p.promoMonths && <p className="text-fg-2 text-[length:var(--fs-caption)] -mt-1">for {p.promoMonths} months</p>}
        <ul className="space-y-1.5">
          {[...(p.features?.length ? p.features.map((f, i) => ({ icon: i === 0 ? ICON_DATA : /minute|call/i.test(f) ? ICON_CALL : ICON_CARD, text: f })) : planFeatureRows(p)), { icon: ICON_CARD, text: `Bill limit: ${formatQar(shownLimit)}` }].map((f) => (
            <li key={f.text} className="flex items-center gap-2 text-fg-2 text-[length:var(--fs-caption)]">
              <Icon path={f.icon} className="w-4 h-4 shrink-0 text-accent" />
              {f.text}
            </li>
          ))}
        </ul>
        {/* What the plan includes free: one prominent block, so the agent can confirm it with the customer. */}
        {p.features?.length && p.benefits?.length ? (
          <div className="border-t border-[var(--field-card-border)] pt-4 mt-auto space-y-1.5">
            <p className="text-fg font-bold text-[length:var(--fs-caption)] uppercase tracking-wide">Included in This Offer</p>
            <ul className="space-y-1">
              {p.benefits.map((b) => (
                <li key={b} className="flex items-start gap-2 text-fg font-medium text-[length:var(--fs-caption)]">
                  <Icon path={ICON_GIFT} className="w-4 h-4 shrink-0 text-accent mt-0.5" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {/* Pre-bundled eligible offer (2026-09-28) - stated on the
            card itself, since choosing one skips straight to
            Number Selection with no further chance to review
            add-ons/discount for THIS plan. */}
        {p.preBundledOffer && (
          <p className="text-[length:var(--fs-caption)] text-accent">
            Pre-bundled offer - selecting this skips add-ons/discount and goes straight to Number Selection.
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDetailPlan(p);
          }}
          aria-label={`View details for ${p.name}`}
          className="inline-flex items-center gap-1 rounded-[var(--radius-button)] text-link hover:underline focus:outline-none focus-visible:shadow-[var(--focus-ring)] text-[length:var(--fs-caption)] font-medium"
        >
          View details
          <Icon path="M9 18l6-6-6-6" className="w-4 h-4" />
        </button>
        {/* Presentational: the card is the control, so this must not take focus or fire a second toggle. */}
        <Button variant={selected ? 'primary' : 'secondary'} tabIndex={-1} aria-hidden className="pointer-events-none">
          {selected ? 'Selected' : 'Select plan'}
        </Button>
      </div>
    </div>
  );
}
