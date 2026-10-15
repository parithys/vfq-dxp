import { OfferDetailsDrawer } from '../../capabilities/CrossSellOffers/OfferDetailsDrawer';
import type { OfferDetails } from '../../capabilities/CrossSellOffers/OfferDetailsDrawer';
import type { PostpaidPlan } from './postpaidPlanModel';
import { ADDON_INTERNATIONAL_MINUTES, INCLUDED_INTERNATIONAL_MINUTES, POLICY_LINKS } from '../../data/planPolicy';

interface PlanDetailsDrawerProps {
  detailPlan: PostpaidPlan | null;
  onClose: () => void;
  /** With onSelectProduct: the drawer's footer button selects the plan. */
  selectedProductId?: string;
  onSelectProduct?: (productId: string) => void;
}

/* Plan details, on demand, in the same side drawer as a Recommended offer (title, summary, the plan's free extras,
   a facts panel, what is included and related documents). A drawer rather than a modal: it is reference material
   read while choosing, so it slides in beside the list instead of covering it. Everything shown is catalogue data. */
export function PlanDetailsDrawer({ detailPlan, onClose, selectedProductId, onSelectProduct }: PlanDetailsDrawerProps) {
  const p = detailPlan;
  const details: OfferDetails | null = p
    ? {
        offerName: p.name,
        offerDescription: p.features?.length
          ? p.features.join(' \u00b7 ')
          : [p.dataAllowanceGB ? `${p.dataAllowanceGB} GB data` : 'Unlimited data', p.minutesAllowance].filter(Boolean).join(' \u00b7 '),
        monthlyRental: p.mrcQAR,
        campaignCode: p.productId,
        codeLabel: 'Product code',
        status: 'Available',
        offerType: p.offer || p.popular ? 'Offer' : 'Plan',
        policy: p.fup?.length
          ? { title: 'Speed and Fair Usage Policy (FUP)', bullets: p.fup, tables: [INCLUDED_INTERNATIONAL_MINUTES, ADDON_INTERNATIONAL_MINUTES], links: POLICY_LINKS }
          : undefined,
      }
    : null;
  return (
    <OfferDetailsDrawer
      offer={details}
      serviceLabel="Postpaid"
      fixedService={false}
      highlight={p?.benefits?.[0] ? { title: p.benefits[0], subtitle: `Included with ${p.name}` } : null}
      includedNames={[...(p?.features ?? []), ...(p?.benefits ?? [])]}
      selected={Boolean(p && selectedProductId === p.productId)}
      onSelect={() => p && onSelectProduct?.(p.productId)}
      onClose={onClose}
    />
  );
}
