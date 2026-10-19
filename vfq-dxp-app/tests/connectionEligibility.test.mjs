// The Connection Eligibility & Approval Rule Engine wired into the app: what is read from the data, how a decision becomes the Active Lines check,
// and which orders it routes to Credit Control. Expectations are written from the rule table, not from the code.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

let adapter;
let checksModel;
before(async () => {
  await boot();
  adapter = await load('/src/engines/connectionEligibility.ts');
  checksModel = await load('/src/engines/eligibilityEngine.ts');
});
after(close);

const NOW = new Date('2026-10-19T09:00:00Z');
const ask = (customerId, nationality, requestedType, extra = {}) =>
  adapter.evaluateConnection({ customerId, nationality, idType: 'QID', dob: '1985-01-01', requestedType, now: NOW, ...extra });
const types = (d) => d.approvals.map((a) => a.type);

test('the customer\'s lines come from the installed services, classified by the one definition (CUST-3072, an Indian QID holder with 5 postpaid lines)', async () => {
  const d = await ask('CUST-3072', 'Indian', 'MOBILE_POSTPAID');
  assert.equal(d.countsBefore.postpaid, 5);
  assert.equal(d.countsBefore.mobileTotal, 5);
  assert.equal(d.outcome, 'BLOCK', 'an expatriate holds at most 5 mobile lines');
  assert.equal(d.block.reasonCode, 'ELIG_MOBILE_TOTAL_CAP_REACHED');
});

test('an expatriate\'s 4th postpaid line needs Credit Control (CUST-3013, 3 postpaid lines)', async () => {
  const d = await ask('CUST-3013', 'Egyptian', 'MOBILE_POSTPAID');
  assert.equal(d.outcome, 'ALLOW_WITH_APPROVAL');
  assert.deepEqual(types(d), ['CREDIT_CONTROL']);
  assert.equal(d.requestedOrdinal, d.countsBefore.postpaid + 1);
});

test('a Qatari has no overall limit: 20 postpaid lines still allow a 21st with Credit Control (CUST-3082); 25 prepaid lines allow a 26th (CUST-3083)', async () => {
  const post = await ask('CUST-3082', 'Qatari', 'MOBILE_POSTPAID');
  assert.equal(post.segment, 'QATARI');
  assert.deepEqual(types(post), ['CREDIT_CONTROL']);
  const pre = await ask('CUST-3083', 'Qatari', 'MOBILE_PREPAID');
  assert.equal(pre.outcome, 'ALLOW');
  assert.ok(pre.pendingConfirmations.includes('qatari.prepaid.max'), 'a maximum of 10 would have blocked it');
});

test('Fixed/FWA lines are counted apart from mobile (CUST-3084): the 9th needs Credit Control and the mobile total is unaffected', async () => {
  const d = await ask('CUST-3084', 'Qatari', 'FIXED_FWA');
  assert.equal(d.outcome, 'ALLOW_WITH_APPROVAL');
  assert.ok(d.countsBefore.fixedFwa >= 3);
  assert.equal(d.countsAfter.mobileTotal, d.countsBefore.mobileTotal);
});

test('an order held for approval reserves its slot (CUST-3002 has 5 postpaid lines and one held New Postpaid Activation order)', async () => {
  const d = await ask('CUST-3002', 'Qatari', 'MOBILE_POSTPAID');
  assert.equal(d.countsBefore.postpaid, 6);
});

test('a new customer has no lines and no orders in flight', async () => {
  const d = await ask(undefined, 'Indian', 'MOBILE_POSTPAID');
  assert.deepEqual(d.countsBefore, { prepaid: 0, postpaid: 0, mobileTotal: 0, fixedFwa: 0 });
  assert.equal(d.outcome, 'ALLOW');
});

test('an ID type the engine has no rules for, or an unknown date of birth, is not evaluated', async () => {
  assert.equal(await ask('CUST-3072', 'Indian', 'MOBILE_POSTPAID', { idType: 'GCC ID' }), null);
  assert.equal(await ask('CUST-3072', 'Indian', 'MOBILE_POSTPAID', { idType: 'Diplomatic ID' }), null);
  assert.equal(await ask('CUST-3072', 'Indian', 'MOBILE_POSTPAID', { dob: undefined }), null);
});

test('a passport adds BAU approval to a postpaid line, and a customer under 18 adds the exception', async () => {
  const d = await ask('CUST-3013', 'Egyptian', 'MOBILE_POSTPAID', { idType: 'Passport', dob: '2010-06-01' });
  assert.deepEqual(types(d), ['BAU', 'CREDIT_CONTROL', 'EXCEPTION_UNDER_18']);
});

test('a conversion is judged as a migration: the mobile total is unchanged, so the overall limit does not block it (CUST-3014: 2 postpaid, 3 prepaid)', async () => {
  const d = await ask('CUST-3014', 'Sri Lankan', 'MOBILE_POSTPAID', { requestKind: 'PREPAID_TO_POSTPAID_MIGRATION' });
  assert.notEqual(d.outcome, 'BLOCK');
  assert.deepEqual([d.countsAfter.prepaid, d.countsAfter.postpaid], [2, 3]);
  assert.ok(d.pendingConfirmations.includes('migration.approvalThresholdsApply'));
});

test('the decision becomes the Active Lines check: a block is a hard stop, approvals are approval routing, an allow passes with the counts', async () => {
  const blocked = await ask('CUST-3072', 'Indian', 'MOBILE_POSTPAID');
  const routed = await ask('CUST-3013', 'Egyptian', 'MOBILE_POSTPAID');
  const clear = await ask(undefined, 'Indian', 'MOBILE_POSTPAID');
  const run = (lineDecision) => checksModel.evaluateEligibilityChecks(
    { customer: { customerId: 'C', nationality: 'Indian', idType: 'QID', dob: '1985-01-01' }, deals: [], outstandingQar: 0, lineCapReached: false, activeLinesDetail: '', lineDecision, scope: 'product' }, NOW).find((c) => c.id === 'active-lines');
  assert.equal(run(blocked).outcome, 'hard-stop');
  assert.match(run(blocked).message, /not permitted/);
  assert.equal(run(routed).outcome, 'approval-routing');
  assert.match(run(routed).message, /Credit Control approval/);
  assert.equal(run(clear).outcome, 'pass');
  assert.equal(run(undefined).outcome, 'pass', 'without a decision the older line-cap fields apply');
});

test('Credit Control approval routes to Credit Control; BAU and under-18 keep the usual approver; the order keeps the decision for the approver', async () => {
  const cc = await ask('CUST-3013', 'Egyptian', 'MOBILE_POSTPAID');
  const bauOnly = await ask(undefined, 'Indian', 'MOBILE_POSTPAID', { idType: 'Passport' });
  assert.equal(adapter.needsCreditControl(cc), true);
  assert.equal(adapter.needsCreditControl(bauOnly), false);
  assert.deepEqual(bauOnly.approvals.map((a) => a.type), ['BAU']);
  assert.deepEqual(adapter.decisionRecord(undefined), {});
  const rec = adapter.decisionRecord(cc).lineEligibility;
  assert.equal(rec.ruleSetVersion, '1.0.0');
  assert.equal(rec.outcome, 'ALLOW_WITH_APPROVAL');
  assert.match(adapter.approvalMessages(cc), /Credit Control/);
  assert.equal(adapter.approvalMessages(await ask(undefined, 'Indian', 'MOBILE_POSTPAID')), '');
});

test('every submit that creates an activation order keeps the decision and routes Credit Control approval', () => {
  for (const f of [
    'src/modules/new-connection/submitNewConnectionOrder.ts', 'src/modules/mobile-prepaid/screens/submitPrepaidOrder.ts', 'src/modules/mnp-fnp-porting/screens/submitMnpOrder.ts',
    'src/modules/fixed-line-fibre/fixedActivation/submitFixedActivationOrder.ts', 'src/modules/pre-to-post-migration/screens/submitPreToPostOrder.ts',
  ]) {
    const src = fs.readFileSync(f, 'utf8');
    assert.match(src, /decisionRecord\(/, f);
    assert.match(src, /needsCreditControl\(/, f);
  }
});
