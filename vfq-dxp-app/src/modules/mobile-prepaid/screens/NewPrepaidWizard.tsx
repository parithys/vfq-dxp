import { buildPrepaidSteps } from './prepaidSteps';
import { submitPrepaidOrder, type ConfirmedOrder } from './submitPrepaidOrder';
import { useState } from 'react';
import { GuidedActivationWizard } from '../../../components/patterns/GuidedActivationWizard';
import { ActivationCompleteScreen } from '../../../components/patterns/ActivationCompleteScreen';
import { useEntityStore } from '../../../stores/entityStore';

const WIZARD_ID = 'new-prepaid-tablet';

// SCR-190/191/192: New Prepaid Tablet - the reference walkthrough only
// evidenced Contact (ID capture), Number Selection and SIM Serial
// (guided-journeys-prepaid-open-ui-tablet-new-prepaid-0202dd13, confidence:
// medium). The steps below extend that reference flow with every remaining
// capability the Mobile Prepaid Activation BRSD (VFQ_Mobile_Prepaid_Activation
// _BRSD_V0.1.xlsx) and its 38-node process flow describe for this journey,
// per the 2026-09-11 forensic gap analysis and its 2026-09-11 P1 follow-up
// (which closed customer/account creation, eligibility screening, and
// payment gating). Full step-to-requirement map:
//   Contact          -> MPRA_001_KYC_01
//   Eligibility       -> MPRA_001_ECC_01/02 (BR-113 blacklist, BR-347/BR-003 line cap)
//   Address & Contact -> MPRA_001_CAM_05 (reuses ZsbAddressStep, non-blocking per FLD-523-526)
//   Plan & Discount   -> MPRA_001_QPC_01-04
//   Number Selection  -> MPRA_001_NUM_01
//   SIM Type          -> MPRA_001_SIM_01 (Physical/eSIM - see SimTypeStep for why
//                        "Printed eSIM"/"Virtual eSIM" aren't modelled as distinct options)
//   Checkout          -> MPRA_001_CVC_01-03 (BR-011 starter pack charge, BR-348/BR-013 SIM card charge)
//   CAF & Key Info    -> MPRA_001_CAF_01-03 (BR-009 Key Information, reuses CafSignatureCapture)
//   Payment           -> MPRA_001_PAY_01/02 (BR-014 submission precondition)
// onSubmit then covers: MPRA_001_CAM_01 (account creation), MPRA_001_PAY_03
// (physical SIM inventory depletion), MPRA_001_ORD_01/02 + BR-004 (HRN
// customers route to approval via the new "New Prepaid Activation"
// approval-matrix entry, same mechanism as postpaid's BR-268), MPRA_001_NET_02-06
// (a simulated fulfilment delay progressing the order from Open to Complete
// - this app's status model previously jumped straight to a terminal state
// with none of the intermediate states ever reachable), and MPRA_001_NOT_01
// (an osb-notifications record, not just a toast).
//
// Deliberately NOT built here, and why: MPRA_001_JSM_01's Qnomy queue
// ticketing has zero implementation anywhere else in this app (no journey
// creates a Q-ticket), so building it only for prepaid would be a fabricated
// one-off, not a real reused capability. DF-01's Tracking Record entity is
// the same systemic gap. INT-04 email verification is likewise unimplemented
// for every journey, including postpaid, so email is captured/displayed but
// not "verified" here either, for consistency. The BRSD's "Recipient List:
// all active MSISDNs on the QID" for the activation notification isn't
// modelled - this schema has no cross-line directory to resolve that from,
// so the notification below targets only the just-activated MSISDN.
export function NewPrepaidWizard() {
  const createRecord = useEntityStore((s) => s.createRecord);
  const updateRecord = useEntityStore((s) => s.updateRecord);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null);

  if (confirmedOrder) {
    return (
      <ActivationCompleteScreen
        order={{
          orderId: confirmedOrder.orderId,
          activityId: confirmedOrder.activityId,
          pendingApproval: confirmedOrder.pendingApproval,
          customerName: confirmedOrder.customerName,
          msisdn: confirmedOrder.msisdn,
          planName: confirmedOrder.packName,
          simType: confirmedOrder.simType,
          dueTodayQar: confirmedOrder.totalQar,
        }}
      />
    );
  }

  return (
    <div className="p-8">
      <GuidedActivationWizard
        wizardId={WIZARD_ID}
        title="New Prepaid Activation (Tablet)"
        steps={buildPrepaidSteps()}
        onSubmit={async (values) => {
          setConfirmedOrder(await submitPrepaidOrder(values, { createRecord, updateRecord }));
        }}
      />
    </div>
  );
}
