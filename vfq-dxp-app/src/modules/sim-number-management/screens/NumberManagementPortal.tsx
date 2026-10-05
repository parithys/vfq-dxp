import { useState } from 'react';
import { MsisdnPicker } from '../../../components/domain/MsisdnPicker';
import { PageHeader } from '../../../components/patterns/PageHeader';

// SCR-024: Number Management Portal - "search experience needs to be
// defined" per screens.md; the only evidenced field-level behaviour is the
// Free/Paid number category toggle, matching Pattern 10 (Number Selection/
// Reservation Step) already built for the activation wizards. Presented here
// as its own standalone portal rather than a wizard step.
export function NumberManagementPortal() {
  const [selected, setSelected] = useState<string | undefined>();

  return (
    <div className="p-8 w-full">
      <PageHeader title={<>Number Management Portal</>} description={<>Search and reserve fixed/mobile numbers.</>} />
      <MsisdnPicker selected={selected} onSelect={(msisdn) => setSelected(msisdn)} />
    </div>
  );
}
