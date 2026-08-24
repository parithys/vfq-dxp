import { useState } from 'react';
import { MsisdnPicker } from '../../../components/domain/MsisdnPicker';

// SCR-024: Number Management Portal — "search experience needs to be
// defined" per screens.md; the only evidenced field-level behaviour is the
// Free/Paid number category toggle, matching Pattern 10 (Number Selection/
// Reservation Step) already built for the activation wizards. Presented here
// as its own standalone portal rather than a wizard step.
export function NumberManagementPortal() {
  const [selected, setSelected] = useState<string | undefined>();

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-1">Number Management Portal</h1>
      <p className="text-fg-2 mb-6">Search and reserve fixed/mobile numbers.</p>
      <MsisdnPicker selected={selected} onSelect={(msisdn) => setSelected(msisdn)} />
    </div>
  );
}
