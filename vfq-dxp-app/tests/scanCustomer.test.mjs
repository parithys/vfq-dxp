// A journey opened for a known customer (Change Postpaid Plan, Change Prepaid Pack, Add Add-On) scans THAT customer's document.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load, close } from './harness.mjs';

test('scan candidates are the acted-for customer\'s own documents, QID first', async () => {
  const { selectScanCandidates } = await load('/src/components/patterns/idLookupModel.ts');
  const docs = [
    { customerId: 'A', documentType: 'Passport', documentNumber: 'P1' },
    { customerId: 'B', documentType: 'QID', documentNumber: 'Q2' },
    { customerId: 'A', documentType: 'QID', documentNumber: 'Q1' },
  ];
  const own = docs.filter((d) => d.customerId === 'A');
  const out = selectScanCandidates({ docs, ownDocs: own, chosenType: undefined, detectable: ['QID', 'Passport'] });
  assert.deepEqual(out.map((d) => d.documentNumber), ['Q1', 'P1']);
});

test('known-customer journeys hand the customer to the scan, eligibility and barcode simulator', () => {
  const step = fs.readFileSync('src/capabilities/CustomerQualification/step.tsx', 'utf8');
  assert.equal((step.match(/existingCustomerId : actedForId/g) ?? []).length, 2);
  assert.match(fs.readFileSync('src/components/patterns/wizard/useJourneyStartResume.ts', 'utf8'), /LAUNCH_CUSTOMER_KEY\]: launchCustomerId/);
  assert.match(step, /values\[LAUNCH_CUSTOMER_KEY\]/);
  assert.match(fs.readFileSync('src/components/domain/QidInput.tsx', 'utf8'), /barcodeNumber \?\? BARCODE_DEMO_NUMBERS/);
});

test('scan and eligibility resolve the customer through the shared acted-for hook (context persists across sidebar launches)', () => {
  const read = (f) => fs.readFileSync(f, 'utf8');
  const hook = read('src/components/patterns/useActedForCustomer.ts');
  assert.match(hook, /if \(asNewCustomer\) return undefined;/);
  assert.match(hook, /explicitCustomerId \?\? contextCustomerId/);
  for (const f of ['src/components/patterns/useIdLookup.ts', 'src/capabilities/EligibilityGate/EligibilityGateStep.tsx']) {
    assert.match(read(f), /useActedForCustomer\(explicitCustomerId, asNewCustomer\)/, f);
  }
});

test.after(close);
