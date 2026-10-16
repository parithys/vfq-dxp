import type { ReactNode } from 'react';
import { Icon } from '../primitives/Icon';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';

const CHECK = 'M20 6L9 17l-5-5';

export interface ConfirmationSummaryLine {
  label: string;
  value: string;
}

export interface ConfirmationAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  /** Put this action on a second row below the others, right-aligned (the last such action is right-most). */
  endRow?: boolean;
}

interface OrderConfirmationScreenProps {
  heading: string;
  orderId: string;
  /** The activity this journey created automatically, when there is one. */
  activityId?: string;
  summaryLines: ConfirmationSummaryLine[];
  actions: ConfirmationAction[];
  /**
   * Optional block between the summary and "What happens next", for anything
   * the customer has to act on before leaving the counter - currently the
   * eSIM QR panel. A slot rather than an eSIM-shaped prop, because this
   * screen is shared with the prepaid wizard and shouldn't know what a
   * postpaid order happens to need handed over.
   */
  handoverPanel?: ReactNode;
  /** A short line directly under the heading (for example whether the order details were emailed). */
  headerNote?: ReactNode;
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
  activityId,
  summaryLines,
  actions,
  headerNote,
  handoverPanel,
}: OrderConfirmationScreenProps) {
  return (
    <div className="max-w-6xl mx-auto card p-6 sm:p-8">
      <div>
        <h1 className="text-[length:var(--fs-h4)] font-bold text-fg mb-6">{heading}</h1>
        <div className="w-14 h-14 rounded-[var(--radius-pill)] bg-tone-success-soft text-success flex items-center justify-center mb-6">
          <Icon path={CHECK} className="w-6 h-6" />
        </div>
        {headerNote && <div className="mb-2">{headerNote}</div>}
        <p className="text-fg-2 mb-8">
          Order <span className="font-medium text-fg">{orderId}</span>
          {activityId && (
            <>
              <span className="mx-2 text-muted">|</span>
              Activity <span className="font-medium text-accent">{activityId}</span>
            </>
          )}
        </p>
      </div>

      <div
        className={`grid grid-cols-1 gap-8 items-start ${
          handoverPanel ? 'lg:grid-cols-2' : 'max-w-xl'
        }`}
      >
        <dl>
          {summaryLines.map((line) => (
            <div key={line.label} className="flex justify-between gap-4 py-3 border-b border-border-soft last:border-0">
              <dt className="text-fg-2">{line.label}</dt>
              <dd className="text-fg font-medium text-right">
                {line.label === 'Status' && line.value === 'Complete' ? <Badge variant="success-solid">Complete</Badge> : line.value}
              </dd>
            </div>
          ))}
        </dl>

        {handoverPanel && (
          <div className="space-y-4 [&_.card]:!flex-col [&_.card]:!items-start [&_.card]:!border-0 [&_.card]:!bg-transparent [&_.card]:!p-0 [&_code]:w-full [&_code]:px-4 [&_code]:py-3 [&>div>p]:rounded-[var(--radius-button)] [&>div>p]:bg-surface [&>div>p]:px-4 [&>div>p]:py-4 [&>div>p]:!text-fg">
            <h2 className="text-fg font-bold text-[length:var(--fs-body-lg)]">QR Code</h2>
            {handoverPanel}
          </div>
        )}
      </div>

      <div className="no-print print:hidden mt-10 flex flex-wrap items-center gap-3">
        {[...actions.filter((a) => !a.endRow), ...actions.filter((a) => a.endRow)].map((action) => (
          <Button key={action.label} variant={action.label === 'Done & Exit' ? 'primary' : 'secondary'} onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
