import { useEffect, useState } from 'react';
import * as mockDataEngine from '../../../engines/mockDataEngine';
import { useCustomerContext } from '../../../stores/customerContextStore';
import {
  ActivationComplete,
  DRAFT_ORDERS_PATH,
  GuidedActivationWizard,
  JourneyCustomerBadge,
  POST_EXIT_DESTINATION,
  useCustomerBenefits,
  useJourneySession,
} from '../../../capabilities';
import type { ConfirmedOrder } from '../../../capabilities';
import { detectDeviceType } from '../../../lib/deviceType';
import type { Product } from '../../new-connection/newConnectionModel';
import { preToPostSteps } from './preToPostSteps';
import { submitPreToPostOrder } from './submitPreToPostOrder';

const WIZARD_ID = 'pre-to-post-manual';

// SCR-177: Postpaid - Contact wizard step (Pre-to-Post) - UJ-086 manual conversion (agent-initiated, not
// system-recommended): "enter prepaid number, confirm identity -> Plan step (manually search/apply postpaid promotion) ->
// CAF auto-generated bilingual form, e-signature -> Sales Order created (Plan Change/Pre2Post)."
// It runs on the same shared steps and journey session as New Mobile Postpaid (see preToPostSteps.tsx), so the identity
// eligibility checks, the customer lock, the customer-facing CAF and the Activation Complete page behave identically.
export function NewPreToPostWizard() {
  const { navigate, createRecord, confirmedOrder, setConfirmedOrder, isMirrorWindow, draftCustomerId, heldByAnotherJourney, guardedContactChange } =
    useJourneySession<ConfirmedOrder>({ wizardId: WIZARD_ID, flow: 'new' });
  const customerBenefits = useCustomerBenefits(draftCustomerId);
  const [device] = useState(detectDeviceType);
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    void mockDataEngine.list<Product>('products').then(setProducts);
  }, []);

  if (heldByAnotherJourney && !isMirrorWindow) return null; // redirecting to the journey that holds the customer
  if (confirmedOrder) return <ActivationComplete order={confirmedOrder} service={confirmedOrder.service} showActivityId={!isMirrorWindow} />;

  return (
    <div className="min-h-full flex flex-col" data-device={device}>
      <GuidedActivationWizard
        wizardId={WIZARD_ID}
        allowCustomerView={device === 'web'}
        title="Prepaid to Postpaid Conversion"
        draftActionLabel="Prepaid to Postpaid Conversion"
        titleAside={<JourneyCustomerBadge wizardId={WIZARD_ID} />}
        onAbandon={() => navigate(POST_EXIT_DESTINATION)}
        hideAbandonFrom="payment"
        onSaveExit={() => navigate(DRAFT_ORDERS_PATH)}
        steps={preToPostSteps({ flow: 'new', existingCustomerId: undefined, guardedContactChange, products, customerBenefits })}
        onSubmit={async (values) => {
          const confirmed = await submitPreToPostOrder(values, { createRecord });
          setConfirmedOrder(confirmed);
          // Kept with the customer context so the Activity Final page returns until Close Activity.
          useCustomerContext.getState().patchJourney(WIZARD_ID, { finalOrder: confirmed as unknown as Record<string, unknown> });
        }}
      />
    </div>
  );
}
