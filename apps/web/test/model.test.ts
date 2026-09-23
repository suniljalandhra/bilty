import assert from 'node:assert/strict';
import test from 'node:test';
import {
  blankBilty,
  blankCompany,
  parseRupees,
  paiseInput,
  reconcileData,
} from '../src/lib/model.ts';

test('currency input converts decimal rupees to exact paise and preserves empty freight', () => {
  assert.equal(parseRupees('0.29'), 29);
  assert.equal(parseRupees('999999999.99'), 99999999999);
  assert.equal(parseRupees('0001.2'), 120);
  assert.equal(parseRupees(''), null);
  assert.equal(paiseInput(29), '0.29');
  assert.equal(paiseInput(null), '');
  for (const bad of ['1.001', '-1', 'NaN', '1e3', '1000000000', '.']) {
    assert.throws(() => parseRupees(bad), /rupee/);
  }
});

test('reconciliation preserves all reference rows and independent latest edits', () => {
  const original = blankBilty();
  original.ewayBills = ['012345678901', '123456789012'];
  original.invoices = [
    { number: 'A', date: null, declaredValuePaise: 1 },
    { number: 'B', date: '2026-09-21', declaredValuePaise: 239 },
  ];
  const mine = structuredClone(original);
  mine.driverName = 'Driver';
  const latest = structuredClone(original);
  latest.chargeableWeight = { value: '3.125', unit: 'tonne' };
  const result = reconcileData(original, mine, latest);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.data.driverName, 'Driver');
  assert.deepEqual(result.data.chargeableWeight, latest.chargeableWeight);
  assert.deepEqual(result.data.ewayBills, original.ewayBills);
  assert.deepEqual(result.data.invoices, original.invoices);
  assert.deepEqual(Object.keys(result.data).sort(), Object.keys(original).sort());
});

test('reconciliation flags competing edits and does not silently replace either document', () => {
  const original = blankBilty();
  const mine = structuredClone(original),
    latest = structuredClone(original);
  mine.remarks = 'Local';
  latest.remarks = 'Remote';
  const result = reconcileData(original, mine, latest);
  assert.deepEqual(result.conflicts, ['remarks']);
  assert.equal(result.data.remarks, 'Local');
  assert.equal(latest.remarks, 'Remote');
});

test('new companies start with the Classic Grid layout', () => {
  assert.equal(blankCompany().biltyLayout, 'classic-grid');
});
