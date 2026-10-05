import { WinCashPaymentStep } from '../../../components/patterns/WinCashPaymentStep';
import type { WinCashPaymentValue } from '../../../components/patterns/WinCashPaymentStep';
import type { CheckoutTotals } from '../../../components/patterns/checkoutSummaryModel';
import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';

export function paymentStep(): WizardStep {
  return {
    key: 'payment',
    label: 'Payment',
    render: ({ values, setValue }) => {
      // Reads the SAME figure Checkout already computed and read back
      // to the customer (values.checkoutTotals, published by its
      // onTotalsComputed) rather than re-deriving it from the
      // number's raw sticker price - that second derivation is what
      // used to skip BR-115's entitlement/overage logic entirely,
      // since it never had the selected plan's MRC to apply it with.
      const checkoutTotals = values.checkoutTotals as CheckoutTotals | undefined;
      const dueTodayQar = checkoutTotals?.dueTodayQar ?? 0;
      return (
        <WinCashPaymentStep
          amountDueQAR={dueTodayQar}
          value={(values.payment as WinCashPaymentValue) ?? {}}
          onChange={(v) => setValue('payment', v)}
        />
      );
    },
    isValid: (values) => Boolean((values.payment as WinCashPaymentValue | undefined)?.paid),
    // "On successful WinCash confirmation, return to DXP, submit the
    // order, and create the interaction activity" (2026-09-28) - the
    // Return moment (WinCashPaymentStep setting `paid: true`) submits
    // immediately rather than waiting for a separate Continue click,
    // since Payment is the wizard's last step and Continue here would
    // only ever mean "submit" anyway.
    autoAdvanceWhen: (values) => Boolean((values.payment as WinCashPaymentValue | undefined)?.paid),
  };
}
