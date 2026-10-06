import type { GuidedContactValue } from '../../../components/patterns/guidedContactModel';
import { crossSalesSummary } from './stepSummaries';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import type { WizardStep } from '../../../components/patterns/wizard/guidedWizardTypes';
import { useNotificationStore } from '../../../stores/notificationStore';
import { useAuthStore } from '../../../stores/authStore';
import { CrossSalesStep } from './CrossSalesStep';
import { isCrossSalesValid } from './crossSalesModel';
import type { CrossSalesValue } from './crossSalesModel';
import { NewJourneyButtons } from './JourneyActions';
import { journeyLabel } from './serviceJourneys';
import type { NewConnectionStepContext } from './stepContext';

export function offersStep({ applyCrossSales, navigate, createRecord }: NewConnectionStepContext): WizardStep {
  return {
    key: 'crossSales',
    summary: crossSalesSummary,
    label: 'Offers',
    heading: 'Recommended offers',
    subheading: 'Personalised using the customer\u2019s profile and eligibility.',
    render: ({ values, setValue, goNext }) => (
      <CrossSalesStep
        customerId={(values.eligibility as EligibilityResult | undefined)?.customerId}
        value={(values.crossSales as CrossSalesValue) ?? {}}
        onChange={(v) => applyCrossSales(setValue, v)}
        onHandOff={(route) => navigate(route)}
        onContinue={goNext}
        onInterestedOffer={async (offer) => {
          const contact = values.contact as GuidedContactValue | undefined;
          const leadId = `LEAD-${Date.now().toString().slice(-6)}`;
          await createRecord('leads', {
            leadId,
            serviceNeeded: journeyLabel(offer.serviceJourney) ?? 'Mobile',
            status: 'New',
            ownerId: useAuthStore.getState().profile?.userId ?? null,
            createdVia: 'New Connection - Cross Sales Offer',
            offerId: offer.offerId,
            offerName: offer.offerName,
            customerId: (values.eligibility as EligibilityResult | undefined)?.customerId,
            mobileNumber: contact?.moiResult?.phone,
          });
          useNotificationStore.getState().pushToast('success', `Lead ${leadId} has been created`, { key: `lead-${leadId}` });
        }}
      />
    ),
    isValid: (values) => isCrossSalesValid(values.crossSales as CrossSalesValue | undefined),
    // The footer starts a journey: New Postpaid takes no offer and goes on here; the others leave for their own wizard.
    // Each offer card carries its own Interested (lead) and Select Offer buttons.
    primaryAction: ({ setValue, goNext }) => (
      <NewJourneyButtons onDecline={() => applyCrossSales(setValue, { decision: 'declined' })} goNext={goNext} onHandOff={(route) => navigate(route)} />
    ),
  };
}
