import { useState } from 'react';
import { Button } from '../primitives/Button';
import { Drawer } from '../primitives/Drawer';
import { Input } from '../primitives/Input';
import { Select } from '../primitives/Select';
import { BILL_MEDIA_OPTIONS, BILLING_SCHEDULE_OPTIONS } from './billingAccountModel';
import type { NewBillingAccountValue } from './billingAccountModel';

// "Billing Profile Setup" (2026-09-28 screenshot) - a short secondary
// disclosure for the three fields that name and route the profile itself,
// kept out of the main form so that form reads as "who/where/how they pay"
// and this reads as "what the profile itself is called and how it behaves."
// Drawer, not Modal, per Modal.tsx's own reservation ("short confirmation
// messages only") - this is a small form, which is exactly what Drawer.tsx
// says it exists for instead.
export function BillingProfileSetupDrawer({
  open,
  onClose,
  value,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  value: NewBillingAccountValue;
  onSave: (patch: Pick<NewBillingAccountValue, 'profileName' | 'billMedia' | 'billingSchedule'>) => void;
}) {
  const [profileName, setProfileName] = useState(value.profileName ?? '');
  const [billMedia, setBillMedia] = useState(value.billMedia ?? 'Email');
  const [billingSchedule, setBillingSchedule] = useState(value.billingSchedule ?? 'Immediate');

  return (
    <Drawer open={open} onClose={onClose} title="Billing Profile Setup">
      <div className="space-y-4">
        <Input
          label="Billing Profile Name"
          required
          placeholder="e.g. My Account"
          value={profileName}
          onChange={(e) => setProfileName(e.target.value)}
        />
        <Select
          label="Bill Media"
          value={billMedia}
          onChange={(e) => setBillMedia(e.target.value)}
          options={BILL_MEDIA_OPTIONS}
        />
        <Select
          label="Billing Schedule"
          value={billingSchedule}
          onChange={(e) => setBillingSchedule(e.target.value)}
          options={BILLING_SCHEDULE_OPTIONS}
        />
        <Button
          variant="primary-rect"
          disabled={!profileName.trim()}
          onClick={() => {
            onSave({ profileName: profileName.trim(), billMedia, billingSchedule });
            onClose();
          }}
        >
          Save
        </Button>
      </div>
    </Drawer>
  );
}
