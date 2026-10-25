// The plan step offers only the Special Discount chosen at Customer Identification (never all three), the other discounts are untouched, and a
// customer holds one discount at a time. Expectations come from a table of what each discount type IS, checked over the whole discounts dataset.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

let model;
before(async () => { await boot(); model = await load('/src/components/patterns/postpaidPlanModel.ts'); });
after(close);

const all = JSON.parse(fs.readFileSync('public/mock-data/addons-discounts.json', 'utf8')).filter((d) => d.category === 'Discount');
// What each discount type in the data IS (independent of the model's own set): special = held through Customer Identification.
const SPECIAL = new Set(['MADA Discount', 'B2B2C Discount', 'Retired Discount']);
const CHOICE = { mada: 'MADA Discount', b2b2c: 'B2B2C Discount', retired: 'Retired Discount' };

test('every discount type in the data is classified, and the model agrees on which are special', () => {
  assert.ok(all.length > 3);
  assert.deepEqual([...model.SPECIAL_DISCOUNT_ADDON_TYPES].sort(), [...SPECIAL].sort());
  assert.ok([...SPECIAL].every((t) => all.some((d) => d.addonType === t)), 'each special type exists in the data');
});

test('a chosen special type keeps only itself among the special three, leaves the rest alone, and loses nothing else (conservation)', () => {
  for (const [key, type] of Object.entries(CHOICE)) {
    const out = model.discountsForSpecialType(all, key);
    assert.ok(out.length > 0);
    assert.deepEqual([...new Set(out.filter((d) => SPECIAL.has(d.addonType)).map((d) => d.addonType))].sort(), [type]);
    const others = all.filter((d) => !SPECIAL.has(d.addonType));
    assert.deepEqual(out.filter((d) => !SPECIAL.has(d.addonType)), others, 'non-special discounts are unchanged');
    const dropped = all.filter((d) => !out.includes(d));
    assert.ok(dropped.every((d) => SPECIAL.has(d.addonType) && d.addonType !== type), 'only other special types are removed');
    assert.equal(out.length + dropped.length, all.length);
  }
});

test('nothing chosen / unknown: the list is returned as it is', () => {
  assert.equal(model.discountsForSpecialType(all, undefined), all);
});

test('plan step: the special card is titled "Special Discount" and the hook applies the choice', () => {
  assert.equal(model.SPECIAL_DISCOUNT_CARD_TITLE, 'Special Discount');
  assert.match(fs.readFileSync('src/components/patterns/PostpaidDiscountsPanel.tsx', 'utf8'), /SPECIAL_DISCOUNT_ADDON_TYPES\.has\(d\.addonType\) \? SPECIAL_DISCOUNT_CARD_TITLE/);
  assert.match(fs.readFileSync('src/components/patterns/usePostpaidPlanAddons.ts', 'utf8'), /discountsForSpecialType\(discountsForCustomer\(/);
});
