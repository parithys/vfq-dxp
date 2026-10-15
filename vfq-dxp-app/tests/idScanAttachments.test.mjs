// The scan the agent captured at Contact is recorded on the order for every ID type, named for that type.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot, load, close } from './harness.mjs';

let fn;
before(async () => {
  await boot();
  ({ idScanAttachments: fn } = await load('/src/modules/new-connection/idScanAttachments.ts'));
});
after(close);

const both = { frontScanned: true, backScanned: true };

test('id scan attachments: every ID type is recorded under its own name', () => {
  for (const [type, name] of [['QID', 'Qatar ID (QID)'], ['Passport', 'Passport'], ['GCC ID', 'GCC ID'], ['Diplomatic ID', 'Diplomatic ID']]) {
    assert.deepEqual(fn(type, both).map((a) => a.label), [`${name} - Front`, `${name} - Back`]);
  }
});

test('id scan attachments: only the sides that were scanned are listed', () => {
  assert.deepEqual(fn('Passport', { frontScanned: true }).map((a) => a.label), ['Passport - Front']);
});

test('id scan attachments: no scan (manual entry) means no attachment', () => {
  assert.deepEqual(fn('Passport', undefined), []);
  assert.deepEqual(fn('GCC ID', {}), []);
});
