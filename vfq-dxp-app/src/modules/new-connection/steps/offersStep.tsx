import type { GuidedContactValue } from '../../../components/patterns/guidedContactModel';
import { crossSalesSummary } from './stepSummaries';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';
import { useAuthStore } from '../../../stores/authStore';
import { CrossSalesStep } from './CrossSalesStep';
import { isCrossSalesValid } from './crossSalesModel';
import type { CrossSalesValue } from './crossSalesModel';
import { OfferDecisionActions } from './JourneyActions';
import { journeyLabel } from './serviceJourneys';
import type { NewConnectionStepContext } from './stepContext';

export function offersStep({ applyCrossSales, navigate, createRecord, setCreatedLead }: NewConnectionStepContext): WizardStep {
  return {
    key: 'crossSales',
    summary: crossSalesSummary,
    label: 'Offers',
    heading: 'Recommended offers',
    subheading: 'Personalised using the customer\u2019s profile and eligibility.',
    render: ({ values, setValue }) => (
      <CrossSalesStep
        customerId={(values.eligibility as EligibilityResult | undefined)?.customerId}
        value={(values.crossSales as CrossSalesValue) ?? {}}
        onChange={(v) => applyCrossSales(setValue, v)}
        onHandOff={(route) => navigate(route)}
      />
    ),
    isValid: (values) => isCrossSalesValid(values.crossSales as CrossSalesValue | undefined),
    // Reject = take no offer and go on to the standard catalogue (what Skip
    // was). Interested = create a lead for the selected offer, then the same.
    // Accept = continue with the selected offer.
    primaryAction: ({ values, setValue, goNext }) => {
      const cs = (values.crossSales as CrossSalesValue | undefined) ?? {};
      const contact = values.contact as GuidedContactValue | undefined;
      return (
        <OfferDecisionActions
          canAccept={cs.decision === 'accepted' && isCrossSalesValid(cs)}
          canExpressInterest={Boolean(cs.offerId)}
          goNext={goNext}
          onHandOff={(route) => navigate(route)}
          onReject={() => applyCrossSales(setValue, { decision: 'declined' })}
          onInterested={async () => {
            const leadId = `LEAD-${Date.now().toString().slice(-6)}`;
            await createRecord('leads', {
              leadId,
              serviceNeeded: journeyLabel(cs.journey) ?? 'Mobile',
              status: 'New',
              ownerId: useAuthStore.getState().profile?.userId ?? null,
              createdVia: 'New Connection - Cross Sales Offer',
              offerId: cs.offerId,
              offerName: cs.offerName,
              customerId: (values.eligibility as EligibilityResult | undefined)?.customerId,
              mobileNumber: contact?.moiResult?.phone,
            });
            // Confirmation modal (Go to Leads / Close - see goToLeads).
            setCreatedLead({ leadId, offerName: cs.offerName });
          }}
        />
      );
    },
  };
}
