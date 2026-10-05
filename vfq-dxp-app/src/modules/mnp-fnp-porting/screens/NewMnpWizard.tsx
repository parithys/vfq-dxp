import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { buildMnpSteps } from './mnpSteps';
import { getAllRoutes } from '../../../engines/configEngine';
import { GuidedActivationWizard } from '../../../components/patterns/GuidedActivationWizard';
import type { GuidedContactValue } from '../../../components/patterns/guidedContactModel';
import type { DonorDetailsValue } from '../../../components/patterns/DonorDetailsStep';
import { useEntityStore } from '../../../stores/entityStore';
import { useNotificationStore } from '../../../stores/notificationStore';

type ProcessType = 'postpaid' | 'prepaid';

// SCR-121–134 - the MNP guided wizard, entered only after SCR-120's Postpaid/
// Prepaid choice gate (MnpProcessChoiceScreen) sets the `type` query param -
// module-hierarchy.json: "MNP guided process presents Postpaid/Prepaid
// choice before data entry." Both variants share this one wizard component
// rather than forking into two, since VAL-332–335's Donor Details fields are
// explicitly evidenced as shared across "Postpaid/Prepaid MNP journeys."
//
// Postpaid (UJ-069 "MNP Postpaid Port-In (Desktop, Ooredoo to Vodafone),"
// high confidence): Contact -> Address -> Billing -> SIM Serial -> Plan (Bill
// Limit) -> Donor Details -> Donor Attachment -> CAF -> Activity -> Submit.
//
// Prepaid (UJ-010 "MNP Prepaid," module-hierarchy's "MNP prepaid port-in
// (tablet)"): Contact -> Address -> SIM Serial -> Plan (prepaid pack +
// discount, VAL-337) -> Donor Details -> Donor Attachment -> CAF (BR-233
// balance-forfeiture declaration + module-hierarchy's "CAF form dynamically
// binds Qatari ID/Passport number field for prepaid subscribers") -> Activity.
// No Billing/Bill Limit step - prepaid carries no credit limit or bill cycle,
// same reasoning NewPrepaidWizard already applies (BR-002/BR-005).
//
// UJ-069 itself (a Consumer/HRN case) ends with Status Pending, not
// auto-completed like a direct activation, since a real port request depends
// on the donor operator's response - unchanged for both variants below.
//
// Postpaid B2B2C orders additionally route to manager approval, generalizing
// UJ-081/UJ-082 the same way the Fixed Line and FWA wizards already do - no
// MNP-specific "B2B2C With Approval" journey is evidenced, but the Contact
// step's B2B2C checkbox is itself evidenced here (guided-journeys-mnp-postpaid-
// open-ui-tablet-mnp-postpaid-hrn-10ba9743 shows a "Company Name/B2B2C" field
// on this exact step). No B2B2C concept is evidenced for MNP prepaid, so the
// prepaid path ignores isB2B2C rather than inventing an approval route for it.
export function NewMnpWizard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const createRecord = useEntityStore((s) => s.createRecord);
  const pushToast = useNotificationStore((s) => s.pushToast);

  const rawType = params.get('type');
  const processType: ProcessType | undefined = rawType === 'postpaid' || rawType === 'prepaid' ? rawType : undefined;

  useEffect(() => {
    if (processType) return;
    const choiceRoute = getAllRoutes().find((r) => r.screenId === 'SCR-120');
    navigate(choiceRoute?.path ?? '/mnp-fnp-porting', { replace: true });
  }, [processType, navigate]);

  if (!processType) return null;

  const isPrepaid = processType === 'prepaid';

  const steps = buildMnpSteps(isPrepaid);

  return (
    <div className="p-8">
      <GuidedActivationWizard
        wizardId={`new-mnp-${processType}`}
        title={isPrepaid ? 'MNP Prepaid Port-In' : 'MNP Postpaid Port-In'}
        steps={steps}
        onSubmit={async (values) => {
          const contact = values.contact as GuidedContactValue;
          const donorDetails = values.donorDetails as DonorDetailsValue;
          const orderId = `ORD-${Date.now().toString().slice(-6)}`;
          const isB2B2C = !isPrepaid && contact.isB2B2C;

          await createRecord('orders', {
            orderId,
            orderType: isPrepaid ? 'MNP Prepaid Port-In' : 'MNP Postpaid Port-In',
            orderSubType: isB2B2C ? 'B2B2C' : 'Port-In',
            // B2B2C orders route to manager approval per the generalized UJ-081/UJ-082
            // pattern (see file-level comment) - every other case, prepaid included,
            // keeps UJ-069's evidenced Pending status (a real port request awaits the
            // donor operator regardless of approval).
            status: isB2B2C ? 'Submitted for Approval' : 'Pending',
            customerName: contact.moiResult?.name,
            productId: values.productId,
            ...(isPrepaid ? { discountId: values.discountId } : { billLimitQAR: values.billLimit }),
            simSerial: values.simSerial,
            createdBy: 'AGENT-HEMANTHKUMAR',
            sourceChannel: 'Desktop',
          });
          await createRecord('mnp-portin-orders', {
            portInOrderId: `MNP-${Date.now().toString().slice(-6)}`,
            orderId,
            portInNumber: donorDetails.portInNumber,
            donorId: donorDetails.donorId,
            donorIdType: donorDetails.donorIdType,
            donorOperator: 'Ooredoo Qatar',
            status: 'Pending',
          });
          pushToast(
            'success',
            isB2B2C
              ? `MNP Port-In order ${orderId} submitted for manager approval (B2B2C) - porting ${donorDetails.portInNumber} from Ooredoo Qatar.`
              : `MNP ${isPrepaid ? 'Prepaid' : 'Postpaid'} Port-In order ${orderId} submitted - porting ${donorDetails.portInNumber} from Ooredoo Qatar (Status: Pending).`
          );
          navigate('/mnp-fnp-porting');
        }}
      />
    </div>
  );
}
