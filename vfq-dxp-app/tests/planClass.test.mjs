// planClass: every postpaid plan is a Postpaid Voice Plan or a Postpaid Broadband Plan, by its primary focus, stored on the plan - never derived from the presence of minutes or data.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

globalThis.window ??= globalThis;
globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};
before(boot);
after(close);

const plans = JSON.parse(fs.readFileSync('public/mock-data/products.json', 'utf8')).filter((p) => p.type === 'Postpaid Plan');
// Written out independently of the code: which plans lead with data (Broadband) - the rest lead with calling or sit on the lower data tiers (Voice).
const BROADBAND = ['PROD-104', 'PROD-105', 'PROD-106', 'PROD-111', 'PROD-140'];

test('every postpaid plan carries exactly one of the two classes, and the assignment is the documented one', () => {
  assert.equal(plans.length, 23);
  for (const p of plans) {
    assert.ok(['Postpaid Voice Plans', 'Postpaid Broadband Plans'].includes(p.planClass), p.productId);
    assert.equal(p.planClass === 'Postpaid Broadband Plans', BROADBAND.includes(p.productId), p.productId);
  }
  assert.equal(plans.filter((p) => p.planClass === 'Postpaid Broadband Plans').length, BROADBAND.length);
  assert.ok(plans.some((p) => p._planClassNote), 'the rule is written down with the data');
});

test('the card shows the plan\'s class as its tag, in its own colour; a plan with no class keeps the plain Postpaid tag', async () => {
  const tags = await load('/src/lib/serviceTypeTag.ts');
  const model = await load('/src/components/patterns/postpaidPlanModel.ts');
  assert.equal(tags.SERVICE_TYPE_TAGS[model.PLAN_CLASS_TAG['Postpaid Voice Plans']].label, 'Voice Plan');
  assert.equal(tags.SERVICE_TYPE_TAGS[model.PLAN_CLASS_TAG['Postpaid Broadband Plans']].label, 'Broadband Plan');
  assert.notEqual(tags.SERVICE_TYPE_TAGS['postpaid-voice'].colour, tags.SERVICE_TYPE_TAGS['postpaid-broadband'].colour);
  assert.equal(model.isPlanClass('Postpaid Voice Plans'), true);
  assert.equal(model.isPlanClass('Postpaid'), false);
  assert.equal(model.isPlanClass(undefined), false);
  assert.match(fs.readFileSync('src/components/patterns/PostpaidPlanCard.tsx', 'utf8'), /isPlanClass\(p\.planClass\) \? <ServiceTypeTag type=\{PLAN_CLASS_TAG\[p\.planClass\]\} \/> : <ConnectionTypeTag category="Postpaid" \/>/);
});
