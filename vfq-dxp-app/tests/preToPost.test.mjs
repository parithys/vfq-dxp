import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, load, close } from './harness.mjs';

globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};

// Prepaid to Postpaid Conversion runs on the same shared steps as New Mobile Postpaid.
let steps, submit;
before(async () => {
  await boot();
  steps = await load('/src/modules/pre-to-post-migration/screens/preToPostSteps.tsx');
  submit = await load('/src/modules/pre-to-post-migration/screens/submitPreToPostOrder.ts');
});
after(close);

const ctx = { flow: 'new', existingCustomerId: undefined, guardedContactChange: () => true, products: [], customerBenefits: undefined };

test('the conversion uses Customer Identification, Billing Profile, Offers & Plans, Add-ons, Checkout, the full CAF and Payment', () => {
  const all = steps.preToPostSteps(ctx);
  assert.deepEqual(all.map((s) => s.key), ['contact', 'msisdn', 'billingAccount', 'plan', 'planExtras', 'checkout', 'caf', 'payment']);
  assert.equal(typeof all.find((s) => s.key === 'caf').locksAfter, 'function', 'the full CAF locks the journey once signed');
});

test('the prepaid number must be a complete Qatar mobile number', () => {
  const step = steps.preToPostSteps(ctx).find((s) => s.key === 'msisdn');
  assert.equal(step.isValid({}), false);
  assert.equal(step.isValid({ msisdn: '+9745' }), false);
  assert.equal(step.isValid({ msisdn: '+97455123456' }), true);
});

test('a conversion is priced like a postpaid order and completes, or waits for the manager when it needs a second look', async () => {
  const created = [];
  const deps = { createRecord: async (kind, rec) => void created.push({ kind, rec }) };
  const base = {
    contact: { idNumber: '28450000001', idType: 'QID', moiResult: { name: 'Test Customer' } },
    eligibility: { customerId: 'CUST-1001', checks: [] },
    msisdn: '+97455123456',
    productId: 'PROD-104',
    checkoutTotals: { dueTodayQar: 0, monthlyRecurringQar: 0, hrnAdvanceQar: 0 },
    billingAccount: { selectedProfileId: 'BILL-7001' },
  };
  const done = await submit.submitPreToPostOrder(base, deps);
  const order = created.find((c) => c.kind === 'orders').rec;
  assert.deepEqual([order.orderType, order.orderSubType, order.status, order.msisdn], ['Plan Change', 'Pre2Post', 'Complete', '+97455123456']);
  assert.equal(order.billingProfileId, 'BILL-7001');
  assert.equal(done.pendingApproval, false);
  assert.ok(done.monthlyRecurringQar > 0, 'the plan is priced with VAT, as New Mobile Postpaid prices it');

  const hrn = await submit.submitPreToPostOrder({ ...base, eligibility: { customerId: 'CUST-1001', checks: [], requiresHrnAdvance: true } }, deps);
  assert.equal(hrn.pendingApproval, true);
  assert.equal(created.filter((c) => c.kind === 'orders').at(-1).rec.status, 'Submitted for Approval');
});
