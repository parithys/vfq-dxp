// "Waive Off" on Number Selection: the agent waives all (Full) or half (Partial) of the Star number's upfront charge - the amount of the number's
// value above the plan's entitlement. One definition, read by Number Selection, Checkout, Payment and the order, so they quote the same figures.

export type NumberWaiver = 'partial' | 'full';

/** What Partial Waive Off takes off the upfront charge. */
export const PARTIAL_WAIVER_RATE = 0.5;

export const NUMBER_WAIVER_OPTIONS: { key: NumberWaiver; label: string; description: string }[] = [
  { key: 'partial', label: 'Partial Waive Off', description: `Waives ${PARTIAL_WAIVER_RATE * 100}% of the Star number's upfront charge.` },
  { key: 'full', label: 'Full Waive Off', description: "Waives the whole of the Star number's upfront charge." },
];

export const numberWaiverLabel = (w: NumberWaiver): string => NUMBER_WAIVER_OPTIONS.find((o) => o.key === w)!.label;

/** Whether a value read from a draft is a waiver mode (anything else is no waiver). */
export const isNumberWaiver = (v: unknown): v is NumberWaiver => v === 'partial' || v === 'full';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The amount waived off an upfront charge: nothing without a waiver or a charge, all of it when Full, the partial share otherwise. */
export function waivedQar(chargeQar: number, waiver: NumberWaiver | undefined): number {
  if (!waiver || chargeQar <= 0) return 0;
  return waiver === 'full' ? chargeQar : round2(chargeQar * PARTIAL_WAIVER_RATE);
}

/** What is still payable of the charge after the waiver. */
export const chargeAfterWaiverQar = (chargeQar: number, waiver: NumberWaiver | undefined): number => round2(chargeQar - waivedQar(chargeQar, waiver));
