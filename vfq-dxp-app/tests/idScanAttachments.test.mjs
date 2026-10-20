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

test('uploading the ID in place of scanning: files are checked once for every ID type, and the order attachments say "Uploaded"', async () => {
  const up = await load('/src/components/domain/idUploadModel.ts');
  assert.equal(up.idFileProblem({ name: 'front.png', size: 1000 }), null);
  assert.equal(up.idFileProblem({ name: 'back.JPG', size: 1000 }), null);
  assert.equal(up.idFileProblem({ name: 'scan.pdf', size: 1000 }), null);
  assert.match(up.idFileProblem({ name: 'id.gif', size: 10 }), /only PDF, JPG or PNG/);
  assert.match(up.idFileProblem({ name: 'big.pdf', size: 6 * 1024 * 1024 }), /larger than 5 MB/);
  assert.match(up.idFileProblem({ name: 'empty.png', size: 0 }), /empty/);
  const fn = (await load('/src/modules/new-connection/idScanAttachments.ts')).idScanAttachments;
  for (const type of ['QID', 'Passport', 'GCC ID', 'Diplomatic ID']) {
    assert.ok(fn(type, { frontScanned: true, backScanned: true, source: 'upload' }).every((a) => a.detail === 'Uploaded during Contact'), type);
    assert.ok(fn(type, { frontScanned: true, backScanned: true }).every((a) => a.detail === 'Scanned during Contact'), type);
  }
});

test('the ways an ID arrives as an upload: two files, one file with both sides (image or PDF), one side at a time', async () => {
  const up = await load('/src/components/domain/idUploadModel.ts');
  const att = (await load('/src/modules/new-connection/idScanAttachments.ts')).idScanAttachments;
  const front = { name: 'front.jpg', image: 'data:image/jpeg;base64,F' };
  const back = { name: 'back.jpg', image: 'data:image/jpeg;base64,B' };
  const pdf = { name: 'Parithimal-QID.pdf' };

  // 1. Two files, front then back: complete, each side from its own file.
  const pair = up.applyIdUpload({}, { sides: 'pair', files: [front, back] });
  assert.deepEqual([pair.frontScanned, pair.backScanned, pair.combined, pair.source], [true, true, false, 'upload']);
  assert.deepEqual([pair.frontImage, pair.backImage, pair.frontFile, pair.backFile], [front.image, back.image, 'front.jpg', 'back.jpg']);
  assert.equal(up.missingUploadSide(pair), null);

  // 2. One image showing both sides: complete, one file stands for both.
  const both = up.applyIdUpload({}, { sides: 'both', files: [front] });
  assert.deepEqual([both.frontScanned, both.backScanned, both.combined], [true, true, true]);
  assert.equal(both.frontFile, both.backFile);

  // 3. One PDF showing both sides: complete, with no preview image to draw.
  const fromPdf = up.applyIdUpload({}, { sides: 'both', files: [pdf] });
  assert.deepEqual([fromPdf.frontScanned, fromPdf.backScanned, fromPdf.frontImage], [true, true, undefined]);
  assert.deepEqual(att('QID', fromPdf).map((a) => a.label), ['Qatar ID (QID) - Front', 'Qatar ID (QID) - Back']);
  assert.ok(att('QID', fromPdf).every((a) => a.detail === 'Uploaded during Contact: Parithimal-QID.pdf'));

  // 4. One side only: recorded alone, the other side is asked for, and the document completes when it arrives - in either order.
  const frontOnly = up.applyIdUpload({}, { sides: 'front', files: [front] });
  assert.deepEqual([frontOnly.frontScanned, frontOnly.backScanned], [true, false]);
  assert.equal(up.missingUploadSide(frontOnly), 'back');
  assert.deepEqual(att('QID', frontOnly).map((a) => a.label), ['Qatar ID (QID) - Front'], 'no row for a side not provided');
  const done = up.applyIdUpload(frontOnly, { sides: 'back', files: [back] });
  assert.deepEqual([done.frontScanned, done.backScanned, done.frontFile, done.backFile], [true, true, 'front.jpg', 'back.jpg']);
  assert.equal(up.missingUploadSide(done), null);
  const backFirst = up.applyIdUpload({}, { sides: 'back', files: [back] });
  assert.equal(up.missingUploadSide(backFirst), 'front');
  assert.equal(up.applyIdUpload(backFirst, { sides: 'front', files: [front] }).frontScanned, true);

  // A capture that came from the reader is replaced whole by an upload, never mixed with it.
  const scanned = { frontScanned: true, backScanned: true, source: 'scan', frontImage: 'x', backImage: 'y' };
  const replaced = up.applyIdUpload(scanned, { sides: 'front', files: [front] });
  assert.deepEqual([replaced.frontScanned, replaced.backScanned, replaced.backImage], [true, false, undefined]);
  // An empty result changes nothing.
  assert.equal(up.applyIdUpload(pair, { sides: 'both', files: [] }), pair);
});

test('two files picked together: their names decide which is the front, else the order picked, and the sides can be swapped', async () => {
  const up = await load('/src/components/domain/idUploadModel.ts');
  const names = (files) => up.orderPair(files).map((f) => f.name);
  // The picker lists "…-Back" before "…-Front": the names win.
  assert.deepEqual(names([{ name: 'Parithimal-QID-Back.Jpeg' }, { name: 'Parithimal-QID-Front.Jpeg' }]), ['Parithimal-QID-Front.Jpeg', 'Parithimal-QID-Back.Jpeg']);
  assert.deepEqual(names([{ name: 'front.png' }, { name: 'back.png' }]), ['front.png', 'back.png']);
  // One name is enough; no name says nothing, so the order picked stands.
  assert.deepEqual(names([{ name: 'id-back.pdf' }, { name: 'scan2.pdf' }]), ['scan2.pdf', 'id-back.pdf']);
  assert.deepEqual(names([{ name: 'a.png' }, { name: 'b.png' }]), ['a.png', 'b.png']);
  assert.deepEqual(names([{ name: 'front-and-back.png' }, { name: 'b.png' }]), ['front-and-back.png', 'b.png'], 'a name with both words says nothing');
  const pair = up.applyIdUpload({}, { sides: 'pair', files: [{ name: 'x-Back.jpg', image: 'B' }, { name: 'x-Front.jpg', image: 'F' }] });
  assert.deepEqual([pair.frontImage, pair.backImage, pair.frontFile, pair.backFile], ['F', 'B', 'x-Front.jpg', 'x-Back.jpg']);
  const swapped = up.swapUploadedSides(pair);
  assert.deepEqual([swapped.frontImage, swapped.backImage, swapped.frontFile, swapped.backFile], ['B', 'F', 'x-Back.jpg', 'x-Front.jpg']);
});

test('an uploaded pair already stored the wrong way round (by its file names) is recognised so it can be put right', async () => {
  const up = await load('/src/components/domain/idUploadModel.ts');
  const wrong = { source: 'upload', frontFile: 'Parithimal-QID-Back.Jpeg', backFile: 'Parithimal-QID-Front.Jpeg' };
  assert.equal(up.uploadedSidesInverted(wrong), true);
  assert.equal(up.uploadedSidesInverted(up.swapUploadedSides(wrong)), false);
  assert.equal(up.uploadedSidesInverted({ source: 'upload', frontFile: 'a.png', backFile: 'b.png' }), false, 'names that say nothing are left alone');
  assert.equal(up.uploadedSidesInverted({ source: 'upload', combined: true, frontFile: 'x.pdf', backFile: 'x.pdf' }), false);
  assert.equal(up.uploadedSidesInverted({ source: 'scan', frontFile: 'back.png', backFile: 'front.png' }), false);
  // The agent's own swap (or the names at upload) settles it: it is never undone by the check.
  assert.equal(up.uploadedSidesInverted(up.swapUploadedSides(wrong)), false);
  assert.equal(up.uploadedSidesInverted(up.swapUploadedSides(up.swapUploadedSides(wrong))), false, 'swapping back is also the agent\'s choice');
  const uploaded = up.applyIdUpload({}, { sides: 'pair', files: [{ name: 'x-Back.jpg' }, { name: 'x-Front.jpg' }] });
  assert.equal(up.uploadedSidesInverted(uploaded), false);
});

test('removing an uploaded file: one side leaves the other and asks for it again; a both-sides file or the last file clears the upload', async () => {
  const up = await load('/src/components/domain/idUploadModel.ts');
  const f = { name: 'front.jpg', image: 'F' };
  const b = { name: 'back.jpg', image: 'B' };
  const pair = up.applyIdUpload({}, { sides: 'pair', files: [f, b] });
  const noBack = up.removeIdUpload(pair, 'back');
  assert.deepEqual([noBack.frontScanned, noBack.backScanned, noBack.frontFile, noBack.backFile, noBack.backImage], [true, false, 'front.jpg', undefined, undefined]);
  assert.equal(up.missingUploadSide(noBack), 'back', 'the removed side is asked for again');
  const noFront = up.removeIdUpload(pair, 'front');
  assert.deepEqual([noFront.frontScanned, noFront.backScanned, noFront.backFile], [false, true, 'back.jpg']);
  assert.equal(up.missingUploadSide(noFront), 'front');
  // Removing the only remaining side leaves nothing.
  const empty = up.removeIdUpload(noBack, 'front');
  assert.deepEqual([empty.frontScanned, empty.backScanned, empty.source, empty.frontFile], [false, false, undefined, undefined]);
  // A file that showed both sides is removed whole, whichever side is named.
  const both = up.applyIdUpload({}, { sides: 'both', files: [{ name: 'x.pdf' }] });
  assert.deepEqual([up.removeIdUpload(both, 'front').frontScanned, up.removeIdUpload(both, 'back').backScanned, up.removeIdUpload(both, 'back').combined], [false, false, undefined]);
  assert.equal(up.removeIdUpload(pair, 'all').source, undefined);
  // The same upload can then be redone from nothing.
  assert.equal(up.applyIdUpload(up.removeIdUpload(pair, 'all'), { sides: 'both', files: [{ name: 'y.pdf' }] }).combined, true);
});

test('every journey that identifies the customer records the ID document it captured (scanned or uploaded) on its order', async () => {
  const fsm = await import('node:fs');
  for (const f of [
    'src/modules/new-connection/submitNewConnectionOrder.ts',
    'src/modules/mobile-prepaid/screens/submitPrepaidOrder.ts',
    'src/modules/mnp-fnp-porting/screens/submitMnpOrder.ts',
    'src/modules/fixed-line-fibre/fixedActivation/submitFixedActivationOrder.ts',
    'src/modules/pre-to-post-migration/screens/submitPreToPostOrder.ts',
  ]) {
    const src = fsm.readFileSync(f, 'utf8');
    assert.match(src, /idScanAttachments\(contact\??\.idType, contact\??\.qidScans\)/, `${f} records the ID document`);
  }
});
