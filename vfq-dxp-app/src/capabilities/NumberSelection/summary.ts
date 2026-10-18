import type { SummaryField } from '../../components/patterns/wizard/stepSummary';
import { at, qar } from '../summaryKit';

/** The chosen number and, when the journey records one, its price (stored under `priceField`). */
export const numberSummary = (priceField: string | undefined = 'numberPriceQAR'): SummaryField[] => [
  { key: 'msisdn', label: 'Mobile Number', type: 'text', value: (v) => at(v, 'msisdn') ?? (at(v, 'prePaired') === true ? 'Pre-Paired SIM' : undefined) },
  ...(priceField ? [{ key: 'price', label: 'Number Price', type: 'text' as const, optional: true, value: (v: Record<string, unknown>) => qar(at(v, priceField)) }] : []),
];
