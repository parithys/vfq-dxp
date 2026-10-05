import { useRef, useState } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { useCustomerVerificationStore } from '../../stores/customerVerificationStore';
import { Drawer } from '../primitives/Drawer';
import { Input } from '../primitives/Input';
import { Button } from '../primitives/Button';
import { ErrorBanner } from '../primitives/ErrorBanner';
import { QidImageUpload } from '../domain/QidImageUpload';
import { type QidImageUploadValue } from '../domain/qidImageUploadModel';
import { useEnterToSubmit } from '../../hooks/useEnterToSubmit';

interface VerificationGateProps {
  customerId: string;
  customerName: string;
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
}

// CUS-001-KYC-02/03 / BR-01: re-confirms the identified customer's identity
// before any demographic/contact/address/billing maintenance proceeds - both
// by scanning the ID (front/back, same QidImageUpload pattern as the
// Passport-to-QID wizard) and matching the ID number against that specific
// customer's identity-documents record, not a generic MOI lookup. Once
// verified, useCustomerVerificationStore never un-verifies - matches
// Annex_02's Unverified -> Verified, no transition out of Verified.
export function VerificationGate({ customerId, customerName, open, onClose, onVerified }: VerificationGateProps) {
  const verifyCustomer = useCustomerVerificationStore((s) => s.verifyCustomer);
  const [idNumber, setIdNumber] = useState('');
  const [scan, setScan] = useState<QidImageUploadValue>({});
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const scanComplete = Boolean(scan.frontScanned && scan.backScanned);

  const runVerification = async () => {
    if (!idNumber.trim() || !scanComplete) return;
    setChecking(true);
    setError(undefined);
    const docs = await mockDataEngine.list<{ customerId: string; documentNumber: string }>('identity-documents');
    const match = docs.find((d) => d.customerId === customerId && d.documentNumber === idNumber.trim());
    setChecking(false);
    if (!match) {
      setError('This ID number does not match any document on file for this customer. Try again.');
      return;
    }
    verifyCustomer(customerId);
    setIdNumber('');
    setScan({});
    onVerified();
  };

  const handleKeyDown = useEnterToSubmit(Boolean(idNumber.trim()) && scanComplete && !checking, runVerification);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Verify Customer Identity"
      footer={
        <>
          <Button variant="ghost-rect" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary-rect" disabled={!idNumber.trim() || !scanComplete || checking} onClick={runVerification}>
            {checking ? 'Verifying…' : 'Verify & Continue'}
          </Button>
        </>
      }
    >
      <div className="space-y-4" onKeyDown={handleKeyDown}>
        <p className="text-fg-2 text-[length:var(--fs-body)]">
          {customerName}'s identity must be verified before any demographic, contact, address, or billing
          maintenance action can proceed.
        </p>
        <QidImageUpload value={scan} onChange={setScan} />
        <Input
          label="ID Number on file"
          placeholder="Enter QID / Passport / GCC ID / Diplomatic ID number"
          value={idNumber}
          onChange={(e) => {
            setIdNumber(e.target.value);
            setError(undefined);
          }}
        />
        <ErrorBanner message={error} />
      </div>
    </Drawer>
  );
}

/** Shared gate hook - call requireVerification(action) at any edit-entry
 * point; action runs immediately if already verified this session,
 * otherwise the gate drawer opens and action runs once verification
 * succeeds. Render `gate` once per screen. */
export function useVerificationGate(customerId: string, customerName: string) {
  const isVerified = useCustomerVerificationStore((s) => s.isVerified(customerId));
  const [open, setOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const requireVerification = (action: () => void) => {
    if (isVerified) {
      action();
      return;
    }
    pendingActionRef.current = action;
    setOpen(true);
  };

  const gate = (
    <VerificationGate
      customerId={customerId}
      customerName={customerName}
      open={open}
      onClose={() => setOpen(false)}
      onVerified={() => {
        setOpen(false);
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        action?.();
      }}
    />
  );

  return { isVerified, requireVerification, gate };
}
