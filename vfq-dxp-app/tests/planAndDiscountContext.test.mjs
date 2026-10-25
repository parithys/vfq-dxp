// Plan, add-on and discount offers follow the customer: nationality promotions, plans placed on the right tab, plan-family add-ons, a new customer's
// discounts, and a discount that survives a change of Special Discount type. Over the whole data, in both directions.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};

let model, elig, benefits;
before(async () => {
  await boot();
  model = await load('/src/components/patterns/postpaidPlanModel.ts');
  elig = await load('/src/engines/addonEligibility.ts');
  benefits = await load('/src/engines/customerBenefitEngine.ts');
});
after(close);

const products = JSON.parse(fs.readFileSync('public/mock-data/products.json', 'utf8'));
const plans = products.filter((p) => p.type === 'Postpaid Plan' && p.listed !== false);
const addons = products.filter((p) => p.type === 'Add-on');
const discounts = JSON.parse(fs.readFileSync('public/mock-data/addons-discounts.json', 'utf8')).filter((d) => d.category === 'Discount');
const read = (f) => fs.readFileSync(f, 'utf8');

test('nationality promotion plans are offered to their nationality only (and to nobody of unknown nationality); every other plan to everyone', () => {
  const TABLE = { 'PROD-130': 'Indian', 'PROD-136': 'Indian', 'PROD-131': 'Pakistani', 'PROD-137': 'Pakistani', 'PROD-132': 'Filipino', 'PROD-138': 'Filipino', 'PROD-135': 'Bangladeshi', 'PROD-141': 'Bangladeshi' };
  for (const p of plans) {
    for (const nat of ['Indian', 'Pakistani', 'Filipino', 'Bangladeshi', 'Qatari', 'Egyptian', undefined]) {
      const expected = TABLE[p.productId] ? TABLE[p.productId] === nat : true;
      assert.equal(model.isPlanOfferedTo(p, nat), expected, `${p.productId} ${nat}`);
    }
  }
  assert.equal(Object.keys(TABLE).length, plans.filter((p) => p.eligibleNationalities).length, 'no other plan carries a restriction');
  assert.ok(plans.some((p) => !p.eligibleNationalities), 'unrestricted plans exist');
});

test('the Unlimited range sits on the Plans tab (not the pre-bundled Offers tab), so its add-ons and discounts can be reached; Offers plans are not on the Special Offers tab', () => {
  for (const id of ['PROD-110', 'PROD-111', 'PROD-112', 'PROD-113']) {
    const p = plans.find((x) => x.productId === id);
    assert.equal(model.planGroupOf(p), 'for-you', id);
  }
  assert.equal(model.planGroupOf(plans.find((x) => x.productId === 'PROD-107')), 'specials', 'a real offer stays an offer');
  assert.match(read('src/components/patterns/usePostpaidPlanAddons.ts'), /planGroupOf\(plan\) !== 'specials'/);
});

test('plan-family add-ons are offered on that family\'s plans only; the unrestricted add-ons on every plan', () => {
  const FAMILY = { 'PROD-162': 'Essential', 'PROD-163': 'Extra', 'PROD-164': 'Unlimited' };
  for (const a of addons) {
    for (const p of plans) {
      const family = FAMILY[a.productId];
      const expected = family ? p.name.includes(family) : true;
      assert.equal(elig.isAddonEligible(a, { planId: p.productId }), expected, `${a.productId} on ${p.productId}`);
    }
  }
});

test('a new customer holds no benefit: Loyalty (an existing-customer discount) is not offered, an accepted Special Discount still is', () => {
  const all = discounts;
  const forNew = benefits.discountsForCustomer(all, [], undefined);
  assert.ok(forNew.every((d) => d.addonType !== 'Loyalty Discount'));
  const withMada = benefits.discountsForCustomer(all, [], 'mada');
  assert.ok(withMada.some((d) => d.addonType === 'MADA Discount') && !withMada.some((d) => d.addonType === 'Loyalty Discount'));
  const existing = benefits.discountsForCustomer(all, ['loyalty'], undefined);
  assert.ok(existing.some((d) => d.addonType === 'Loyalty Discount'), 'an existing customer with the benefit keeps it');
  assert.match(read('src/modules/new-connection/hooks/useNewConnectionJourney.ts'), /session\.draftIsNewCustomer \? \[\] : benefitsOnRecord/);
});

test('changing the Special Discount type retires the old discount, and a discount no longer offered is dropped', () => {
  const step = read('src/capabilities/CustomerQualification/step.tsx');
  assert.match(step, /before\.type !== v\.type \|\| Boolean\(before\.rejected\) !== Boolean\(v\.rejected\)\)\)\s*setValue\('discountId', undefined\)/);
  assert.match(read('src/components/patterns/usePostpaidPlanAddons.ts'), /if \(!discounts\.some\(\(d\) => d\.addonDiscountId === discountId\)\) onSelectDiscount\(undefined\)/);
});

test('an accepted offer skips Plan, and skips Addons & Discounts only when no validated Special Discount can apply; the offer\'s plan is a postpaid plan open to the customer', async () => {
  const ps = await load('/src/modules/new-connection/postpaidSteps.tsx');
  const list = ps.postpaidSteps({ products: [], customerBenefits: [] });
  const plan = list.find((s) => s.key === 'plan'), extras = list.find((s) => s.key === 'planExtras');
  const accepted = { crossSales: { decision: 'accepted' } };
  const doc = { frontScanned: true, backScanned: true };
  for (const [customerType, expectExtrasSkipped] of [
    [undefined, true],
    [{ type: 'none' }, true],
    [{ type: 'mada', rejected: true }, true],
    [{ type: 'mada', officeId: doc, officeAccepted: false }, true],      // chosen but not validated
    [{ type: 'mada', officeId: doc, officeAccepted: true }, false],
    [{ type: 'retired', officeId: doc, officeAccepted: true }, false],
  ]) {
    const v = { ...accepted, customerType };
    assert.equal(Boolean(plan.skip(v)), true, 'the plan is fixed by the offer');
    assert.equal(Boolean(extras.skip(v)), expectExtrasSkipped, JSON.stringify(customerType));
  }
  assert.equal(Boolean(extras.skip({ customerType: { type: 'mada', officeId: doc, officeAccepted: true } })), false, 'no offer: the step runs');
  const hook = read('src/modules/new-connection/hooks/useNewConnectionJourney.ts');
  assert.match(hook, /p\.type === 'Postpaid Plan' && isPlanOfferedTo\(p, session\.draftNationality\)/);
});
