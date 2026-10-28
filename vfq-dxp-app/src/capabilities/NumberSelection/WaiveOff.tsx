import { useState } from 'react';
import { Button } from '../../components/primitives/Button';
import { Input } from '../../components/primitives/Input';
import { Modal } from '../../components/primitives/Modal';
import { chargeAfterWaiverQar, waivedQar, waiverAmountProblem, type NumberWaiver } from '../../engines/numberWaiver';
import { formatQar } from '../../engines/postpaidPricing';

/**
 * The "Waive Off" action beside Continue on Number Selection: the agent enters a FIXED AMOUNT (QAR) to waive off the Star number's upfront charge - not a
 * percentage. The amount is kept on the journey (`numberWaiver`) and read by Checkout, Payment and the order. Shown only when the chosen number has an
 * upfront charge to waive.
 */
export function WaiveOff({ chargeQar, numberChosen = false, waiver, onChange }: { chargeQar: number; /** A number is chosen: the button then shows even when it has no charge (disabled, saying why). */ numberChosen?: boolean; waiver: NumberWaiver | undefined; onChange: (w: NumberWaiver | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  if (chargeQar <= 0) {
    return numberChosen ? (
      <Button variant="secondary" disabled title="This number has no upfront charge to waive off.">
        Waive Off
      </Button>
    ) : null;
  }
  const amount = text.trim() === '' ? undefined : Number(text.replace(/,/g, ''));
  const problem = waiverAmountProblem(amount, chargeQar);
  const openDialog = () => {
    setText(waiver ? String(waiver) : '');
    setOpen(true);
  };
  return (
    <>
      <Button variant="secondary" onClick={openDialog}>
        {waiver ? `Waive Off: ${formatQar(waiver)}` : 'Waive Off'}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Waive Off"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div>
              {waiver && (
                <Button
                  variant="tertiary"
                  onClick={() => {
                    onChange(undefined);
                    setOpen(false);
                  }}
                >
                  Remove Waive Off
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={Boolean(problem)}
                onClick={() => {
                  if (amount !== undefined) onChange(waivedQar(chargeQar, amount));
                  setOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        }
      >
        <p className="text-fg-2 text-[length:var(--fs-body)]">
          The Star number's upfront charge is <strong className="text-fg">{formatQar(chargeQar)}</strong>. Enter the amount to waive off; the order is sent for approval. Its supporting document is asked for at the end of the journey, after the CAF is signed.
        </p>
        <div className="mt-4 space-y-3">
          <Input
            label="Waive Off Amount (QAR)"
            required
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[^0-9.,]/g, ''))}
            error={text.trim() !== '' ? problem : undefined}
          />
          <dl className="grid max-w-xs grid-cols-2 text-[length:var(--fs-caption)] [&>*]:border-t [&>*]:border-border-soft [&>*]:py-1">
            <dt className="text-fg-2">Upfront Charge</dt>
            <dd className="text-right font-semibold text-fg">{formatQar(chargeQar)}</dd>
            <dt className="text-fg-2">Waived</dt>
            <dd className="text-right font-semibold text-fg">{formatQar(problem ? 0 : waivedQar(chargeQar, amount))}</dd>
            <dt className="text-fg-2">Payable</dt>
            <dd className="text-right font-semibold text-fg">{formatQar(problem ? chargeQar : chargeAfterWaiverQar(chargeQar, amount))}</dd>
          </dl>
        </div>
      </Modal>
    </>
  );
}
