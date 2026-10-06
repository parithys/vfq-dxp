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
  variant?: 'primary-rect' | 'secondary-rect';
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
  handoverPanel,
}: OrderConfirmationScreenProps) {
  return (
    // TWO COLUMNS as of 2026-09-25: the outcome and its receipt on the left,
    // everything the agent has to hand over or do next on the right.
    //
    // The split is by JOB, not by length. The left column is the record of
    // what happened - read once, quoted if the customer asks. The right is
    // the work still outstanding at the counter: scan the QR, send the email,
    // know what follows. Stacked in one column, that work sat below the fold
    // on a laptop, under a summary the agent had already finished reading.
    //
    // Collapses to a single column under lg, where side-by-side would leave
    // both halves too narrow to read - the summary rows are label/value pairs
    // that need width to stay on one line.
    //
    // max-w widened from 2xl to 6xl to give the two columns room; a 2xl
    // container split in two would be narrower per column than the original
    // single column was.
    <div className="max-w-6xl mx-auto py-8">
      {/* Centred again as of 2026-09-28, on explicit direction - reverses the
          2026-09-26 left-align (which matched every other step's heading in
          this wizard). This screen is the one moment in the journey that
          isn't a step to fill in but an outcome to announce, which is the
          case for centring it rather than following the rest of the wizard.
          Still spans BOTH columns below it - it announces the outcome, which
          belongs to the whole screen rather than to the left-hand receipt. */}
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-success text-white flex items-center justify-center mb-6">
          <Icon path={CHECK} className="w-8 h-8" />
        </div>
        <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-2">{heading}</h1>
        <p className="text-fg-2 mb-8">
          Order <span className="font-medium text-fg">{orderId}</span>
          {activityId && (
            <>
              <span className="mx-2 text-muted">|</span>
              Activity <span className="font-medium text-fg">{activityId}</span>
            </>
          )}
        </p>
      </div>

      {/* TWO columns only when there is a handover panel to put in the second
          one. A physical-SIM order has no eSIM profile and therefore no QR to
          show, and the empty column it used to leave beside the receipt read
          as content that had failed to load rather than as content that does
          not exist for this order. Centred and width-capped in the one-column
          case so the receipt reads as a whole card instead of the left half of
          a layout with something missing from it. */}
      <div
        className={`grid grid-cols-1 gap-6 items-start ${
          // One column, receipt above the eSIM panel, at every width: the page then prints on one A4 sheet.
          handoverPanel ? 'max-w-3xl mx-auto' : 'max-w-xl mx-auto'
        }`}
      >
        {/* Column 1 - the receipt. */}
        <dl className="rounded-[var(--radius-card)] border border-[var(--field-card-border)] bg-bg p-5">
          {summaryLines.map((line) => (
            <div key={line.label} className="flex justify-between gap-4 py-2 border-b border-border-soft last:border-0">
              <dt className="text-fg-2">{line.label}</dt>
              <dd className="text-fg font-medium text-right">{line.value}</dd>
            </div>
          ))}
        </dl>

        {/* Column 2 - the handover. "What happens next" sat here until
            2026-09-25; with it gone this column holds only the eSIM panel,
            and space-y is kept so a future handover block stacks correctly
            rather than needing the wrapper rebuilt. */}
        {handoverPanel && <div className="space-y-6">{handoverPanel}</div>}
      </div>

      {/* Actions span both columns: they act on the order as a whole, so
          anchoring them under one column would imply otherwise. */}
      <div className="no-print print:hidden flex items-center justify-center gap-3 mt-8">
        {actions.filter((a) => !a.endRow).map((action) => (
          // secondary-rect, not ghost-rect (2026-09-28) - per Button.tsx's own
          // documented rule, ghost-rect is for the thing you press to NOT do
          // the action (Cancel/Back), while every action here (Start Another
          // Activation, Back to Dashboard, ...) is a real next step the agent
          // can take, just not the page's primary one (View Order).
          <Button key={action.label} variant={action.variant ?? 'secondary-rect'} onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
      </div>
      {/* Actions marked `endRow` (Print, Close Activity) sit on their own row below, centred under the main
          actions, in the order given. On narrow screens they stack at full width, in the same order. */}
      {actions.some((a) => a.endRow) && (
        <div className="no-print print:hidden flex flex-col gap-3 mt-4 sm:flex-row sm:justify-center [&>button]:w-full sm:[&>button]:w-auto">
          {actions.filter((a) => a.endRow).map((action) => (
            <Button key={action.label} variant={action.variant ?? 'secondary-rect'} onClick={action.onClick}>
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
