import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../../components/primitives/Button';
import { Modal } from '../../../components/primitives/Modal';
import { CARD_SELECTABLE } from './stepStyles';
import { SERVICE_JOURNEYS, continuesHere } from './serviceJourneys';

/**
 * Footer for the Offers step: "Skip" (take no offer, go on to the standard
 * catalogue) before the ordinary Continue. Skip records the decline and only
 * THEN advances - from an effect, so the wizard has recomputed its steps from
 * the new values (declining re-opens the Service step that an accepted offer
 * had skipped) before it moves.
 */
export function SkipAndContinue({
  onSkip,
  goNext,
  defaultButton,
}: {
  onSkip: () => void;
  goNext: () => void;
  defaultButton: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!pending) return;
    setPending(false);
    goNext();
  }, [pending, goNext]);
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="secondary-rect"
        onClick={() => {
          onSkip();
          setPending(true);
        }}
      >
        Skip
      </Button>
      {defaultButton}
    </div>
  );
}

/**
 * Offers-step footer (2026-10-01): Reject / Interested / Accept in place of
 * Skip / Continue.
 *  - Accept: continue with the selected offer (enabled only once a valid offer
 *    is selected).
 *  - Reject: same as the old Skip - no offer, on to the standard catalogue.
 *  - Interested: the customer wants the offer but not now - the caller creates
 *    a lead for it, confirms it in a "Lead Created" modal and takes the agent
 *    to the Leads page (the journey ends here).
 * Reject and Interested change the draft values first and move on a render
 * later (see SkipAndContinue for why goNext must wait for that re-render).
 */
/** The journeys offered when the agent skips the cross-sell offer. */
// Order: Postpaid, Prepaid, Fixed Line.
const NEXT_JOURNEYS = (['new-postpaid', 'new-prepaid', 'new-fixed-line'] as const)
  .map((k) => SERVICE_JOURNEYS.find((j) => j.key === k)!)
  .map((j) => ({
  ...j,
  label: j.key === 'new-postpaid' ? 'Postpaid' : j.key === 'new-prepaid' ? 'Prepaid' : 'Fixed Line',
}));

export function OfferDecisionActions({
  canAccept,
  canExpressInterest,
  onReject,
  onInterested,
  goNext,
  onHandOff,
}: {
  canAccept: boolean;
  canExpressInterest: boolean;
  onReject: () => void;
  onInterested: () => Promise<void>;
  goNext: () => void;
  /** Leaves for another journey's own wizard (Prepaid, Fixed Line). */
  onHandOff: (route: string) => void;
}) {
  const [pending, setPending] = useState(false);
  // Skip no longer assumes Postpaid: the agent says which journey comes next.
  const [chooseJourney, setChooseJourney] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!pending) return;
    setPending(false);
    goNext();
  }, [pending, goNext]);
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="secondary-rect"
        disabled={busy}
        onClick={() => setChooseJourney(true)}
      >
        Skip
      </Button>
      <Modal
        open={chooseJourney}
        onClose={() => setChooseJourney(false)}
        title="Select the next journey"
        footer={
          <Button variant="ghost-rect" onClick={() => setChooseJourney(false)}>
            Cancel
          </Button>
        }
      >
        <p className="text-fg-2 text-[length:var(--fs-body)] mb-4">No offer will be taken. Which journey should this customer continue in?</p>
        <div className="grid gap-3">
          {NEXT_JOURNEYS.map((j) => (
            <button
              key={j.key}
              type="button"
              onClick={() => {
                setChooseJourney(false);
                if (continuesHere(j.key)) {
                  // Postpaid continues in this wizard: decline the offer, on to the plan step.
                  onReject();
                  setPending(true);
                } else if (j.route) {
                  onHandOff(j.route);
                }
              }}
              className={`${CARD_SELECTABLE} text-left border-[var(--field-card-border)] bg-bg hover:border-[var(--field-card-hover-border)] hover:bg-[var(--field-card-hover-bg)] transition-colors focus:outline-none focus-visible:shadow-[var(--focus-ring)]`}
            >
              <span className="block text-fg font-medium text-[length:var(--fs-body)]">{j.label}</span>
              <span className="block text-fg-2 text-[length:var(--fs-caption)]">{j.description}</span>
            </button>
          ))}
        </div>
      </Modal>
      <Button
        variant="secondary-rect"
        disabled={!canExpressInterest || busy}
        onClick={async () => {
          setBusy(true);
          try {
            // The caller shows the "Lead Created" confirmation and then leaves for
            // the Leads page, so there is no goNext here.
            await onInterested();
          } finally {
            setBusy(false);
          }
        }}
      >
        Interested
      </Button>
      <Button variant="primary-rect" disabled={!canAccept || busy} onClick={goNext}>
        Accept
      </Button>
    </div>
  );
}
