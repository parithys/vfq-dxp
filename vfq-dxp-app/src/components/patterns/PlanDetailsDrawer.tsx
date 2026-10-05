import { Drawer } from '../primitives/Drawer';
import { Icon } from '../primitives/Icon';
import { CHECK } from './postpaidPlanModel';
import type { PostpaidPlan } from './postpaidPlanModel';

interface PlanDetailsDrawerProps {
  detailPlan: PostpaidPlan | null;
  onClose: () => void;
}

/* Plan details, on demand. A drawer rather than a modal: it is reference
    material read while choosing, so it slides in beside the list instead
    of covering it and forcing a dismissal to compare the next tier.
    
    Everything in it is real catalogue data. commitmentMonths in
    particular is on every seeded plan and was displayed nowhere - the
    cards show data/voice/speed only, so the contract term the customer is
    signing up to was the one figure an agent could not see. */
export function PlanDetailsDrawer({ detailPlan, onClose }: PlanDetailsDrawerProps) {
  return (
  <Drawer
    open={detailPlan !== null}
    onClose={onClose}
    title={detailPlan?.name ?? 'Plan details'}
  >
    {detailPlan && (
      <dl className="divide-y divide-border-soft">
        {[
          ['Monthly charge', `QAR ${detailPlan.mrcQAR}/mo`],
          ['Data', detailPlan.dataAllowanceGB ? `${detailPlan.dataAllowanceGB} GB` : 'Unlimited'],
          ['Voice', detailPlan.minutesAllowance],
          ['Speed', detailPlan.speedTier],
          [
            'Commitment',
            detailPlan.commitmentMonths ? `${detailPlan.commitmentMonths} months` : 'No commitment',
          ],
          ['Product code', detailPlan.productId],
        ].map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-fg-2 text-[length:var(--fs-caption)]">{label}</dt>
            <dd className="text-fg font-medium text-right">{value}</dd>
          </div>
        ))}
      </dl>
    )}
    {/* Benefits are a LIST, not a single label/value pair, so they sit
        below the dl rather than inside it (2026-09-28). */}
    {detailPlan?.benefits && detailPlan.benefits.length > 0 && (
      <div className="pt-3">
        <p className="text-fg-2 text-[length:var(--fs-caption)] mb-1.5">Included benefits</p>
        <ul className="space-y-1">
          {detailPlan.benefits.map((b) => (
            <li key={b} className="flex items-start gap-1.5 text-[length:var(--fs-body)] text-fg">
              <Icon path={CHECK} className="w-4 h-4 text-success shrink-0 mt-0.5" />
              {b}
            </li>
          ))}
        </ul>
      </div>
    )}
  </Drawer>
  );
}
