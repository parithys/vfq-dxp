// The HRN advance ("Upfront Payment Required") is announced as an info toast; no other eligibility check takes that treatment.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

let m;
before(async () => { await boot(); m = await load('/src/components/domain/eligibilityRowsModel.ts'); });
after(close);

const check = (id, outcome) => ({ id, label: id, message: `${id} ${outcome}`, outcome });

test('only the HRN advance row is the upfront-payment row; every other outcome and the non-HRN pass row are not', () => {
  const hrnRows = m.buildEligibilityRows([], true, 'Pakistani', 'postpaid', false, true);
  const upfront = hrnRows.filter(m.isUpfrontPaymentRow);
  assert.equal(upfront.length, 1);
  assert.equal(upfront[0].title, 'Upfront Payment Required');
  assert.match(upfront[0].detail, /advance payment/i);
  // Not HRN: the "Non-HRN new account" pass row is not the upfront row.
  assert.equal(m.buildEligibilityRows([], false, 'Qatari', 'postpaid', false, true).filter(m.isUpfrontPaymentRow).length, 0);
  // Every other outcome, alongside an HRN customer, keeps its own row and is never mistaken for the upfront row.
  for (const outcome of ['hard-stop', 'soft-stop', 'approval-routing', 'advisory', 'pass']) {
    const rows = m.buildEligibilityRows([check('X-1', outcome)], true, 'Pakistani', 'postpaid', false, true);
    const other = rows.find((r) => r.id === 'X-1');
    assert.ok(other, outcome);
    assert.equal(m.isUpfrontPaymentRow(other), false, outcome);
    assert.equal(rows.filter(m.isUpfrontPaymentRow).length, 1, outcome);
  }
});

test('the step announces the upfront payment as an info toast, hides that one row from the list, and leaves every other row listed', () => {
  const src = fs.readFileSync('src/capabilities/EligibilityGate/EligibilityGateStep.tsx', 'utf8');
  assert.match(src, /pushToast\('info', UPFRONT_PAYMENT_TITLE/);
  assert.match(src, /row\.tone !== 'pass' && !isUpfrontPaymentRow\(row\)/);
  // No blanket treatment: the step does not push an info toast for rows in general.
  assert.equal((src.match(/pushToast\('info'/g) ?? []).length, 1);
});
