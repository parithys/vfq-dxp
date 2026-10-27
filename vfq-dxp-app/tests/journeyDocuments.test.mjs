// Additional Documents: the required documents come from the scenario and the role and are asked for once, at the end of the journey; every
// document the journey holds is listed there to view and download.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

globalThis.window ??= globalThis;
globalThis.window.addEventListener ??= () => {};
globalThis.window.removeEventListener ??= () => {};
const read = (p) => fs.readFileSync(p, 'utf8');
let jd;
before(async () => { await boot(); jd = await load('/src/engines/journeyDocuments.ts'); });
after(close);

test('a Waive Off requires its supporting document; no waiver, no requirement', () => {
  assert.deepEqual(jd.requiredDocumentsFor({ values: {}, journey: 'new-connection' }), []);
  for (const mode of ['partial', 'full']) {
    const r = jd.requiredDocumentsFor({ values: { numberWaiver: mode }, journey: 'new-connection' });
    assert.deepEqual(r.map((x) => x.id), ['waive-off-support']);
  }
  assert.deepEqual(jd.requiredDocumentsFor({ values: { numberWaiver: 'full' }, journey: 'prepaid' }), [], 'a journey that has no Waive Off is never asked');
});

test('an applicant under 18 requires the court order; unknown stays unknown', () => {
  const now = new Date();
  const dob = (years) => `01/01/${now.getFullYear() - years}`;
  assert.equal(jd.ageFromDob(dob(17), new Date(now.getFullYear(), 11, 31)), 17);
  const minor = jd.requiredDocumentsFor({ values: { contact: { moiResult: { dob: dob(16) } } } });
  assert.deepEqual(minor.map((x) => x.label), ['Court Type Order']);
  assert.deepEqual(jd.requiredDocumentsFor({ values: { contact: { moiResult: { dob: dob(30) } } } }), []);
  assert.deepEqual(jd.requiredDocumentsFor({ values: { contact: { moiResult: {} } } }), [], 'no date of birth on record: nothing is assumed');
  assert.equal(jd.ageFromDob('31/12/2000', new Date(2020, 11, 30)), 19);
  assert.equal(jd.ageFromDob('31/12/2000', new Date(2020, 11, 31)), 20);
  assert.equal(jd.ageFromDob('garbage'), undefined);
});

test('the consolidated list holds the ID scans, the evidence, the signature and the uploads, in order, only what exists', () => {
  assert.deepEqual(jd.consolidatedDocuments({}), []);
  const values = {
    contact: { idType: 'QID', qidScans: { frontScanned: true, backScanned: true, source: 'upload', frontImage: 'data:image/png;base64,AA==', backImage: 'data:image/png;base64,BB==', frontFile: 'f.png', backFile: 'b.png' } },
    customerType: { type: 'retired', officeId: { frontScanned: true, backScanned: true } },
    caf: { signatureDataUrl: 'data:image/png;base64,CC==' },
  };
  const docs = jd.consolidatedDocuments(values, [{ id: 'u1', label: 'Employer Letter', fileName: 'e.pdf' }]);
  assert.deepEqual(docs.map((d) => d.label), ['QID Document (Front)', 'QID Document (Back)', 'Retiree Supporting Document (Front)', 'Retiree Supporting Document (Back)', 'Signed CAF', 'Employer Letter']);
  assert.ok(docs[0].dataUrl && docs[4].dataUrl, 'an uploaded ID and the signature can be opened');
  assert.equal(docs[2].dataUrl, undefined, 'a capture the reader kept no image of has nothing to open');
  // a rejected benefit's evidence is not on the order
  assert.ok(!jd.consolidatedDocuments({ customerType: { type: 'mada', rejected: true, officeId: { frontScanned: true, backScanned: true } } }).length);
});

test('the requirements are asked for in Additional Documents after signing - not on the Waive Off dialog or the Number step - and hold Continue until uploaded', () => {
  const comp = read('src/components/domain/AdditionalDocumentsUpload.tsx');
  assert.match(comp, /aria-label="Required documents"/);
  assert.match(comp, /Documents on this order/);
  assert.match(comp, /openDocument\(dataUrl\)/);
  assert.match(comp, /downloadDocument\(dataUrl, name\)/);
  const cap = read('src/components/patterns/CafSignatureCapture.tsx');
  assert.match(cap, /disabled=\{documentsBlock\}/);
  assert.match(read('src/capabilities/CafSignature/step.tsx'), /requiredDocumentsFor\(\{ values, personaId/);
  assert.doesNotMatch(read('src/capabilities/NumberSelection/WaiveOff.tsx'), /type="file"|Upload/, 'no document is requested on the Waive Off dialog');
  assert.match(read('src/capabilities/NumberSelection/WaiveOff.tsx'), /asked for at the end of the journey, after the CAF is signed/);
});
