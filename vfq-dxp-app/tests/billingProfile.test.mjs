// The Billing Profile is selected or created for the agent, in every journey that has the step; its absence is never shown as a problem.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load, close } from './harness.mjs';

test('the Billing Profile step resolves itself (headless) once the customer is identified, and not before', async () => {
  const { billingAccountStep } = await load('/src/capabilities/BillingAccount/step.tsx');
  const step = billingAccountStep({ profileSuffix: 'Fixed Line' });
  assert.equal(step.autoPass({}), true);
  assert.equal(step.headless({ values: {}, setValue() {} }), null);
  const el = step.headless({ values: { contact: { moiResult: { name: 'Aisha' } }, eligibility: { customerId: 'CUST-3084' } }, setValue() {} });
  assert.equal(el.props.customerId, 'CUST-3084');
  assert.equal(el.props.profileSuffix, 'Fixed Line');
});

test('the wizard mounts each step\'s headless work, and no journey step mounts the resolver by hand any more', () => {
  assert.match(fs.readFileSync('src/capabilities/GuidedActivationWizard/GuidedActivationWizard.tsx', 'utf8'), /s\.headless \? <Fragment key=\{s\.key\}>/);
  assert.doesNotMatch(fs.readFileSync('src/modules/new-connection/steps/ProductSelection.tsx', 'utf8'), /BillingAccountAutoResolver/);
});

test('an existing profile is selected, otherwise a default one is created', async () => {
  const src = fs.readFileSync('src/components/patterns/BillingAccountAutoResolver.tsx', 'utf8');
  assert.match(src, /selectedProfileId: own\[0\]\.billingProfileId/);
  assert.match(src, /creatingNew: true/);
});

test.after(close);

test('editing an existing billing account saves what the agent changed onto that account\'s profile; an unedited one writes nothing', async () => {
  const { persistBillingAccount } = await load('/src/capabilities/BillingAccount/persistBillingAccount.ts');
  const updates = [];
  const ctx = { createRecord: async () => {}, updateRecord: async (...a) => void updates.push(a), kind: 'Consumer Mobile Postpaid' };
  const edit = { selectedProfileId: 'BILL-1', editingProfileId: 'BILL-1', newAccount: { editAddressLine: ' Zone 55, Street 12, Doha ', primaryContactName: 'Fatima Al-Marri', billCycleDay: 7, billingMode: 'Arrears', profileName: 'Fatima - Billing', billMedia: 'Email' } };
  assert.equal(await persistBillingAccount(edit, ctx), 'BILL-1');
  assert.deepEqual(updates, [['billing-profiles', 'billingProfileId', 'BILL-1', { billingContactName: 'Fatima Al-Marri', billingAddress: 'Zone 55, Street 12, Doha', billingCycle: 'Monthly - Day 7', billingType: 'Arrears', name: 'Fatima - Billing', billMedium: 'Email' }]]);
  updates.length = 0;
  await persistBillingAccount({ selectedProfileId: 'BILL-1' }, ctx);
  await persistBillingAccount({ ...edit, editingProfileId: undefined }, ctx);
  await persistBillingAccount({ selectedProfileId: 'BILL-1', editingProfileId: 'BILL-1', newAccount: { editAddressLine: '  ' } }, ctx);
  assert.deepEqual(updates, []);
  await persistBillingAccount(edit, { ...ctx, updateRecord: undefined });
});

test('Customer 360 account edit: only Credit Limit, Account Status and Customer Segment change, and bad limits are refused', async () => {
  const { diffAccountEdits, EDITABLE_SEGMENTS } = await load('/src/workspace/customer360/accountEditModel.ts');
  assert.deepEqual([...EDITABLE_SEGMENTS], ['Consumer', 'Consumer (HRN)', 'Safwa', 'Safwa+', 'Royal', 'Small Business', 'Medium Business', 'Large Business', 'Government']);
  const before = { creditLimitQar: 1000, accountStatus: 'Active', segment: 'Consumer' };
  const same = diffAccountEdits(before, { creditLimit: '1000', accountStatus: 'Active', segment: 'Consumer' });
  assert.deepEqual([same.changed, same.edits], [[], {}], 'nothing changed: nothing written');
  const all = diffAccountEdits(before, { creditLimit: '1500', accountStatus: 'Suspended', segment: 'Royal' });
  assert.deepEqual(all.changed, ['Credit Limit', 'Account Status', 'Customer Segment']);
  assert.deepEqual(all.edits, { creditLimitQar: 1500, accountStatus: 'Suspended', segment: 'Royal' });
  assert.deepEqual(diffAccountEdits(before, { creditLimit: '1000', accountStatus: 'Active', segment: 'Safwa' }).changed, ['Customer Segment']);
  for (const bad of ['-5', '12.5', 'abc']) assert.ok(diffAccountEdits(before, { creditLimit: bad, accountStatus: 'Active', segment: 'Consumer' }).error, bad);
  assert.equal(diffAccountEdits({ ...before, creditLimitQar: undefined }, { creditLimit: '', accountStatus: 'Active', segment: 'Consumer' }).changed.length, 0, 'an empty limit with none on file is no change');
});

test('the Primary Contact is the first contact by default, can be chosen on the billing profile, and changes only with more than one contact', async () => {
  const { primaryContactOf, canChangePrimaryContact, contactName } = await load('/src/workspace/customer360/primaryContactModel.ts');
  const a = { contactRecordId: 'C1', firstName: 'Ahmed', lastName: 'Al-Sulaiti' };
  const b = { contactRecordId: 'C2', firstName: 'Sara', middleName: 'K', lastName: 'Al-Sulaiti' };
  assert.equal(primaryContactOf([a, b], undefined), a, 'the first contact is the default');
  assert.equal(primaryContactOf([a, b], 'C2'), b, 'the one chosen on the profile');
  assert.equal(primaryContactOf([a, b], 'GONE'), a, 'a chosen contact that is no longer one of the account\'s falls back to the first');
  assert.equal(primaryContactOf([], 'C1'), undefined);
  assert.deepEqual([canChangePrimaryContact(0), canChangePrimaryContact(1), canChangePrimaryContact(2)], [false, false, true]);
  assert.equal(contactName(b), 'Sara K Al-Sulaiti');
});

test('the default credit limit follows the customer segment, and a credit limit change is a request that Credit Control approves', async () => {
  const hrn = await load('/src/engines/hrnConfiguration.ts');
  assert.equal(hrn.defaultCreditLimitForSegment('Consumer (HRN)'), 50, 'an HRN segment: the HRN category\'s limit');
  for (const s of ['Consumer', 'Safwa', 'Safwa+', 'Royal', 'Large Business', undefined]) assert.equal(hrn.defaultCreditLimitForSegment(s), 1000, String(s));
  assert.deepEqual(hrn.SEGMENT_CREDIT_LIMITS_QAR, {}, 'no segment-specific amount has been given');
  const { creditLimitChangeOf, applyCreditLimitChange, CREDIT_LIMIT_CHANGE_ORDER_TYPE } = await load('/src/workspace/customer360/creditLimitChange.ts');
  const order = { orderType: CREDIT_LIMIT_CHANGE_ORDER_TYPE, customerId: 'CUST-1', requestedCreditLimitQar: 1500, accountId: 'ACC-1' };
  assert.deepEqual(creditLimitChangeOf(order), { customerId: 'CUST-1', creditLimitQar: 1500, accountId: 'ACC-1' });
  assert.equal(creditLimitChangeOf({ ...order, orderType: 'Plan Change' }), undefined);
  assert.equal(creditLimitChangeOf({ ...order, requestedCreditLimitQar: '1500' }), undefined);
  const calls = [];
  const deps = (rows) => ({ list: async () => rows, updateRecord: async (...a) => void calls.push(['update', ...a]), createRecord: async (...a) => void calls.push(['create', ...a]) });
  await applyCreditLimitChange({ customerId: 'CUST-1', creditLimitQar: 1500 }, deps([{ id: 'CRL-1', customerId: 'CUST-1' }]), '2026-10-20');
  assert.deepEqual(calls, [['update', 'credit-limits', 'id', 'CRL-1', { creditLimitQar: 1500, lastUpdated: '2026-10-20' }]]);
  calls.length = 0;
  await applyCreditLimitChange({ customerId: 'CUST-2', creditLimitQar: 800, accountId: 'ACC-2' }, deps([]), '2026-10-20');
  assert.equal(calls[0][0], 'create');
  assert.deepEqual([calls[0][2].customerId, calls[0][2].creditLimitQar, calls[0][2].accountId], ['CUST-2', 800, 'ACC-2']);
  const fsm = await import('node:fs');
  const drawer = fsm.readFileSync('src/workspace/customer360/AccountEditDrawer.tsx', 'utf8');
  assert.match(drawer, /status: 'Submitted for Approval'/);
  assert.match(drawer, /approverRole: COLLECTION_TEAM_ROLE/);
  assert.doesNotMatch(drawer, /updateRecord\('credit-limits'/, 'the drawer never writes the limit itself');
  assert.match(fsm.readFileSync('src/modules/order-management/OrderApprovalDetail.tsx', 'utf8'), /applyCreditLimitChange\(limitChange/);
});

test('customer segments: Consumer and Enterprise groups, no Premium, VIP tags and business recognition follow the list', async () => {
  const seg = await load('/src/data/customerSegments.ts');
  const biz = await load('/src/engines/businessSegment.ts');
  assert.deepEqual(seg.SEGMENT_GROUPS.map((g) => [g.group, [...g.segments]]), [
    ['Consumer', ['Consumer', 'Consumer (HRN)', 'Safwa', 'Safwa+', 'Royal']],
    ['Enterprise', ['Small Business', 'Medium Business', 'Large Business', 'Government']],
  ]);
  assert.ok(!seg.ALL_SEGMENTS.includes('Premium'));
  assert.deepEqual(['Safwa', 'Safwa+', 'Royal', 'Consumer', 'Premium'].map(seg.vipTagOf), ['VIP', 'VVIP', 'Royal', undefined, undefined]);
  assert.equal(seg.segmentGroupOf('Government'), 'Enterprise');
  assert.equal(seg.segmentGroupOf('Safwa+'), 'Consumer');
  for (const s of ['Small Business', 'Medium Business', 'Large Business', 'Government']) assert.equal(biz.isBusinessSegment(s), true, s);
  for (const s of ['Consumer', 'Consumer (HRN)', 'Safwa', 'Safwa+', 'Royal']) assert.equal(biz.isBusinessSegment(s), false, s);
  const customers = JSON.parse((await import('node:fs')).readFileSync('public/mock-data/customers.json', 'utf8'));
  assert.ok(customers.every((c) => c.segment !== 'Premium'), 'no customer carries Premium');
});
