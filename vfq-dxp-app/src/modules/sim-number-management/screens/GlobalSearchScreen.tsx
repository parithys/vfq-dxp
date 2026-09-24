import { useState } from 'react';
import { Input } from '../../../components/primitives/Input';
import { Button } from '../../../components/primitives/Button';
import { NewSimSwapWizard } from './NewSimSwapWizard';
import { useEnterToSubmit } from '../../../hooks/useEnterToSubmit';

// SCR-195: Global Search - UJ-090: "Click Global Search icon -> Enter MSISDN
// and click Go -> Click SIM Swap option." The SIM Swap wizard itself has no
// separate evidenced screenId, so it's rendered inline here once "SIM Swap"
// is clicked, matching the single-screen flow described in the journey.
export function GlobalSearchScreen() {
  const [msisdn, setMsisdn] = useState('');
  const [searched, setSearched] = useState(false);
  const [swapping, setSwapping] = useState(false);

  const handleKeyDown = useEnterToSubmit(Boolean(msisdn), () => setSearched(true));

  if (swapping) {
    return (
      <div className="p-8">
        <NewSimSwapWizard msisdn={msisdn} onDone={() => setSwapping(false)} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-md">
      <h1 className="text-[length:var(--fs-h3)] font-medium text-fg mb-1">Global Search</h1>
      <p className="text-fg-2 mb-6">Search for a customer by MSISDN.</p>
      <div className="flex gap-2" onKeyDown={handleKeyDown}>
        <Input aria-label="Enter MSISDN" placeholder="Enter MSISDN" value={msisdn} onChange={(e) => { setMsisdn(e.target.value); setSearched(false); }} />
        <Button variant="primary-rect" onClick={() => setSearched(true)} disabled={!msisdn}>
          Go
        </Button>
      </div>
      {searched && msisdn && (
        <div className="mt-6 rounded-[var(--radius-card)] border border-border-soft bg-bg p-4">
          <p className="text-fg font-medium mb-3">{msisdn}</p>
          <Button variant="primary-rect" onClick={() => setSwapping(true)}>
            SIM Swap
          </Button>
        </div>
      )}
    </div>
  );
}
