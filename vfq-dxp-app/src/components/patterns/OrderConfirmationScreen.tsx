import type { ReactNode } from 'react';
import { Icon } from '../primitives/Icon';
import { Button } from '../primitives/Button';

const CHECK = 'M20 6L9 17l-5-5';

export interface ConfirmationSummaryLine {
  label: string;
  value: string;
}

export interface ConfirmationAction {
  label: string;
  onClick: () => void;
  variant?: 'primary-rect' | 'ghost-rect';
}

interface OrderConfirmationScreenProps {
  heading: string;
  orderId: string;
  summaryLines: ConfirmationSummaryLine[];
  nextSteps: string[];
  actions: ConfirmationAction[];
  /**
   * Optional block between the summary and "What happens next", for anything
   * the customer has to act on before leaving the counter - currently the
   * eSIM QR panel. A slot rather than an eSIM-shaped prop, because this
   * screen is shared with the prepaid wizard and shouldn't know what a
   * postpaid order happens to need handed over.
   */
  handoverPanel?: ReactNode;
}

// Dedicated post-submit confirmation experience - replaces a toast-only
// completion signal for milestone/transaction outcomes. A toast is a
// transient, easily-missed strip; an order confirmation is exactly the kind
// of "important milestone" that needs a persistent screen with the result,
// the details that back it up, what happens next, and clear navigation -
// not something the agent has to catch before it fades.
export function OrderConfirmationScreen({
  heading,
  orderId,
  summaryLines,
  nextSteps,
  actions,
  handoverPanel,
}: OrderConfirmationScreenProps) {
  return (
    <div className="max-w-2xl mx-auto text-center py-8">
      <div className="w-16 h-16 rounded-full bg-success text-white flex items-center justify-center mx-auto mb-6">
        <Icon path={CHECK} className="w-8 h-8" />
      </div>
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-2">{heading}</h1>
      <p className="text-fg-2 mb-8">
        Order <span className="font-medium text-fg">{orderId}</span>
      </p>

      <dl className="text-left rounded-[var(--radius-card)] border border-border-soft bg-bg p-5 mb-6">
        {summaryLines.map((line) => (
          <div key={line.label} className="flex justify-between py-2 border-b border-border-soft last:border-0">
            <dt className="text-fg-2">{line.label}</dt>
            <dd className="text-fg font-medium">{line.value}</dd>
          </div>
        ))}
      </dl>

      {handoverPanel && <div className="text-left mb-6">{handoverPanel}</div>}

      {nextSteps.length > 0 && (
        <div className="text-left rounded-[var(--radius-card)] border border-border-soft bg-surface p-5 mb-8">
          <p className="text-fg font-medium mb-2">What happens next</p>
          <ul className="list-disc list-inside space-y-1 text-fg-2 text-[length:var(--fs-body)]">
            {nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        {actions.map((action) => (
          <Button key={action.label} variant={action.variant ?? 'ghost-rect'} onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
