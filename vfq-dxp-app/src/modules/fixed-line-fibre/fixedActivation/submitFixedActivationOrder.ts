import { currentAgentId } from '../../../stores/authStore';
import { emailVerification, maskEmail, persistBillingAccount } from '../../../capabilities';
import type { GuidedContactValue } from '../../../capabilities';
import { assertEligibilityChecked } from '../../../engines/eligibilityGuard';
import type { EligibilityResult } from '../../../components/domain/eligibilityTypes';
import type { BillingAccountValue } from '../../../capabilities';
import type { CheckoutTotals } from '../../../components/patterns/checkoutSummaryModel';
import type { WinCashPaymentValue } from '../../../components/patterns/WinCashPaymentStep';
import { isFutureDated } from '../../../capabilities';
import type { AppointmentBookingValue } from '../../../capabilities';
import type { ZsbAddressValue } from '../../../components/patterns/ZsbAddressStep';
import * as mockDataEngine from '../../../engines/mockDataEngine';
import { logActivity, newActivityId } from '../../../engines/activityEngine';
import type { ActivityInput } from '../../../engines/activityEngine';
import type { useEntityStore } from '../../../stores/entityStore';
import type { CustomerTypeValue } from '../../../capabilities';
import type { ConfirmedOrder } from '../../../capabilities';
import { homeProductLabel } from '../../new-connection/products';
import type { HomeProduct } from '../../new-connection/products';
import { FIXED_JOURNEY_LABEL, serviceTypeLabel, type FixedInstallationValue } from './fixedActivationModel';

type EntityStore = ReturnType<typeof useEntityStore.getState>;

/**
 * Submits a Fixed Activation (CBU) order: writes the order and its installation appointment, records the
 * Completed activity (plus a workflow event when the order is held for approval) and builds the order-submitted
 * screen's content. Held for approval when eligibility routed it there, the identity was typed in by hand, or the
 * customer is B2B2C.
 */
export async function submitFixedActivationOrder(
  values: Record<string, unknown>,
  { createRecord }: Pick<EntityStore, 'createRecord'>
): Promise<ConfirmedOrder> {
  const contact = values.contact as GuidedContactValue;
  assertEligibilityChecked(values);
  const eligibility = values.eligibility as EligibilityResult | undefined;
  const installation = values.installation as FixedInstallationValue | undefined;
  const address = values.address as ZsbAddressValue | undefined;
  const appointment = values.appointment as AppointmentBookingValue;
  const billingAccount = values.billingAccount as BillingAccountValue | undefined;
  const payment = values.payment as WinCashPaymentValue | undefined;
  const totals = values.checkoutTotals as CheckoutTotals | undefined;
  const products = await mockDataEngine.list<{ productId: string; name: string; mrcQAR: number }>('products');
  const plan = products.find((p) => p.productId === values.productId);

  const manualIdEntry = Boolean(contact.manualEntry);
  const approvalChecks = eligibility?.checks.filter((c) => c.outcome === 'approval-routing') ?? [];
  const customerType = values.customerType as CustomerTypeValue | undefined;
  const pendingApproval = manualIdEntry || (Boolean(contact.isB2B2C) && !customerType?.rejected) || customerType?.type === 'b2b2c' || Boolean(eligibility?.requiresHrnAdvance) || approvalChecks.length > 0;

  // A customer with no billing account gets the one the journey built, created and set as their default.
  const billingProfileId = await persistBillingAccount(billingAccount, {
    createRecord,
    kind: 'Consumer Fixed Line (GigaHome)',
    customerId: eligibility?.customerId,
    idNumber: contact.idNumber,
    contactName: contact.moiResult?.name,
    contactEmail: contact.email,
    contactPhone: contact.moiResult?.phone,
    addressLine: [address?.zone && `Zone ${address.zone}`, address?.streetNo && `Street ${address.streetNo}`, address?.buildingNo && `Building ${address.buildingNo}`].filter(Boolean).join(', ') || undefined,
  });

  const orderId = `ORD-${Date.now().toString().slice(-6)}`;
  await createRecord('orders', {
    orderId,
    orderType: 'New Fixed Line Activation',
    orderSubType: (contact.isB2B2C && !customerType?.rejected) || customerType?.type === 'b2b2c' ? 'B2B2C' : 'Consumer',
    customerType: customerType?.type,
    companyName: customerType?.type === 'b2b2c' ? customerType.company?.companyName : undefined,
    createdAt: new Date().toISOString(),
    status: pendingApproval ? 'Submitted for Approval' : 'Complete',
    customerName: contact.moiResult?.name,
    customerId: eligibility?.customerId,
    idNumber: contact.idNumber,
    customerEmail: contact.email,
    // Which home product was sold (Fibre, Fixed-Line, FWA, 5G Home); the service type below is what the installation uses.
    homeProduct: homeProductLabel(values.homeProduct as HomeProduct | undefined),
    serviceType: serviceTypeLabel(installation?.serviceType),
    installationAddress: address,
    productId: values.productId,
    msisdn: values.msisdn,
    devices: values.devices,
    billingProfileId,
    newBillingProfileName: billingAccount?.newAccount?.profileName,
    dueTodayQAR: totals?.dueTodayQar ?? 0,
    monthlyRecurringQAR: plan?.mrcQAR ?? 0,
    approvalReason: pendingApproval
      ? [manualIdEntry ? 'Identity manually entered' : '', ...approvalChecks.map((c) => c.message?.split('\n')[0] ?? c.id)].filter(Boolean).join(' | ') || undefined
      : undefined,
    createdBy: currentAgentId(),
    sourceChannel: 'Tablet',
  });
  await createRecord('appointments', {
    appointmentId: `APT-${Date.now().toString().slice(-6)}`,
    orderId,
    status: 'pending',
    appointmentDate: appointment.date,
    timeSlot: appointment.timeSlot,
    cluster: appointment.cluster,
    channel: 'Retail Store',
    notes: appointment.comments,
    // What the technician collects at the visit, and the customer's own request for a specific date and time (a later date than the
    // earliest makes the order future-dated).
    documentsToCollect: appointment.documents ?? [],
    ...(appointment.requestSpecific ? { requestedDate: appointment.requestedDate, requestedTime: appointment.requestedTime, futureDated: isFutureDated(appointment) } : {}),
  });

  const activityCtx = { journey: FIXED_JOURNEY_LABEL, orderId, customerId: eligibility?.customerId, customerName: contact.moiResult?.name, idNumber: contact.idNumber };
  // The Completed activity is automatic and carries no comments; it is recorded when the agent hits Done & Exit.
  const activityId = newActivityId();
  const completionActivity: ActivityInput = {
    ...activityCtx,
    activityNumber: activityId,
    trigger: 'completed',
    reason: pendingApproval
      ? `Order ${orderId} submitted and is awaiting approval.`
      : `Order ${orderId} submitted - installation booked for ${appointment.date} (${appointment.timeSlot})${payment?.reference ? `, WinCash ref ${payment.reference}` : ''}.`,
  };
  if (pendingApproval) {
    await logActivity({ ...activityCtx, trigger: 'workflow-event', name: 'Order Routed for Approval', reason: 'Order requires approval before it can complete.' });
  }

  return {
    orderId,
    activityId,
    completionActivity,
    pendingApproval,
    customerName: contact.moiResult?.name ?? '-',
    customerId: eligibility?.customerId,
    address,
    msisdn: (values.msisdn as string) ?? '-',
    planName: plan?.name ?? '-',
    dueTodayQar: totals?.dueTodayQar ?? 0,
    monthlyRecurringQar: plan?.mrcQAR ?? 0,
    customerEmail: contact.email,
    customerEmailDisplay: contact.moiResult?.isNewCustomer && contact.email ? maskEmail(contact.email) : contact.email,
    customerEmailVerified: emailVerification(contact.email, contact.moiResult?.email).verified,
    service: 'fixed',
  };
}
