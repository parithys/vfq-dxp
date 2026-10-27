// Defects found auditing the demo journeys: each is pinned here so it cannot return.
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

test('a customer the agent created is judged on what they entered on every page that judges eligibility, not only Customer Verification', async () => {
  const { newIdentityOf } = await load('/src/capabilities/EligibilityGate/newIdentity.ts');
  const created = { idNumber: '28677712345601', idType: 'QID', moiResult: { createdByAgent: true, isNewCustomer: true, nationality: 'Saudi', dob: '1992-09-03', expiryDate: '2033-10-31' } };
  assert.deepEqual(newIdentityOf(created), { idNumber: '28677712345601', idType: 'QID', nationality: 'Saudi', dob: '1992-09-03', expiryDate: '2033-10-31' });
  assert.equal(newIdentityOf({ ...created, moiResult: { ...created.moiResult, createdByAgent: false } }), undefined, 'a registry customer is looked up, not taken from the form');
  assert.equal(newIdentityOf({ idNumber: '1' }), undefined);
  assert.equal(newIdentityOf(undefined), undefined);
  assert.match(read('src/modules/new-connection/steps/ProductEligibility.tsx'), /newIdentity=\{newIdentityOf\(contact\)\}/, 'Product Selection and the MNP plan type');
  assert.match(read('src/capabilities/CustomerQualification/step.tsx'), /newIdentity=\{newIdentityOf\(contact\)\}/, 'Customer Verification');
});

test('the journey header names the kind of ID, not "QID" for a passport', () => {
  const badge = read('src/capabilities/JourneyCustomerLock/JourneyCustomerBadge.tsx');
  assert.doesNotMatch(badge, /- QID \{/);
  assert.match(badge, /active\.idType/);
  assert.match(read('src/capabilities/JourneyCustomerLock/useJourneyCustomerLock.ts'), /idType: draftContact\.idType/);
});

test('the Checkout customer name is the name, not first, middle and last joined by commas', () => {
  assert.doesNotMatch(read('src/capabilities/CheckoutSummary/step.tsx'), /lastName\]\.filter\(Boolean\)\.join\(', '\)/);
});

test('no available journey opens a detail screen that needs a record id (it would land on "could not find this record")', async () => {
  const cat = await load('/src/navigation/journeyCatalogue.ts');
  const routes = JSON.parse(read('public/config/routes.json'));
  const byScreen = new Map((Array.isArray(routes) ? routes : routes.routes).map((r) => [r.screenId, r]));
  const bare = [];
  for (const line of cat.PRODUCT_LINES ?? Object.values(cat).find(Array.isArray) ?? []) {
    for (const category of line.categories ?? []) {
      for (const j of category.journeys ?? []) {
        if (j.status !== 'available' || !j.screenId) continue;
        const r = byScreen.get(j.screenId);
        if (r && /^ticket detail screen/i.test(r.screenName)) bare.push(`${j.id} -> ${r.screenName}`);
      }
    }
  }
  assert.deepEqual(bare, []);
});
