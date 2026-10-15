import type { SummaryField } from '../../components/patterns/wizard/stepSummary';
import { at } from '../summaryKit';

export const cafSummary: SummaryField[] = [
  { key: 'type', label: 'CAF Type', type: 'text', value: (v) => at(v, 'caf', 'cafType') },
  { key: 'signed', label: 'Signed', type: 'toggle', value: (v) => Boolean(at(v, 'caf', 'signatureDataUrl')) },
];
