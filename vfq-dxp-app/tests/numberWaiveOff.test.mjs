// Waive Off on Number Selection: Partial (half) or Full waiver of the Star number's upfront charge, carried to Checkout, Payment and the order.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

globalThis.window ??= globalThis;
globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};
const read = (p) => fs.readFileSync(p, 'utf8');
before(boot);
after(close);

test('the waiver maths: nothing without a waiver or a charge, all when Full, half when Partial; conservation (waived + payable = charge)', async () => {
  const w = await load('/src/engines/numberWaiver.ts');
  assert.equal(w.waivedQar(1000, undefined), 0);
  assert.equal(w.waivedQar(0, 'full'), 0);
  assert.equal(w.waivedQar(-5, 'full'), 0);
  assert.equal(w.waivedQar(1000, 'full'), 1000);
  assert.equal(w.waivedQar(1000, 'partial'), 500);
  assert.equal(w.waivedQar(333.33, 'partial'), 166.67);
  for (const charge of [0, 1, 47125, 333.33, 999.99]) for (const mode of [undefined, 'partial', 'full']) {
    assert.equal(Math.round((w.waivedQar(charge, mode) + w.chargeAfterWaiverQar(charge, mode)) * 100) / 100, charge, `${charge} ${mode}`);
  }
  assert.deepEqual(w.NUMBER_WAIVER_OPTIONS.map((o) => o.label), ['Partial Waive Off', 'Full Waive Off']);
  assert.equal(w.isNumberWaiver('full'), true);
  assert.equal(w.isNumberWaiver('half'), false);
});

test('Waive Off sits before Continue on the number step, only for a journey that asks for it, and a new number drops the waiver', async () => {
  const { numberSelectionStep } = await load('/src/capabilities/NumberSelection/step.tsx');
  assert.equal(numberSelectionStep({}).primaryAction, undefined, 'no Waive Off unless asked for');
  const step = numberSelectionStep({ waiveOff: true, priceField: 'numberPriceQAR', plan: () => ({ mrcQar: 115, starEntitlementQar: 2875 }) });
  assert.equal(typeof step.primaryAction, 'function');
  assert.match(read('src/capabilities/NumberSelection/step.tsx'), /if \(msisdn !== values\.msisdn\) setValue\('numberWaiver', undefined\)/);
  assert.match(read('src/modules/new-connection/postpaidSteps.tsx'), /waiveOff: true/);
  assert.ok((await load('/src/modules/new-connection/products.ts')).PRODUCT_OWNED_KEYS.includes('numberWaiver'));
});

test('Checkout, the customer view, the order and its approval carry the waiver', () => {
  const hook = read('src/components/patterns/useCheckoutSummary.ts');
  assert.match(hook, /dueTodayQar = numberPayableQar \+ hrnAdvance/);
  assert.match(read('src/components/patterns/checkoutDetailedTables.ts'), /Number Charge After Waiver/);
  assert.match(read('src/components/patterns/CheckoutDefaultLayout.tsx'), /numberWaiverLabel\(numberWaiver\)/);
  assert.match(read('src/components/patterns/checkoutSummaryRows.ts'), /waived off the Star Number charge/);
  const order = read('src/modules/new-connection/submitNewConnectionOrder.ts');
  assert.match(order, /waived \|\|/, 'a waiver routes the order for approval');
  assert.match(order, /numberWaivedQAR: waivedAmountQar/);
  assert.match(order, /waived off the Star number upfront charge/);
  assert.match(read('src/capabilities/Payment/step.tsx'), /checkoutTotals as CheckoutTotals \| undefined\)\?\.dueTodayQar/, 'Payment reads the revised due-today figure');
});
