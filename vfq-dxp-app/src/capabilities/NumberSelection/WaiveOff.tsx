import { useState } from 'react';
import { Button } from '../../components/primitives/Button';
import { Modal } from '../../components/primitives/Modal';
import { Radio } from '../../components/primitives/Radio';
import { NUMBER_WAIVER_OPTIONS, numberWaiverLabel, waivedQar, chargeAfterWaiverQar, type NumberWaiver } from '../../engines/numberWaiver';
import { formatQar } from '../../engines/postpaidPricing';

/**
 * The "Waive Off" action beside Continue on Number Selection: the agent chooses Partial or Full Waive Off of the Star number's upfront charge.
 * The choice is kept on the journey (`numberWaiver`) and read by Checkout, Payment and the order. Shown only when the chosen number has an
 * upfront charge to waive.
 */
export function WaiveOff({ chargeQar, waiver, onChange }: { chargeQar: number; waiver: NumberWaiver | undefined; onChange: (w: NumberWaiver | undefined) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<NumberWaiver | undefined>(waiver);
  if (chargeQar <= 0) return null;
  const openDialog = () => {
    setDraft(waiver);
    setOpen(true);
  };
  return (
    <>
      <Button variant="secondary" onClick={openDialog}>
        {waiver ? `Waive Off: ${waiver === 'full' ? 'Full' : 'Partial'}` : 'Waive Off'}
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
                disabled={!draft}
                onClick={() => {
                  onChange(draft);
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
          The Star number's upfront charge is <strong className="text-fg">{formatQar(chargeQar)}</strong>. Choose how much of it to waive off; the order is sent for approval.
        </p>
        <fieldset className="mt-4 space-y-3">
          <legend className="sr-only">Waive Off</legend>
          {NUMBER_WAIVER_OPTIONS.map((o) => (
            <label key={o.key} className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border border-[var(--field-card-border)] p-4 hover:border-[var(--field-hover-border)]">
              <Radio className="mt-1" name="number-waive-off" checked={draft === o.key} onChange={() => setDraft(o.key)} />
              <span className="min-w-0 flex-1">
                <span className="block text-fg font-semibold text-[length:var(--fs-body)]">{o.label}</span>
                <span className="block text-fg-2 text-[length:var(--fs-caption)]">{o.description}</span>
                <dl className="mt-2 grid max-w-xs grid-cols-2 text-[length:var(--fs-caption)] [&>*]:border-t [&>*]:border-border-soft [&>*]:py-1">
                  <dt className="text-fg-2">Waived</dt>
                  <dd className="text-right font-semibold text-fg">{formatQar(waivedQar(chargeQar, o.key))}</dd>
                  <dt className="text-fg-2">Payable</dt>
                  <dd className="text-right font-semibold text-fg">{formatQar(chargeAfterWaiverQar(chargeQar, o.key))}</dd>
                </dl>
              </span>
            </label>
          ))}
        </fieldset>
        {waiver && <p className="mt-3 text-muted text-[length:var(--fs-caption)]">Current choice: {numberWaiverLabel(waiver)}.</p>}
      </Modal>
    </>
  );
}
