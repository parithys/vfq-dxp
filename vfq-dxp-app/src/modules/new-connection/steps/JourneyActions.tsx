import { useEffect, useState } from 'react';
import { Button } from '../../../components/primitives/Button';
import { SERVICE_JOURNEYS } from './serviceJourneys';
import type { ServiceJourney } from './serviceJourneys';

// The journeys the agent can start from the Offers step, left to right, ending with the primary action. Postpaid continues in this wizard; the
// others leave for their own wizard. "New Fixed Line" is the fixed-line (home broadband) journey.
const JOURNEY_BUTTONS: { label: string; journey: ServiceJourney }[] = [
  { label: 'New Fixed Line', journey: 'new-fixed-line' },
  { label: 'New MNP', journey: 'mnp-postpaid' },
  { label: 'New Prepaid', journey: 'new-prepaid' },
  { label: 'New Postpaid', journey: 'new-postpaid' },
];

/**
 * Offers-step footer: one button per journey instead of Skip / Interested / Accept (the offer cards carry their own
 * Interested and Select Offer buttons).
 *  - New Postpaid: no offer is taken; record the decline and go on to Plan & Add-ons. The decline changes the draft
 *    values first and the step moves a render later, so the wizard has recomputed its steps (declining re-opens the
 *    plan step an accepted offer would have skipped) before it advances.
 *  - The others leave for that journey's own wizard.
 */
export function NewJourneyButtons({
  onDecline,
  goNext,
  onHandOff,
}: {
  onDecline: () => void;
  goNext: () => void;
  onHandOff: (route: string) => void;
}) {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!pending) return;
    setPending(false);
    goNext();
  }, [pending, goNext]);
  return (
    <div className="flex items-center gap-3">
      {JOURNEY_BUTTONS.map(({ label, journey }) => {
        const route = SERVICE_JOURNEYS.find((j) => j.key === journey)?.route;
        const postpaid = journey === 'new-postpaid';
        return (
          <Button
            key={journey}
            variant={postpaid ? 'primary-rect' : 'secondary-rect'}
            onClick={() => {
              if (postpaid) {
                onDecline();
                setPending(true);
              } else if (route) {
                onHandOff(route);
              }
            }}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
