import { GuidedActivationWizard } from '../../components/patterns/wizard/GuidedActivationWizard';
import { ActivationCompleteScreen } from '../../components/patterns/ActivationCompleteScreen';
import { useCustomerContext } from '../../stores/customerContextStore';
import { Modal } from '../../components/primitives/Modal';
import { DemoFaultPanel } from '../../components/patterns/DemoFaultPanel';
import { Button } from '../../components/primitives/Button';
import { POST_EXIT_DESTINATION, DRAFT_ORDERS_PATH } from './newConnectionModel';
import type { NewConnectionFlow } from './newConnectionModel';
import { submitNewConnectionOrder } from './submitNewConnectionOrder';
import { useNewConnectionJourney } from './hooks/useNewConnectionJourney';
import { contactStep } from './steps/contactStep';
import { offersStep } from './steps/offersStep';
import { planStep } from './steps/planStep';
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
    createdLead,
    setCreatedLead,
    goToLeads,
    products,
    applyCrossSales,
  } = useNewConnectionJourney(flow);
  const stepContext = {
    flow,
    existingCustomerId,
    guardedContactChange,
    applyCrossSales,
    navigate,
    createRecord,
    setCreatedLead,
    customerBenefits,
    products,
  };

  if (heldByAnotherJourney && !isMirrorWindow) return null; // redirecting to the journey that holds the customer

  if (confirmedOrder) {
    return <ActivationCompleteScreen order={confirmedOrder} />;
  }

  return (
    <div>
      <GuidedActivationWizard
        wizardId={WIZARD_ID}
        allowCustomerView
        title={flow === 'existing' ? 'New Connection - Existing Customer' : 'New Connection - New Customer'}
        draftActionLabel="Postpaid Activation"
        titleAside={
          active?.wizardId === WIZARD_ID ? (
            <span className="text-[length:var(--fs-body)] text-fg-2" title="The customer is fixed for this journey">
              <span className="font-medium text-fg">{active.customerName}</span> - QID {active.idNumber}
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
      {/* Demo-only failure simulator: outside the wizard card, and only on Customer Identification,
          where the lookups it affects run. */}
      {(draftStep ?? 0) === 0 && !isMirrorWindow && (
        <div className="mt-6 px-8 pb-8">
          <DemoFaultPanel />
        </div>
      )}
      <Modal
        open={createdLead !== null}
        onClose={() => setCreatedLead(null)}
        title="Lead Created"
        footer={
          <>
            <Button variant="ghost-rect" onClick={() => setCreatedLead(null)}>
              Close
            </Button>
            <Button variant="primary-rect" onClick={goToLeads}>
              Go to Leads
            </Button>
          </>
        }
      >
        <p className="text-fg-2 text-[length:var(--fs-body)]">
          Lead <strong className="font-bold">{createdLead?.leadId}</strong> has been created
          {createdLead?.offerName ? ` for ${createdLead.offerName}` : ''}.
        </p>
      </Modal>
    </div>
  );
}
