import * as mockDataEngine from '../../../engines/mockDataEngine';
import { logActivity } from '../../../engines/activityEngine';
import type { IdLookupValue } from '../../../components/patterns/idLookupModel';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import type { SimTypeValue } from '../../../components/domain/SimTypeStep';
import type { PrepaidCheckoutTotals } from '../../../components/patterns/PrepaidCheckoutStep';
import type { CafValue } from '../../../components/patterns/wizardSteps';
import type { useEntityStore } from '../../../stores/entityStore';

interface AccountRecord {
  accountId: string;
  customerId: string;
  accountType: string;
}

export interface ConfirmedOrder {
  orderId: string;
  activityId?: string;
  pendingApproval: boolean;
  customerName: string;
  msisdn: string;
  packName: string;
  totalQar: number;
  simType?: string;
  status: string;
}

type EntityStore = ReturnType<typeof useEntityStore.getState>;

/**
 * Everything that happens when a New Prepaid Activation is submitted: find-or-create the prepaid account,
 * deplete SIM stock, write the order (HRN customers route to approval), simulate fulfilment, record the
 * SMS notification and the activity. Returns what the confirmation screen shows. The requirement behind
 * each step (MPRA_001_*) is noted inline.
 */
export async function submitPrepaidOrder(
  values: Record<string, unknown>,
  { createRecord, updateRecord }: Pick<EntityStore, 'createRecord' | 'updateRecord'>
): Promise<ConfirmedOrder> {
      const contact = values.contact as IdLookupValue | undefined;
      const eligibility = values.eligibility as EligibilityResult | undefined;
      const simType = values.simType as SimTypeValue | undefined;
      const checkoutTotals = values.checkoutTotals as PrepaidCheckoutTotals | undefined;
      const customerId = eligibility?.customerId;

      // MPRA_001_CAM_01: find-or-create the prepaid account for this
      // customer. No billingProfileId/credit-limit field is set -
      // MPRA_001_CAM_02/BR-002/BR-005 require Prepaid Activation to
      // leave credit limit and bill cycle unpopulated.
      let accountId: string | undefined;
      if (customerId) {
        const [accounts, customerRecord] = await Promise.all([
          mockDataEngine.list<AccountRecord>('accounts'),
          mockDataEngine.get<{ activePrepaidLines?: number }>('customers', customerId),
        ]);
        const existing = accounts.find((a) => a.customerId === customerId && a.accountType === 'Consumer Mobile Prepaid');
        if (existing) {
          accountId = existing.accountId;
        } else {
          accountId = `ACC-${Date.now().toString().slice(-6)}`;
          await createRecord('accounts', {
            accountId,
            customerId,
            accountType: 'Consumer Mobile Prepaid',
            status: 'Active',
          });
        }
        // Without this, the BR-347 line cap tested by CUST-1005/1002
        // would never actually tighten after a successful order - the
        // cap would only ever reflect seed data, not real usage.
        await updateRecord('customers', 'customerId', customerId, {
          activePrepaidLines: (customerRecord?.activePrepaidLines ?? 0) + 1,
        });
      }

      // MPRA_001_PAY_03: physical SIM stock is depleted on payment
      // completion. eSIM issuance has no backing inventory record to
      // deplete (see SimTypeStep) - nothing fabricated for that path.
      if (simType?.simType === 'Physical' && simType.simSerial) {
        await updateRecord('sims', 'simSerial', simType.simSerial, { stockStatus: 'Issued' });
      }

      // BR-004/BR-268-equivalent: HRN customers route to approval rather
      // than auto-completing, same mechanism already established for
      // postpaid - see the new "New Prepaid Activation" approval-matrix entry.
      const pendingApproval = Boolean(eligibility?.requiresHrnAdvance);
      const orderId = `ORD-${Date.now().toString().slice(-6)}`;
      const totalQar = checkoutTotals?.totalDueQar ?? 0;

      await createRecord('orders', {
        orderId,
        orderType: 'New Prepaid Activation',
        orderSubType: pendingApproval ? 'HRN' : 'Consumer',
        status: pendingApproval ? 'Submitted for Approval' : 'Open',
        customerId,
        accountId,
        customerName: contact?.moiResult?.name,
        productId: values.productId,
        discountId: values.discountId,
        msisdn: values.msisdn,
        numberPriceQAR: checkoutTotals?.numberPriceQar ?? 0,
        starterPackChargeQAR: checkoutTotals?.starterPackChargeQar ?? 0,
        simCardChargeQAR: checkoutTotals?.simCardChargeQar ?? 0,
        totalQAR: totalQar,
        simType: simType?.simType,
        simSerial: simType?.simSerial,
        cafType: (values.caf as CafValue | undefined)?.cafType,
        createdBy: 'AGENT-VINODHINIR',
        sourceChannel: 'Tablet',
      });

      let finalStatus = pendingApproval ? 'Submitted for Approval' : 'Open';
      if (!pendingApproval) {
        // MPRA_001_NET_02-06: simulated downstream fulfilment (service
        // creation, charging-system account, plan/benefit activation,
        // outcome sync to CRM order status) - the first place in this
        // codebase an order actually progresses through an intermediate
        // status rather than jumping straight to a terminal one.
        await new Promise((r) => setTimeout(r, 900));
        await updateRecord('orders', 'orderId', orderId, { status: 'Complete' });
        finalStatus = 'Complete';
      }

      // MPRA_001_NOT_01 - a real notification record, not just a toast.
      // Only the just-activated MSISDN is notified; see the file-level
      // comment for why "all active MSISDNs on the QID" isn't modelled.
      await createRecord('osb-notifications', {
        messageId: `MSG-${Date.now().toString().slice(-6)}`,
        orderId,
        dbTimestamp: new Date().toISOString(),
        server: 'OSB-PRD-NODE1',
        state: 'COMPLETED',
        node: 'Node1',
        pipeline: 'PS_VFQA_Communication_Pipeline',
        stage: 'SendSMS',
        inboundService: 'PS_VFQA_Communication',
        operation: 'CreateCommunication',
        smsText: pendingApproval
          ? `Dear customer, your prepaid activation order ${orderId} has been submitted and is pending manager approval.`
          : `Dear customer, your prepaid activation order ${orderId} is complete. Welcome to Vodafone Qatar prepaid - MSISDN ${values.msisdn}.`,
      });

      const products = await mockDataEngine.list<{ productId: string; name: string }>('products');
      const pack = products.find((p) => p.productId === values.productId);

      const activityId = await logActivity({
        trigger: 'completed',
        journey: 'New Prepaid Activation',
        orderId,
        customerName: contact?.moiResult?.name,
        reason: pendingApproval ? `Order ${orderId} submitted and is awaiting approval.` : `Order ${orderId} submitted and activated.`,
      });

      return {
        orderId,
        activityId,
        pendingApproval,
        customerName: contact?.moiResult?.name ?? '-',
        msisdn: (values.msisdn as string) ?? '-',
        packName: pack?.name ?? 'SIM only',
        totalQar,
        simType: simType?.simType,
        status: finalStatus,
      };
}
