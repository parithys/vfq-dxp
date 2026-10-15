import type { ComponentProps } from 'react';
import { PostpaidPlanAddonsStep } from '../../components/patterns/PostpaidPlanAddonsStep';
import { PrepaidPlanStep } from '../../components/patterns/PrepaidPlanStep';
import { ProductPlanStep } from '../../components/patterns/ProductPlanStep';

/**
 * PLAN SELECTION - the one application-wide capability for choosing the plan an order is for.
 *
 * Journeys mount THIS component (usually through planSelectionStep in wizard/wizardSteps) and say which kind of
 * plan their context sells; none of them picks between the parts itself.
 *
 *   kind 'postpaid'   postpaid plan cards with offers, add-ons, discounts and bill limit (the plan, then the
 *                     add-ons - `mode` picks which half). New Connection.
 *   kind 'prepaid'    prepaid packs with the discount choice. Prepaid activation and prepaid port-in.
 *   kind 'catalogue'  a plan from the product catalogue by type, with an optional credit check. FWA, Pre-to-Post
 *                     and postpaid port-in.
 */
export type PlanSelectionProps =
  | ({ kind: 'postpaid' } & ComponentProps<typeof PostpaidPlanAddonsStep>)
  | ({ kind: 'prepaid' } & ComponentProps<typeof PrepaidPlanStep>)
  | ({ kind: 'catalogue' } & ComponentProps<typeof ProductPlanStep>);

export function PlanSelection(props: PlanSelectionProps) {
  switch (props.kind) {
    case 'postpaid': {
      const { kind: _kind, ...rest } = props;
      return <PostpaidPlanAddonsStep {...rest} />;
    }
    case 'prepaid': {
      const { kind: _kind, ...rest } = props;
      return <PrepaidPlanStep {...rest} />;
    }
    case 'catalogue': {
      const { kind: _kind, ...rest } = props;
      return <ProductPlanStep {...rest} />;
    }
  }
}
