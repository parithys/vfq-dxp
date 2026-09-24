import { useState } from 'react';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';

export interface WinCashPaymentValue {
  paid?: boolean;
  reference?: string;
  declined?: boolean;
}

interface WinCashPaymentStepProps {
  amountDueQAR: number;
  value: WinCashPaymentValue;
  onChange: (value: WinCashPaymentValue) => void;
}

// Gate 3 of the reference activation flow - WinCash/POS + inventory sync,
// evidenced as WinCash stock check/reservation + signature pad + WinCash
// payment (business-workshop-day5-session-2-postpaid-service, UJ-042).
// FLD-634/635 (Reason dropdown for FREE-type sales, Generate CAF button
// triggering "Validating Order, please wait...") - CAF generation is a prior
// wizard step now (Checkout -> CAF -> Payment, matching the reference order).
// A real POS's decline path isn't reproducible client-side, so "Simulate
// Decline" stands in for a genuinely failed authorization - Retry re-attempts
// the same amount; per the reference's exception table, Cancel is handled by
// the wizard's own Abandon Order control (top of the step panel), not
// duplicated here, so a cancelled order still releases its SIM reservation
// through the same path as any other abandoned order.
export function WinCashPaymentStep({ amountDueQAR, value, onChange }: WinCashPaymentStepProps) {
  const [processing, setProcessing] = useState(false);

  const process = async (outcome: 'success' | 'decline') => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 500));
    setProcessing(false);
    if (outcome === 'decline') {
      onChange({ paid: false, declined: true });
      return;
    }
    onChange({ paid: true, declined: false, reference: `WC-${Date.now().toString().slice(-8)}` });
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
        <div className="space-y-3">
          {value.declined && (
            <div className="rounded-[var(--radius-card)] border border-danger/30 bg-[color-mix(in_oklab,var(--danger),var(--bg)_92%)] p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="danger">Payment declined</Badge>
              </div>
              <p className="text-[length:var(--fs-caption)] text-fg">
                WinCash declined the authorization. Retry the same amount, or use Abandon Order above to cancel - abandoning releases the SIM
                reservation.
              </p>
            </div>
          )}
          <Button variant="primary-rect" onClick={() => process('success')} disabled={processing}>
            {processing ? 'Processing via WinCash…' : value.declined ? 'Retry Payment' : 'Process Payment via WinCash'}
          </Button>
          {!value.declined && (
            <button
              type="button"
              onClick={() => process('decline')}
              disabled={processing}
              className="ml-3 text-[length:var(--fs-caption)] text-muted hover:text-danger transition-colors"
            >
              Simulate decline (test)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
