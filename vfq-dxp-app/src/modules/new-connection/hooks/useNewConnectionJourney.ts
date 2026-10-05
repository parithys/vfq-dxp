import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useJourneyCustomerLock } from './useJourneyCustomerLock';
import { useCustomerContext } from '../../../stores/customerContextStore';
import { useCustomerBenefits } from './useCustomerBenefits';
import type { GuidedContactValue } from '../../../components/patterns/guidedContactModel';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import type { CrossSalesValue } from '../steps/crossSalesModel';
import * as mockDataEngine from '../../../engines/mockDataEngine';
import { useEntityStore } from '../../../stores/entityStore';
import { useWorkflowStore } from '../../../stores/workflowStore';
import { WIZARD_ID_BY_FLOW } from '../newConnectionModel';
import type { NewConnectionFlow, Product, ConfirmedOrder } from '../newConnectionModel';

// The journey's shared state and handlers: the wizard id, the customer lock, the fetched catalogue,
// the Lead Created confirmation and the cross-sales application - everything the step definitions
// and the page chrome both read. Hook order is the order the wizard component always ran them in.
export function useNewConnectionJourney(flow: NewConnectionFlow) {
  const navigate = useNavigate();
  const location = useLocation();
  const { customerId: existingCustomerId } = useParams<{ customerId: string }>();
  // The Existing flow's draft belongs to ONE customer: keyed by the customer id, so a draft left
  // by another customer's journey (same browser session) can never carry its applicant name,
  // identity or eligibility into this one.
  const WIZARD_ID = flow === 'existing' && existingCustomerId ? `${WIZARD_ID_BY_FLOW.existing}-${existingCustomerId}` : WIZARD_ID_BY_FLOW[flow];
  // Existing flow: the route names the customer the journey was started for. The
  // identification is NOT pre-filled - the agent scans again - but, as the demo
  // scanner returns the same ID for everyone, the customer IS the one named here.
  const createRecord = useEntityStore((s) => s.createRecord);
  // Reloaded or revisited after submit but before Close Activity: the Activity Final page comes back.
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(() => {
    const a = useCustomerContext.getState().journey;
    return a?.wizardId === WIZARD_ID && a.finalOrder ? (a.finalOrder as unknown as ConfirmedOrder) : null;
  });

  // ---- Active customer context -------------------------------------------------------------
  // Once the customer is identified, the journey is bound to them until it is explicitly ended
  // (Close Activity, Save & Exit, Abandon Order, session end). See customerContextStore.
  const isMirrorWindow = new URLSearchParams(location.search).get('mirror') === '1';
  const draftValues = useWorkflowStore((s) => s.drafts[WIZARD_ID]?.values);
  const draftStep = useWorkflowStore((s) => s.drafts[WIZARD_ID]?.currentStep);
  const draftContact = draftValues?.contact as GuidedContactValue | undefined;
  const draftCustomerId = (draftValues?.eligibility as EligibilityResult | undefined)?.customerId;
  const { active, heldByAnotherJourney, guardedContactChange } = useJourneyCustomerLock({
    flow,
    wizardId: WIZARD_ID,
    existingCustomerId,
    isMirrorWindow,
    draftContact,
    draftCustomerId,
    draftStep,
  });
  // Discounts follow the customer this journey is for: the route's customer, or the one the identity check resolved.
  const customerBenefits = useCustomerBenefits(flow === 'existing' ? existingCustomerId : draftCustomerId);
  // Set when the agent records an Interested outcome: shows the "Lead Created"
  // confirmation: Go to Leads leaves for the Leads page, Close just dismisses it.
  const [createdLead, setCreatedLead] = useState<{ leadId: string; offerName?: string } | null>(null);
  const goToLeads = () => {
    useWorkflowStore.getState().clearDraft(WIZARD_ID);
    useCustomerContext.getState().endJourney(WIZARD_ID);
    setCreatedLead(null);
    navigate('/leads');
  };
  // Fetched once at the wizard level (2026-09-28) rather than inside a single
  // step, so Number Selection can resolve the selected plan's MRC for BR-115's
  // star-number entitlement without re-fetching the same catalogue
  // PostpaidPlanAddonsStep already reads for itself.
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    mockDataEngine.list<Product>('products').then(setProducts);
  }, []);

  // Accepting an offer makes its journey and plan the basis for what follows;
  // anything else (declining, skipping) clears a previous acceptance.
  const applyCrossSales = (setValue: (field: string, value: unknown) => void, v: CrossSalesValue) => {
    setValue('crossSales', v);
    setValue('serviceJourney', v.decision === 'accepted' ? v.journey : undefined);
    const basis =
      v.decision === 'accepted' ? v.linkedProductIds?.find((id) => products.some((p) => p.productId === id)) : undefined;
    setValue('productId', basis);
    setValue('discountId', undefined);
    setValue('addonIds', []);
  };
  return {
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
  };
}
