import { useEffect, useState } from 'react';
import * as mockDataEngine from '../../engines/mockDataEngine';
import { GuidedActivationWizard } from '../../components/patterns/wizard/GuidedActivationWizard';
import { ActivationCompleteScreen } from '../../components/patterns/ActivationCompleteScreen';
import { useCustomerContext } from '../../stores/customerContextStore';
import { DemoFaultPanel } from '../../components/patterns/DemoFaultPanel';
import { POST_EXIT_DESTINATION, DRAFT_ORDERS_PATH } from './newConnectionModel';
import type { NewConnectionFlow } from './newConnectionModel';
import { submitNewConnectionOrder } from './submitNewConnectionOrder';
import { useNewConnectionJourney } from './hooks/useNewConnectionJourney';
import { contactStep } from './steps/contactStep';
import { offersStep } from './steps/offersStep';
import { planStep, planExtrasStep } from './steps/planStep';
import { addressStep } from './steps/addressStep';
import { billingAccountStep } from './steps/billingAccountStep';
import { numberStep } from './steps/numberStep';
import { simTypeStep } from './steps/simTypeStep';
import { checkoutStep } from './steps/checkoutStep';
import { cafStep } from './steps/cafStep';
import { paymentStep } from './steps/paymentStep';

// New Connection: the end-to-end activation journey - Customer Identification
// and Eligibility, special customer type, cross-sales offers with the standard
// catalogue as fallback, Plan & Add-ons, then the regular fulfilment sequence
// through to Payment. New Postpaid is fulfilled in this wizard; the other
// service journeys continue in their own existing wizards (see steps/).
export function NewConnectionWizard({ flow = 'new' }: { flow?: NewConnectionFlow }) {
  const {
    navigate,
    existingCustomerId,
    WIZARD_ID,
    createRecord,
    confirmedOrder,
    setConfirmedOrder,
    isMirrorWindow,
    draftStep,
    active,
    heldByAnotherJourney,
    guardedContactChange,
    customerBenefits,
    products,
    applyCrossSales,
  } = useNewConnectionJourney(flow);
  // Existing Customer: the route names the customer, so their name sits under the title from the start.
  const [routeCustomerName, setRouteCustomerName] = useState<string | undefined>();
  useEffect(() => {
    if (flow !== 'existing' || !existingCustomerId) return;
    let cancelled = false;
    void mockDataEngine.list<{ customerId: string; name: string }>('customers').then((all) => {
      if (!cancelled) setRouteCustomerName(all.find((c) => c.customerId === existingCustomerId)?.name);
    });
    return () => {
      cancelled = true;
    };
  }, [flow, existingCustomerId]);
  const stepContext = {
    flow,
    existingCustomerId,
    guardedContactChange,
    applyCrossSales,
    navigate,
    createRecord,
    customerBenefits,
    products,
  };

  if (heldByAnotherJourney && !isMirrorWindow) return null; // redirecting to the journey that holds the customer

  if (confirmedOrder) {
    return <ActivationCompleteScreen order={confirmedOrder} />;
  }

  return (
    <div className="min-h-full flex flex-col">
      <GuidedActivationWizard
        belowPanel={(draftStep ?? 0) === 0 && !isMirrorWindow ? <DemoFaultPanel /> : undefined}
        wizardId={WIZARD_ID}
        allowCustomerView
        title={flow === 'existing' ? 'New Connection' : 'New Connection - New Customer'}
        draftActionLabel="Postpaid Activation"
        titleAside={
          active?.wizardId === WIZARD_ID ? (
            <span className="text-[length:var(--fs-body)] text-fg-2" title="The customer is fixed for this journey">
              <span className="font-medium text-fg">{active.customerName}</span> - QID {active.idNumber}
            </span>
          ) : flow === 'existing' && routeCustomerName ? (
            <span className="text-[length:var(--fs-body)] font-medium text-fg" title="The customer is fixed for this journey">
              {routeCustomerName}
            </span>
          ) : undefined
        }
        onAbandon={() => navigate(POST_EXIT_DESTINATION)}
        hideAbandonFrom="payment"
        onSaveExit={() => navigate(DRAFT_ORDERS_PATH)}
        steps={[
          contactStep(stepContext),
          offersStep(stepContext),
          planStep(stepContext),
          planExtrasStep(stepContext),
          addressStep(),
          billingAccountStep(),
          numberStep(stepContext),
          simTypeStep(),
          checkoutStep(),
          cafStep(),
          paymentStep(),
        ]}
        onSubmit={async (values) => {
          const confirmed = await submitNewConnectionOrder(values, { flow, createRecord });
          setConfirmedOrder(confirmed);
          // Kept with the customer context so the Activity Final page returns until Close Activity.
          useCustomerContext.getState().patchJourney(WIZARD_ID, { finalOrder: confirmed as unknown as Record<string, unknown> });
        }}
      />
    </div>
  );
}
