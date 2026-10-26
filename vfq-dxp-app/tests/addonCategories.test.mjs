// The Add-ons & Discounts page: category tabs (Local Data, Local Minutes, International, Roaming, Combo, Others) and a Free / Paid filter that applies
// to the category selected. The expected catalogue is the business workbook Addons.xlsx, written out by hand below (name, category, pricing, QAR price),
// and checked against every add-on in products.json in both directions (nothing missing, nothing extra, nothing in the wrong category).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boot, load, close } from './harness.mjs';

let m;
before(async () => { await boot(); m = await load('/src/engines/addonCategories.ts'); });
after(close);

const addons = JSON.parse(fs.readFileSync('public/mock-data/products.json', 'utf8')).filter((p) => p.type === 'Add-on');

// From Addons.xlsx: productId -> [name, category, pricing, QAR price (0 where the workbook gives no fixed QR amount)].
const WORKBOOK = {
  'PROD-160': ["Data Booster", 'Local Data', 'paid', 20],
  'PROD-161': ["Data Booster", 'Local Data', 'paid', 50],
  'PROD-162': ["Data Add-on", 'Local Data', 'paid', 20],
  'PROD-163': ["Data Add-on", 'Local Data', 'paid', 20],
  'PROD-164': ["Data Add-on", 'Local Data', 'paid', 20],
  'PROD-165': ["5G Data Booster", 'Local Data', 'paid', 10],
  'PROD-166': ["5G Data Booster", 'Local Data', 'paid', 100],
  'PROD-167': ["Local Booster", 'Local Calls', 'paid', 20],
  'PROD-168': ["Local Add-on Essential", 'Local Calls', 'paid', 20],
  'PROD-169': ["Local Add-on Extra", 'Local Calls', 'paid', 20],
  'PROD-170': ["Local Minutes Plus", 'Local Calls', 'paid', 0],
  'PROD-171': ["International Booster", 'International Calls', 'paid', 20],
  'PROD-172': ["India Booster", 'International Calls', 'paid', 20],
  'PROD-173': ["Pakistan Booster", 'International Calls', 'paid', 20],
  'PROD-174': ["Philippines Booster", 'International Calls', 'paid', 20],
  'PROD-175': ["Bangladesh Booster", 'International Calls', 'paid', 20],
  'PROD-176': ["Egypt Add-on", 'International Calls', 'paid', 0],
  'PROD-177': ["Sri Lanka Add-on", 'International Calls', 'paid', 0],
  'PROD-178': ["Daily Passport Pack", 'Roaming', 'paid', 35],
  'PROD-179': ["Weekly Passport Pack", 'Roaming', 'paid', 100],
  'PROD-180': ["Monthly Passport Pack", 'Roaming', 'paid', 320],
  'PROD-181': ["GCC Roaming Pack", 'Roaming', 'paid', 150],
  'PROD-182': ["Roam Like Home Daily", 'Roaming', 'paid', 50],
  'PROD-183': ["Roam Like Home Weekly", 'Roaming', 'paid', 150],
  'PROD-184': ["Data and Local Combo", 'Combo', 'paid', 0],
  'PROD-185': ["Data and International Combo", 'Combo', 'paid', 0],
  'PROD-186': ["Sri Lanka Combo", 'Combo', 'paid', 10],
  'PROD-187': ["Sri Lanka Combo Plus", 'Combo', 'paid', 20],
  'PROD-188': ["Combo Plus Booster", 'Combo', 'paid', 0],
  'PROD-189': ["Vodafone World QR 30", 'Others', 'paid', 0],
  'PROD-190': ["Vodafone World QR 50", 'Others', 'paid', 0],
  'PROD-191': ["Vodafone World QR 100", 'Others', 'paid', 0],
  'PROD-192': ["Vodafone World QR 150", 'Others', 'paid', 0],
  'PROD-193': ["Mute Service", 'Others', 'paid', 0],
  'PROD-194': ["International Call Block", 'Others', 'paid', 0],
  'PROD-195': ["Multi SIM", 'Others', 'paid', 50],
  'PROD-196': ["Free Local Multi SIM", 'Others', 'free', 0],
  'PROD-197': ["Two Free Multi SIMs", 'Others', 'free', 0],
};
// The one add-on that pre-dates the workbook and is referenced by seeded orders.
const LEGACY = { 'PROD-101': ['International 50 Add-on', 'International Calls', 'paid', 50] };
// One SAMPLE add-on of each pricing model under Local Data and Local Calls (2026-10-26): not in the workbook, replaced when the real ones are given.
const SAMPLES = {
  'PROD-210': ['Welcome Data', 'Local Data', 'free', 0],
  'PROD-211': ['Plan Data Bonus', 'Local Data', 'free', 0],
  'PROD-212': ['Data Trial', 'Local Data', 'free', 25],
  'PROD-213': ['Data Booster Intro', 'Local Data', 'paid', 20],
  'PROD-214': ['Welcome Minutes', 'Local Calls', 'free', 0],
  'PROD-215': ['Plan Minutes Bonus', 'Local Calls', 'free', 0],
  'PROD-216': ['Local Calls Trial', 'Local Calls', 'free', 15],
  'PROD-217': ['Local Booster Intro', 'Local Calls', 'paid', 20],
};
const EXPECTED = { ...WORKBOOK, ...SAMPLES, ...LEGACY };
// Not in the postpaid catalogue: the prepaid-only add-on in the workbook.
const EXCLUDED_NAMES = ['Local Minutes Booster'];

test('the categories and the filter are exactly those asked for, in order, and the page opens on Paid', () => {
  assert.deepEqual([...m.ADDON_CATEGORIES], ['Local Data', 'Local Calls', 'International Calls', 'Roaming', 'Combo', 'Others']);
  assert.deepEqual(m.ADDON_PRICING_FILTERS.map((f) => f.label), ['Paid', 'Free']);
  assert.equal(m.DEFAULT_ADDON_PRICING, 'paid');
});

test('products.json holds exactly the workbook add-ons (plus the one legacy add-on): none missing, none extra, none prepaid-only', () => {
  assert.deepEqual(addons.map((a) => a.productId).sort(), Object.keys(EXPECTED).sort());
  for (const a of addons) {
    const [name, category, pricing, mrc] = EXPECTED[a.productId];
    assert.equal(a.name, name, a.productId);
    assert.equal(a.addonCategory, category, a.productId);
    assert.equal(m.addonCategoryOf(a), category, a.productId);
    assert.equal(m.isFreeAddon(a), pricing === 'free', a.productId);
    assert.equal(a.mrcQAR, mrc, a.productId);
  }
  assert.ok(!addons.some((a) => EXCLUDED_NAMES.includes(a.name)));
});

test('every add-on is listed under its own category only, and per category Free + Paid together are exactly its add-ons (conservation)', () => {
  let total = 0;
  for (const c of m.ADDON_CATEGORIES) {
    const free = m.addonsFor(addons, c, 'free');
    const paid = m.addonsFor(addons, c, 'paid');
    const expected = addons.filter((a) => EXPECTED[a.productId][1] === c).map((a) => a.productId).sort();
    assert.deepEqual([...free, ...paid].map((a) => a.productId).sort(), expected, c);
    assert.ok(expected.length > 0, `${c} has add-ons`);
    assert.ok(free.every((a) => EXPECTED[a.productId][2] === 'free') && paid.every((a) => EXPECTED[a.productId][2] === 'paid'));
    total += free.length + paid.length;
  }
  assert.equal(total, addons.length);
});

test('category sizes match the workbook, and Free holds only the add-ons included with a plan', () => {
  const size = (c, p) => m.addonsFor(addons, c, p).length;
  assert.deepEqual(Object.fromEntries(m.ADDON_CATEGORIES.map((c) => [c, size(c, 'free') + size(c, 'paid')])), { 'Local Data': 11, 'Local Calls': 8, 'International Calls': 8, Roaming: 6, Combo: 5, Others: 9 });
  assert.equal(size('Others', 'free'), 2);
  // Local Data and Local Calls hold one free add-on of each free model; the other categories hold none.
  assert.equal(size('Local Data', 'free'), 3);
  assert.equal(size('Local Calls', 'free'), 3);
  for (const c of m.ADDON_CATEGORIES.filter((c) => !['Others', 'Local Data', 'Local Calls'].includes(c))) assert.equal(size(c, 'free'), 0, c);
});

test('prices the workbook leaves open stay open: wording kept, never turned into a number, never Free', () => {
  const open = addons.filter((a) => a.priceLabel && a.pricing === 'paid');
  assert.ok(open.length >= 10);
  for (const a of open) assert.ok(a.mrcQAR === 0 || a.priceLabel === 'QR 50 per additional SIM', a.productId);
  assert.ok(open.some((a) => a.priceLabel === 'TBC'));
  assert.ok(open.some((a) => a.priceLabel === 'Plan-based'));
  for (const a of open) assert.equal(m.isFreeAddon(a), false, a.productId);
});

test('an add-on that states no known category is listed under Others, never dropped; negative prices are not free', () => {
  assert.equal(m.addonCategoryOf({ mrcQAR: 5 }), 'Others');
  assert.equal(m.addonCategoryOf({ mrcQAR: 5, addonCategory: 'Gaming' }), 'Others');
  assert.equal(m.addonsFor([{ mrcQAR: 5 }], 'Others', 'paid').length, 1);
  assert.equal(m.isFreeAddon({ mrcQAR: -1 }), false);
  assert.equal(m.isFreeAddon({ mrcQAR: 0 }), true, 'no statement: priced QAR 0 is Free');
  assert.equal(m.isFreeAddon({ mrcQAR: 0, pricing: 'paid' }), false, 'a stated Paid add-on with an open price is not Free');
});

test('the chosen add-ons are counted per category, across both filters', () => {
  const ids = Object.entries(EXPECTED);
  const pick = (cat, n) => ids.filter(([, v]) => v[1] === cat).slice(0, n).map(([id]) => id);
  const counts = m.selectedPerCategory(addons, [...pick('Local Data', 2), ...pick('Roaming', 1), ...pick('Others', 3)]);
  assert.deepEqual(counts, { 'Local Data': 2, 'Local Calls': 0, 'International Calls': 0, Roaming: 1, Combo: 0, Others: 3 });
});

test('the Add-ons page mounts the picker with the two levels: underline category tabs, then the Free / Paid filter', () => {
  const picker = fs.readFileSync('src/capabilities/AddonsSelection/AddonsPicker.tsx', 'utf8');
  assert.match(picker, /<TabStrip[\s\S]*ADDON_CATEGORIES\.map/);
  assert.match(picker, /<SegmentedTabs[\s\S]*ADDON_PRICING_FILTERS/);
  assert.ok(picker.indexOf('<TabStrip') < picker.indexOf('<SegmentedTabs'), 'categories first, the filter under them');
  assert.match(picker, /addonsFor\(addons, category, pricing\)/);
  assert.match(fs.readFileSync('src/components/patterns/PostpaidAddonsPanel.tsx', 'utf8'), /categorized/);
});

test('the catalogue status (Demo Only / TBC ...) is kept with the data and never displayed on the Add-ons page', () => {
  assert.ok(addons.some((a) => /Demo Only \/ TBC/.test(a.addonStatus ?? '')), 'the data still carries it');
  const picker = fs.readFileSync('src/capabilities/AddonsSelection/AddonsPicker.tsx', 'utf8');
  assert.doesNotMatch(picker, /\{a\.addonStatus/);
  assert.doesNotMatch(picker, /tint-pink-bg/);
});

test('open values are not displayed on the rows: no OPTIONAL / ADDED tag, no TBC / Plan-based / Plan-dependent price; a stated QAR amount still shows', () => {
  const picker = fs.readFileSync('src/capabilities/AddonsSelection/AddonsPicker.tsx', 'utf8');
  assert.doesNotMatch(picker, /'Added' : 'Optional'/);
  assert.match(picker, /a\.priceLabel && \/QR\\s\*\\d\/\.test\(a\.priceLabel\)/);
  const hiddenPrices = addons.filter((a) => a.pricing === 'paid' && a.priceLabel && !/QR\s*\d/.test(a.priceLabel)).map((a) => a.priceLabel);
  assert.ok(hiddenPrices.length >= 8);
  for (const l of hiddenPrices) assert.ok(/TBC|Plan-based|Plan-dependent/i.test(l), l);
  const shownPrices = addons.filter((a) => a.priceLabel && /QR\s*\d/.test(a.priceLabel)).map((a) => a.priceLabel);
  assert.deepEqual([...new Set(shownPrices)].sort(), ['QR 10 after promotional period', 'QR 50 per additional SIM']);
});

test('postpaid add-ons carry no validity: not in the data, not displayed (a postpaid add-on is monthly)', () => {
  for (const a of addons) assert.equal('validity' in a, false, a.productId);
  const picker = fs.readFileSync('src/capabilities/AddonsSelection/AddonsPicker.tsx', 'utf8');
  assert.doesNotMatch(picker, /[Vv]alidity/);
});

test('the five pricing models: free for all, free with the plan, free for 3 months; standard paid, introductory discount - each worded as asked', () => {
  const d = (a) => m.addonPriceDisplay(a);
  assert.deepEqual(d({ mrcQAR: 0, pricingModel: 'free-all' }), { primary: 'Free' });
  assert.deepEqual(d({ mrcQAR: 0, pricingModel: 'free-with-plan' }), { primary: 'Free', secondary: 'Included with the selected plan' });
  assert.deepEqual(d({ mrcQAR: 25, pricingModel: 'free-first-3' }), { primary: 'Free', secondary: 'for Months 1\u20133, then QAR 25/month from Month 4' });
  assert.deepEqual(d({ mrcQAR: 20, pricingModel: 'standard' }), { primary: 'QAR 20/mo' });
  assert.deepEqual(d({ mrcQAR: 20, introPriceQAR: 10, pricingModel: 'intro-discount' }), { primary: 'QAR 10/mo', secondary: 'for Months 1\u20133, then QAR 20/month from Month 4' });
  assert.equal(d({ mrcQAR: 20 }), undefined, 'a record with no model keeps its own wording');
  for (const model of ['free-all', 'free-with-plan', 'free-first-3']) assert.equal(m.isFreeAddon({ mrcQAR: 9, pricingModel: model }), true, model);
  for (const model of ['standard', 'intro-discount']) assert.equal(m.isFreeAddon({ mrcQAR: 0, pricingModel: model }), false, model);
  // over the data: every Local Data / Local Calls add-on states a model, except the one with an open price
  for (const a of addons.filter((x) => ['Local Data', 'Local Calls'].includes(x.addonCategory) && x.productId !== 'PROD-170')) assert.ok(a.pricingModel, a.productId);
  for (const a of addons.filter((x) => x.pricingModel === 'intro-discount')) assert.ok(a.introPriceQAR > 0 && a.introPriceQAR < a.mrcQAR, a.productId);
  for (const a of addons.filter((x) => x.pricingModel === 'free-with-plan')) assert.ok(a.eligibility?.plans?.length, a.productId);
});

test('the Paid | Free filter: Paid first and the default, owned by the page header and kept across category tabs', () => {
  const read = (f) => fs.readFileSync(f, 'utf8');
  assert.deepEqual(m.ADDON_PRICING_FILTERS.map((f) => f.key), ['paid', 'free']);
  const step = read('src/capabilities/PlanSelection/postpaidStep.tsx');
  assert.match(step, /headerAction: \(\{ values, setValue \}\)/);
  assert.match(step, /\(values\.addonPricing as AddonPricing \| undefined\) \?\? DEFAULT_ADDON_PRICING/);
  const picker = read('src/capabilities/AddonsSelection/AddonsPicker.tsx');
  assert.match(picker, /pricingProp === undefined && <SegmentedTabs/, 'the picker draws no filter of its own when the page owns it');
  assert.match(picker, /onPricingChange\?\.\(DEFAULT_ADDON_PRICING\)/, 'opens on Paid whenever the page is loaded');
  assert.doesNotMatch(picker, /setCategory\([^)]*\)[^;]*setPricing/, 'switching category does not touch the filter');
});
