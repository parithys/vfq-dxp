import { GuidedActivationWizard } from '../../../components/patterns/wizard/GuidedActivationWizard';
import { ActivationCompleteScreen } from '../../../components/patterns/ActivationCompleteScreen';
import { DemoFaultPanel } from '../../../components/patterns/DemoFaultPanel';
import { useCustomerContext } from '../../../stores/customerContextStore';
import { billingAccountStep } from '../../new-connection/steps/billingAccountStep';
import { checkoutStep } from '../../new-connection/steps/checkoutStep';
import { paymentStep } from '../../new-connection/steps/paymentStep';
import { useFixedActivationJourney } from './useFixedActivationJourney';
import { submitFixedActivationOrder } from './submitFixedActivationOrder';
import { fixedContactStep, fixedAddressStep, fixedPlanStep, fixedNumberStep, fixedAppointmentStep, fixedCafStep } from './fixedSteps';
import { FIXED_DRAFT_ORDERS_PATH, FIXED_POST_EXIT, FIXED_WIZARD_ID } from './fixedActivationModel';

// Fixed Activation Journey (CBU). Step order follows the agreed Fixed screen designs; the capabilities (scan + MOI,
// eligibility, billing profile, checkout, CAF + signature, WinCash payment, order submitted, running Summary panel,
// Save & Exit, Abandon Order, approval routing) are the New Connection ones, imported - not copied - so the two
// journeys cannot drift, and New Connection itself is untouched.
export function FixedActivationWizard() {
  const { navigate, createRecord, confirmedOrder, setConfirmedOrder, isMirrorWindow, draftStep, active, heldByAnotherJourney, guardedContactChange } =
    useFixedActivationJourney();

  if (heldByAnotherJourney && !isMirrorWindow) return null; // redirecting to the journey that holds the customer
  // The customer-view pop-up shows the order, never the internal activity ID.
  if (confirmedOrder) return (
      <ActivationCompleteScreen order={isMirrorWindow ? { ...confirmedOrder, activityId: undefined } : confirmedOrder} numberLabel="Fixed Line Number" hideSimType />
    );

  return (
    <div className="min-h-full flex flex-col">
      <GuidedActivationWizard
        belowPanel={(draftStep ?? 0) === 0 && !isMirrorWindow ? <DemoFaultPanel /> : undefined}
        wizardId={FIXED_WIZARD_ID}
        allowCustomerView
        title="Fixed Activation"
        draftActionLabel="Fixed Activation"
        titleAside={
          active?.wizardId === FIXED_WIZARD_ID ? (
            <span className="text-[length:var(--fs-body)] text-fg-2" title="The customer is fixed for this journey">
              <span className="font-medium text-fg">{active.customerName}</span> - QID {active.idNumber}
            </span>
          ) : undefined
        }
        onAbandon={() => navigate(FIXED_POST_EXIT)}
        hideAbandonFrom="payment"
        onSaveExit={() => navigate(FIXED_DRAFT_ORDERS_PATH)}
        steps={[
          fixedContactStep(guardedContactChange),
          fixedAddressStep(),
          billingAccountStep(),
          fixedPlanStep(),
          fixedNumberStep(),
          checkoutStep(),
          fixedCafStep(),
          paymentStep(),
          fixedAppointmentStep(),
        ]}
        onSubmit={async (values) => {
          const confirmed = await submitFixedActivationOrder(values, { createRecord });
          setConfirmedOrder(confirmed);
          useCustomerContext.getState().patchJourney(FIXED_WIZARD_ID, { finalOrder: confirmed as unknown as Record<string, unknown> });
        }}
      />
    </div>
  );
}
