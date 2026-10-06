import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useJourneyCustomerLock } from '../../new-connection/hooks/useJourneyCustomerLock';
import { useCustomerContext } from '../../../stores/customerContextStore';
import { useEntityStore } from '../../../stores/entityStore';
import { useWorkflowStore } from '../../../stores/workflowStore';
import type { GuidedContactValue } from '../../../components/patterns/guidedContactModel';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import type { ConfirmedOrder } from '../../new-connection/newConnectionModel';
import { FIXED_WIZARD_ID } from './fixedActivationModel';

// The Fixed Activation journey's state: its own wizard id (so its draft and customer hold never mix with New
// Connection's), the customer lock - reused as-is, entered as a fresh-customer journey - and the confirmed order.
export function useFixedActivationJourney() {
  const navigate = useNavigate();
  const location = useLocation();
  const createRecord = useEntityStore((s) => s.createRecord);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(() => {
    const a = useCustomerContext.getState().journey;
    return a?.wizardId === FIXED_WIZARD_ID && a.finalOrder ? (a.finalOrder as unknown as ConfirmedOrder) : null;
  });
  const isMirrorWindow = new URLSearchParams(location.search).get('mirror') === '1';
  const draftValues = useWorkflowStore((s) => s.drafts[FIXED_WIZARD_ID]?.values);
  const draftStep = useWorkflowStore((s) => s.drafts[FIXED_WIZARD_ID]?.currentStep);
  const draftContact = draftValues?.contact as GuidedContactValue | undefined;
  const draftCustomerId = (draftValues?.eligibility as EligibilityResult | undefined)?.customerId;
  const { active, heldByAnotherJourney, guardedContactChange } = useJourneyCustomerLock({
    flow: 'new',
    wizardId: FIXED_WIZARD_ID,
    existingCustomerId: undefined,
    isMirrorWindow,
    draftContact,
    draftCustomerId,
    draftStep,
  });
  return { navigate, createRecord, confirmedOrder, setConfirmedOrder, isMirrorWindow, draftStep, active, heldByAnotherJourney, guardedContactChange };
}
