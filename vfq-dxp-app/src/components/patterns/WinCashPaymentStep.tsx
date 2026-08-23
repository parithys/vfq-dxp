import { useState } from 'react';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';

export interface WinCashPaymentValue {
  paid?: boolean;
  reference?: string;
}

interface WinCashPaymentStepProps {
  amountDueQAR: number;
  value: WinCashPaymentValue;
  onChange: (value: WinCashPaymentValue) => void;
}

// Payment step (New Postpaid wizard) — evidenced as WinCash stock
// check/reservation + signature pad + WinCash payment (business-workshop-day5-session-2-postpaid-service,
// UJ-042). FLD-634/635 (Reason dropdown for FREE-type sales, Generate CAF
// button triggering "Validating Order, please wait...") — this step models the
// WinCash payment leg specifically; CAF generation is the next wizard step.
export function WinCashPaymentStep({ amountDueQAR, value, onChange }: WinCashPaymentStepProps) {
  const [processing, setProcessing] = useState(false);

  const process = async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 500));
    setProcessing(false);
    onChange({ paid: true, reference: `WC-${Date.now().toString().slice(-8)}` });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-card)] border border-border-soft p-4 bg-surface">
        <div className="flex justify-between text-fg">
          <span>Amount Due (WinCash)</span>
          <span className="font-medium">QR {amountDueQAR}</span>
        </div>
      </div>
      {value.paid ? (
        <div className="flex items-center gap-2">
          <Badge variant="success">Paid</Badge>
          <span className="text-[length:var(--fs-caption)] text-muted">Reference: {value.reference}</span>
        </div>
      ) : (
        <Button variant="primary-rect" onClick={process} disabled={processing}>
          {processing ? 'Processing via WinCash…' : 'Process Payment via WinCash'}
        </Button>
      )}
    </div>
  );
}
