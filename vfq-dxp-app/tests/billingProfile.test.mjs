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
