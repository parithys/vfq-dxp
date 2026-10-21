import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, load, close } from './harness.mjs';

// Actual User: who will use the line when it is not the customer who owns it.
let m, sub, caf;
before(async () => {
  await boot();
  m = await load('/src/capabilities/ActualUser/actualUserModel.ts');
  sub = await load('/src/capabilities/ActualUser/submit.ts');
  caf = await load('/src/capabilities/CafSignature/step.tsx');
});
after(close);

const identified = (over = {}) => ({
  choice: 'other',
  identity: { idType: 'QID', idNumber: '29001012345', email: 'sara@example.qa', moiResult: { name: 'Sara Al-Kuwari', dob: '2012-05-20', nationality: 'Qatari', customerId: 'CUST-1002', email: 'old@example.qa' }, ...over },
});

test('the primary customer using the line needs nothing more; no choice means the same', () => {
  assert.equal(m.isActualUserValid(undefined, '1'), true);
  assert.equal(m.isActualUserValid({ choice: 'primary' }, '1'), true);
  assert.deepEqual(m.supplementaryRows({ choice: 'primary' }), []);
  assert.deepEqual(sub.actualUserOrderFields({ choice: 'primary' }), {});
});

test('an actual user must be identified (MOI), have a valid email, and be a different person', () => {
  assert.equal(m.isActualUserValid({ choice: 'other' }, '1'), false, 'chosen but nobody identified');
  assert.equal(m.isActualUserValid(identified({ moiResult: undefined }), '1'), false, 'no MOI result');
  assert.equal(m.isActualUserValid(identified({ email: 'not-an-email' }), '1'), false, 'bad email');
  assert.equal(m.isActualUserValid(identified({ altPhone: '123' }), '1'), false, 'bad alternate phone');
  assert.equal(m.isActualUserValid(identified(), '29001012345'), false, 'the primary customer is not an actual user');
  assert.equal(m.isActualUserValid(identified(), ' 29001012345 '.trim().toLowerCase()), false);
  assert.equal(m.isActualUserValid(identified(), '28456701234'), true);
});

test('only someone under 18 can be an actual user; unknown age blocks; no eligibility check is run for them', async () => {
  const on = new Date('2026-10-21');
  const withDob = (dob) => identified({ moiResult: { name: 'X', dob, nationality: 'Qatari' } }).identity;
  assert.equal(m.actualUserAgeProblem(withDob('2008-10-22'), on), undefined, '17 on the day before the 18th birthday');
  assert.match(m.actualUserAgeProblem(withDob('2008-10-21'), on), /under 18/, 'exactly 18 is not allowed');
  assert.match(m.actualUserAgeProblem(withDob('1990-01-01'), on), /under 18/);
  assert.match(m.actualUserAgeProblem(withDob(undefined), on), /not on record/);
  assert.equal(m.isActualUserValid(identified({ moiResult: { name: 'Adult', dob: '1990-01-01', nationality: 'Qatari' } }), '1'), false);
  assert.equal(m.isActualUserValid(identified(), '1'), true, 'a minor is accepted');
  // The primary stays accountable: none of the primary's eligibility checks is wired into this capability.
  const fs = await import('node:fs');
  for (const f of fs.readdirSync('src/capabilities/ActualUser').filter((n) => /\.tsx?$/.test(n))) {
    assert.ok(!/EligibilityGate|blacklist|isHrn|connectionLimit|checkEligibility/i.test(fs.readFileSync(`src/capabilities/ActualUser/${f}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')), `${f} must not run eligibility checks`);
  }
});

test('the Supplementary Form rows and the order record carry the actual user', () => {
  const rows = m.supplementaryRows(identified());
  assert.equal(rows[0].value, 'Sara Al-Kuwari');
  assert.ok(rows.some((r) => r.label === 'Email' && r.value === 'sara@example.qa'));
  const f = sub.actualUserOrderFields(identified());
  assert.equal(f.actualUser.customerId, 'CUST-1002');
  assert.equal(f.supplementaryForm.signedWithCaf, true);
});

test('an existing customer\'s changed email is written back to their record; unchanged or new writes nothing', async () => {
  const calls = [];
  const update = async (...a) => calls.push(a);
  assert.equal(await sub.saveActualUserContact(identified(), update), true);
  assert.deepEqual(calls[0], ['customers', 'customerId', 'CUST-1002', { email: 'sara@example.qa' }]);
  calls.length = 0;
  assert.equal(await sub.saveActualUserContact(identified({ email: 'old@example.qa' }), update), false, 'email unchanged');
  assert.equal(await sub.saveActualUserContact(identified({ moiResult: { name: 'New Person', dob: '01/01/2000', nationality: 'Qatari', isNewCustomer: true } }), update), false, 'a new person has no record');
  assert.equal(await sub.saveActualUserContact({ choice: 'primary' }, update), false);
  assert.equal(calls.length, 0);
});

test('with an actual user: one primary signature covers both forms (after both consents); the secondary contact signs the Supplementary Form on their own', () => {
  const step = caf.cafSignatureStep({ variant: 'full' });
  const primary = { cafType: 'Digital', signatureDataUrl: 'data:image/png;base64,AA' };
  assert.equal(step.isValid({ caf: primary }), true, 'no actual user: the one signature is enough');
  assert.equal(step.isValid({ caf: primary, actualUser: { choice: 'primary' } }), true);
  assert.equal(step.isValid({ caf: primary, actualUser: identified() }), false, 'primary consent and the secondary signature are missing');
  assert.equal(step.isValid({ caf: { ...primary, supplementaryAgreed: true }, actualUser: identified() }), false, 'the secondary contact has not signed');
  assert.equal(step.isValid({ caf: { ...primary, secondarySignatureDataUrl: 'data:image/png;base64,BB' }, actualUser: identified() }), false, 'the primary has not agreed to the Supplementary Form');
  assert.equal(step.isValid({ caf: { ...primary, supplementaryAgreed: true, secondarySignatureDataUrl: 'data:image/png;base64,BB' }, actualUser: identified() }), true);
});

test('the demo reader presents someone else, by rule: under 18, not the primary, an unexpired QID with a real number', () => {
  const on = new Date('2026-10-21');
  const customers = [{ customerId: 'A', dob: '1985-03-12' }, { customerId: 'B', dob: '2010-05-20' }, { customerId: 'C', dob: '2012-01-01' }, { customerId: 'D', dob: '2014-03-15' }];
  const docs = [
    { customerId: 'A', documentType: 'QID', documentNumber: '28456701234', expiryDate: '2029-11-30' },
    { customerId: 'B', documentType: 'QID', documentNumber: 'P1234567', expiryDate: '2029-11-30' },
    { customerId: 'C', documentType: 'QID', documentNumber: '31201010000012', expiryDate: '2025-01-01' },
    { customerId: 'D', documentType: 'QID', documentNumber: '31403153400090', expiryDate: '2030-03-31' },
  ];
  assert.equal(m.pickDemoReaderCustomer(customers, docs, 'A', on), 'D', 'adult, odd number and expired card are all skipped');
  assert.equal(m.pickDemoReaderCustomer(customers, docs, 'D', on), undefined, 'the primary is never offered');
  assert.equal(m.pickDemoReaderCustomer([], docs, 'A', on), undefined);
});
