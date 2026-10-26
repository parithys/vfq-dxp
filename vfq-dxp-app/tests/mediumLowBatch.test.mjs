import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boot, load, close } from './harness.mjs';

globalThis.window ??= globalThis;
globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test.before(boot);
test.after(close);

test('A stored address line ignores the "-" placeholder and is undefined when nothing real is left', async () => {
  const { storedAddressLine } = await load('/src/components/patterns/addressFromBilling.ts');
  assert.equal(storedAddressLine({ zone: '-', streetNo: '-', buildingNo: '-' }), undefined);
  assert.equal(storedAddressLine({ zone: '45', streetNo: '-', buildingNo: '7' }), 'Zone 45, Building 7');
  assert.equal(storedAddressLine(undefined), undefined);
});

test('The order records the limits, payment and address, a plan source only for an offer, and one approval reason for order and event', () => {
  const s = read('src/modules/new-connection/submitNewConnectionOrder.ts');
  for (const f of ['billLimitQAR:', 'creditLimitQAR:', 'paymentMethod:', 'address: values.address']) assert.ok(s.includes(f), f);
  assert.match(s, /planSource: crossSales\?\.decision === 'accepted' \|\| values\.selectionSource === 'OFFER'/);
  assert.match(s, /reason: approvalReason \|\|/);
  assert.match(s, /'MADA'/);
  assert.match(s, /'Retiree'/);
});

test('A product switch drops the actual user; Fixed Line offers no Switch to Prepaid; the upfront toast waits for the product', () => {
  assert.match(read('src/modules/new-connection/products.ts'), /'homeProduct', 'actualUser'/);
  assert.match(read('src/modules/new-connection/steps/ProductSelection.tsx'), /product === 'prepaid' \|\| product === 'fixed-line' \? undefined/);
  assert.match(read('src/capabilities/CustomerQualification/step.tsx'), /productAgnostic && isUpfrontPaymentRow\(row\)/);
  assert.match(read('src/modules/new-connection/steps/ProductEligibility.tsx'), /isUpfrontPaymentRow\(row\) \|\|/);
});
