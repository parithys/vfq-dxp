// New Connection is ONE journey: Customer Identification once, then the chosen product's steps in the same wizard.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, load, close } from './harness.mjs';

globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};

let conn, products, engine, billing, store, mnp, cross, pstep, mnpSteps, attach;
before(async () => {
  await boot();
  conn = await load('/src/modules/new-connection/connectionSteps.tsx');
  products = await load('/src/modules/new-connection/products.ts');
  engine = await load('/src/engines/eligibilityEngine.ts');
  billing = await load('/src/capabilities/BillingAccount/persistBillingAccount.ts');
  store = await load('/src/stores/workflowStore.ts');
  mnp = await load('/src/modules/mnp-fnp-porting/screens/submitMnpOrder.ts');
  cross = await load('/src/capabilities/CrossSellOffers/serviceJourneys.ts');
  pstep = await load('/src/modules/new-connection/steps/productStep.tsx');
  mnpSteps = await load('/src/modules/mnp-fnp-porting/screens/mnpSteps.tsx');
  attach = await load('/src/components/patterns/DonorAttachmentStep.tsx');
});
after(close);

const ctx = { device: 'web', wizardId: 'new-connection', flow: 'new', existingCustomerId: undefined, guardedContactChange: () => {}, applyCrossSales: () => {}, navigate: () => {}, createRecord: async () => {}, products: [], customerBenefits: undefined };
const activeKeys = (values) => conn.buildConnectionSteps(ctx).filter((s) => !s.skip?.(values)).map((s) => s.key);

// ---- one wizard, four products ----------------------------------------------------------------------------------------
test('before a product is chosen the journey is Customer Identification, Address, Billing Profile and Product Selection', () => {
  assert.deepEqual(activeKeys({}), ['contact', 'address', 'billingAccount', 'product']);
});

test('every product continues the same wizard: identification, address, billing profile (where the product has one), product selection, then that product\'s own steps', () => {
  assert.deepEqual(activeKeys({ product: 'postpaid' }), ['contact', 'address', 'billingAccount', 'product', 'plan', 'planExtras', 'number', 'simType', 'checkout', 'caf', 'payment']);
  assert.deepEqual(activeKeys({ product: 'prepaid' }), ['contact', 'address', 'product', 'plan', 'planExtras', 'number', 'simType', 'cart', 'checkout', 'caf', 'payment']);
  assert.deepEqual(activeKeys({ product: 'fixed-line' }), ['contact', 'address', 'billingAccount', 'product', 'homeKind', 'installation', 'plan', 'number', 'checkout', 'caf', 'payment', 'appointment']);
  assert.deepEqual(activeKeys({ product: 'mnp', mnpType: 'postpaid' }), ['contact', 'address', 'billingAccount', 'product', 'mnpType', 'sim', 'plan', 'planExtras', 'donor-details', 'checkout', 'donor-attachment', 'caf', 'payment']);
  assert.deepEqual(activeKeys({ product: 'mnp', mnpType: 'prepaid' }), ['contact', 'address', 'product', 'mnpType', 'sim', 'plan', 'planExtras', 'donor-details', 'checkout', 'donor-attachment', 'caf', 'payment']);
});

test('no two active steps share a key, for any product', () => {
  for (const values of [{ product: 'postpaid' }, { product: 'prepaid' }, { product: 'fixed-line' }, { product: 'mnp', mnpType: 'postpaid' }, { product: 'mnp', mnpType: 'prepaid' }]) {
    const keys = activeKeys(values);
    assert.equal(new Set(keys).size, keys.length, `${JSON.stringify(values)} has a duplicate key: ${keys}`);
  }
});

test('a product\'s steps never leak into another product\'s journey', () => {
  assert.ok(!activeKeys({ product: 'postpaid' }).includes('cart'));
  assert.ok(!activeKeys({ product: 'prepaid' }).includes('billingAccount'), 'prepaid has no billing account');
  assert.ok(!activeKeys({ product: 'fixed-line' }).includes('simType'));
});

test('eligibility is judged by the product chosen; billing exists only where the product has one', () => {
  assert.equal(products.eligibilityJourney({ product: 'prepaid' }), 'prepaid');
  assert.equal(products.eligibilityJourney({ product: 'mnp', mnpType: 'prepaid' }), 'prepaid');
  for (const v of [{ product: 'postpaid' }, { product: 'fixed-line' }, { product: 'mnp', mnpType: 'postpaid' }]) assert.equal(products.eligibilityJourney(v), 'postpaid');
  assert.equal(products.hasBillingAccount({ product: 'postpaid' }), true);
  assert.equal(products.hasBillingAccount({ product: 'fixed-line' }), true);
  assert.equal(products.hasBillingAccount({ product: 'prepaid' }), false);
  assert.equal(products.hasBillingAccount({ product: 'mnp', mnpType: 'prepaid' }), false);
});

test('switching product drops what the old product chose but keeps identity, eligibility and customer type', () => {
  for (const kept of ['contact', 'eligibility', 'customerType', 'crossSales', 'product']) assert.ok(!products.PRODUCT_OWNED_KEYS.includes(kept), kept);
  for (const kept of ['address', 'addressId', 'billingAccount']) assert.ok(!products.PRODUCT_OWNED_KEYS.includes(kept), `${kept} is collected before the product, so it stays`);
  for (const dropped of ['msisdn', 'simType', 'productId', 'cart', 'caf', 'payment', 'installation']) assert.ok(products.PRODUCT_OWNED_KEYS.includes(dropped), dropped);
});

test('patchDraft changes values together and pulls progress back to the product step', () => {
  const { useWorkflowStore } = store;
  const id = 'test-wizard';
  useWorkflowStore.getState().clearDraft(id);
  const s = useWorkflowStore.getState();
  s.setFieldValue(id, 'product', 'prepaid');
  s.setFieldValue(id, 'msisdn', '+97433001001');
  s.setFieldValue(id, 'contact', { idNumber: 'X' });
  s.setStep(id, 7);
  assert.equal(useWorkflowStore.getState().getDraft(id).maxStepReached, 7);
  useWorkflowStore.getState().patchDraft(id, { set: { product: 'postpaid' }, unset: products.PRODUCT_OWNED_KEYS, progressTo: 1 });
  const d = useWorkflowStore.getState().getDraft(id);
  assert.equal(d.values.product, 'postpaid');
  assert.equal(d.values.msisdn, undefined);
  assert.deepEqual(d.values.contact, { idNumber: 'X' });
  assert.equal(d.maxStepReached, 1, 'progress is lowered, which setStep alone never does');
  assert.equal(d.currentStep, 1);
  useWorkflowStore.getState().clearDraft(id);
});

test('an offer for any of the four products continues in the wizard; an upgrade still hands off', () => {
  assert.deepEqual(Object.values(products.PRODUCT_OF_OFFER_JOURNEY).sort(), ['fixed-line', 'fixed-line', 'mnp', 'mnp', 'postpaid', 'prepaid']);
  for (const j of products.IN_JOURNEY_OFFERS) assert.equal(cross.continuesHere(j, products.IN_JOURNEY_OFFERS), true, j);
  assert.equal(cross.continuesHere('pre-to-post', products.IN_JOURNEY_OFFERS), false);
  assert.equal(cross.hasDestination('pre-to-post', products.IN_JOURNEY_OFFERS), true, 'an upgrade has a route to hand off to');
  assert.equal(products.mnpTypeOfOffer('mnp-prepaid'), 'prepaid');
});

// ---- eligibility: common scope at identification, product scope once a product is chosen -----------------------------------
test('identification reports only the checks common to every product; the product step reports the full set', () => {
  const ctx = {
    customer: { customerId: 'C', idType: 'Passport', dob: '1990-01-01', blacklisted: true, blacklistCategory: 'collections' },
    doc: { documentType: 'Passport', expiryDate: '2099-01-01' },
    deals: [], outstandingQar: 100, lineCapReached: true, activeLinesDetail: 'cap',
  };
  const common = engine.evaluateEligibilityChecks({ ...ctx, scope: 'common' }, new Date('2026-10-13')).map((c) => c.id);
  assert.deepEqual(common.sort(), ['age', 'blacklist-security', 'deals', 'id-validity']);
  const full = engine.evaluateEligibilityChecks({ ...ctx, scope: 'product' }, new Date('2026-10-13'));
  assert.ok(['id-type-routing', 'blacklist-collections', 'active-lines'].every((id) => full.some((c) => c.id === id)));
  assert.equal(full.find((c) => c.id === 'blacklist-collections').outcome, 'soft-stop', 'a collections block stops a postpaid product');
  const prepaid = engine.evaluateEligibilityChecks({ ...ctx, scope: 'product', journeyType: 'prepaid' }, new Date('2026-10-13'));
  assert.equal(prepaid.find((c) => c.id === 'blacklist-collections').outcome, 'pass', 'but not prepaid');
});

// ---- billing account: create one and make it the default ---------------------------------------------------------------
const run = async (billingValue, extra = {}) => {
  const created = [];
  const id = await billing.persistBillingAccount(billingValue, { createRecord: async (kind, rec) => void created.push({ kind, rec }), kind: 'Consumer Mobile Postpaid', customerId: 'CUST-1', idNumber: '2845', contactName: 'Test Customer', contactEmail: 't@example.qa', ...extra });
  return { id, created };
};

test('a customer with no billing account gets the new one created and set as the default', async () => {
  const { id, created } = await run({ creatingNew: true, newAccount: { profileName: 'Test - Postpaid', billCycleDay: 15, billMedia: 'Email' } }, { creditLimitQar: 1000 });
  const profile = created.find((c) => c.kind === 'billing-profiles').rec;
  const account = created.find((c) => c.kind === 'accounts').rec;
  assert.equal(id, profile.billingProfileId);
  assert.equal(profile.isDefault, true);
  assert.equal(profile.accountId, account.accountId);
  assert.equal(account.billingProfileId, profile.billingProfileId);
  assert.equal(account.accountType, 'Consumer Mobile Postpaid');
  assert.equal(account.customerId, 'CUST-1');
  assert.equal(profile.billingCycle, 'Monthly - Day 15');
  assert.equal(profile.creditLimitQAR, 1000);
});

test('an existing billing account is reused, and nothing is created when there is none to make', async () => {
  const existing = await run({ selectedProfileId: 'BILL-7001' });
  assert.equal(existing.id, 'BILL-7001');
  assert.equal(existing.created.length, 0);
  const none = await run(undefined);
  assert.equal(none.id, undefined);
  assert.equal(none.created.length, 0);
});

// ---- MNP in the same journey ----------------------------------------------------------------------------------------
const mnpValues = (over = {}) => withSignedForm({
  product: 'mnp', mnpType: 'postpaid',
  contact: { idNumber: '2845', email: 'a@example.qa', isB2B2C: false, moiResult: { name: 'Test Customer', email: 'a@example.qa' } },
  eligibility: { checks: [], customerId: 'CUST-1', defaultCreditLimitQar: 1000 },
  billingAccount: { creatingNew: true, newAccount: { profileName: 'Test - Postpaid', billCycleDay: 1 } },
  donorDetails: { portInNumber: '97466000666', donorId: 'P1', donorIdType: 'Passport', donorCustomerType: 'Individual', donorOperator: 'Ooredoo', donorSubscriptionType: 'Postpaid' },
  productId: 'PROD-104', simSerial: '8974412345678901234', simValid: true, comments: 'note',
  caf: { cafType: 'Digital', signatureDataUrl: 'data:image/png;base64,x' },
  checkoutTotals: { dueTodayQar: 0, monthlyRecurringQar: 350, hrnAdvanceQar: 0 },
  payment: { paid: true, method: 'Zero value', zeroValue: true, reference: 'RCPT-0-12345678' },
  ...over,
});
// The MNP Form is signed on the data the journey holds: its key is computed from the values, as the step does.
function withSignedForm(values) {
  const key = attach.mnpFormSnapshotKey(mnpSteps.mnpFormInputOf(values));
  return { ...values, donorAttachment: { mnpFormType: 'MNP-Digital', formNumber: 'MNPF-261001-000001', signed: true, signatureDataUrl: 'data:image/png;base64,x', snapshotKey: key } };
}
const submitMnp = async (values) => {
  const created = [];
  const updated = [];
  const confirmed = await mnp.submitMnpOrder(values, { createRecord: async (kind, rec) => void created.push({ kind, rec }), updateRecord: async (kind, idField, id, patch) => void updated.push({ kind, idField, id, patch }) });
  return { confirmed, created, updated, order: created.find((c) => c.kind === 'orders').rec };
};

test('MNP: a port request is Pending NPAS Approval, takes no payment, and a postpaid port-in gets a default billing account', async () => {
  const { confirmed, created, order } = await submitMnp(mnpValues());
  assert.equal(order.status, 'Pending NPAS Approval');
  assert.equal(confirmed.dueTodayQar, 0, 'nothing is due on a port-in with no HRN advance');
  assert.equal(confirmed.statusLabel, 'Pending NPAS Approval');
  assert.equal(confirmed.msisdn, '97466000666');
  const request = created.find((c) => c.kind === 'mnp-portin-orders').rec;
  assert.equal(request.donorOperator, 'Ooredoo');
  assert.equal(request.orderStatus, 'Pending NPAS Approval');
  assert.equal(request.portStatus, 'Pending Approval');
  assert.equal(request.trackingStatus, 'In Progress');
  assert.equal(request.simStatus, 'Reserved');
  assert.equal(request.paymentAmountQar, 0);
  assert.equal(request.receiptNumber, 'RCPT-0-12345678');
  assert.ok(confirmed.extraLines.some((l) => l.label === 'Zero-value receipt'));
  assert.equal(request.mnpFormNumber, 'MNPF-261001-000001');
  assert.equal(request.notifications[0].type, 'Submission');
  assert.ok(confirmed.trackAction.to.includes(request.id), 'the confirmation links to the request');
  assert.equal(order.billingProfileId, created.find((c) => c.kind === 'billing-profiles').rec.billingProfileId);
});

test('MNP: B2B2C postpaid goes for manager approval; prepaid has no billing account and ignores B2B2C', async () => {
  const b2b = await submitMnp(mnpValues({ contact: { ...mnpValues().contact, isB2B2C: true } }));
  assert.equal(b2b.order.status, 'Submitted for Approval');
  assert.equal(b2b.confirmed.pendingApproval, true);
  assert.equal(b2b.created.find((c) => c.kind === 'mnp-portin-orders').rec.orderStatus, 'Submitted', 'it reaches NPAS only after the manager approves');
  const prepaid = await submitMnp(mnpValues({ mnpType: 'prepaid', contact: { ...mnpValues().contact, isB2B2C: true }, discountId: 'ADO-7109' }));
  assert.equal(prepaid.order.status, 'Pending NPAS Approval');
  assert.equal(prepaid.order.orderType, 'MNP Prepaid Port-In');
  assert.ok(!prepaid.created.some((c) => c.kind === 'billing-profiles'));
});

// ---- New Home Connection: the same journey with the four home products ----------------------------------------------------
const homeKeys = (values) => conn.buildConnectionSteps({ ...ctx, journey: 'home' }).filter((s) => !s.skip?.(values)).map((s) => s.key);

test('New Home Connection: Identification, Product Selection, then the home steps - and nothing of the mobile products', () => {
  assert.deepEqual(homeKeys({}), ['contact', 'product']);
  assert.deepEqual(homeKeys({ product: 'fixed-line', homeProduct: 'fibre' }), ['contact', 'product', 'address', 'billingAccount', 'plan', 'number', 'checkout', 'caf', 'payment', 'appointment']);
  assert.ok(!homeKeys({ product: 'postpaid' }).includes('simType'), 'a mobile product is not part of the home journey');
  assert.deepEqual(homeKeys({ product: 'postpaid' }), ['contact', 'product']);
});

test('the four home products are Fibre, Fixed-Line, FWA and 5G Home, with no service type assumed for any', () => {
  assert.deepEqual(products.HOME_PRODUCTS.map((p) => p.key), ['fibre', 'fixed-line', 'fwa', '5g-home']);
  assert.deepEqual(products.HOME_PRODUCTS.map((p) => p.label), ['New Fibre Connection', 'New Fixed-Line Connection', 'New FWA Connection', 'New 5G Home Connection']);
  assert.equal(products.homeProductOfOffer('new-fwa'), 'fwa');
  assert.equal(products.homeProductOfOffer('new-fixed-line'), undefined, 'an offer for a fixed line does not say which home product');
});

test('Fixed Line\'s connection type is asked on its own step, not on Recommended Offers; New Home Connection still picks it on Product Selection', () => {
  const e = { scope: 'product', journeyType: 'postpaid', hardStop: false, softStop: false, checks: [] };
  const step = pstep.productStep(ctx);
  assert.equal(step.isValid({ product: 'fixed-line', eligibility: e }), true, 'Recommended Offers does not wait for the connection type');
  assert.equal(step.isValid({ product: 'postpaid', eligibility: { ...e, journeyType: 'postpaid' } }), true);
  const home = pstep.productStep({ ...ctx, journey: 'home' });
  assert.equal(home.isValid({ product: 'fixed-line', eligibility: e }), false, 'New Home Connection: no home product chosen yet');
  assert.equal(home.isValid({ product: 'fixed-line', homeProduct: '5g-home', eligibility: e }), true);
  assert.ok(products.PRODUCT_OWNED_KEYS.includes('homeProduct'));
});

test('Product Selection\'s position follows the steps before it: after Address and Billing, or just Address when the product has no billing profile', async () => {
  const pc = await load('/src/modules/new-connection/steps/productChoice.ts');
  assert.equal(pc.productStepIndex('connection', { product: 'postpaid' }), 3);
  assert.equal(pc.productStepIndex('connection', { product: 'prepaid' }), 2);
  assert.equal(pc.productStepIndex('connection', { product: 'mnp', mnpType: 'prepaid' }), 2);
  assert.equal(pc.productStepIndex('connection', { product: 'mnp', mnpType: 'postpaid' }), 3);
  assert.equal(pc.productStepIndex('home', { product: 'fixed-line' }), 1, 'New Home Connection has neither step');
  // The index points at the product step in the journey the steps really produce.
  for (const values of [{ product: 'postpaid' }, { product: 'prepaid' }, { product: 'mnp', mnpType: 'prepaid' }]) {
    assert.equal(activeKeys(values)[pc.productStepIndex('connection', values)], 'product', JSON.stringify(values));
  }
});
