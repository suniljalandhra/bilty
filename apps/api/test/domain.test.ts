import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as domain from '../src/modules/bilty/domain';
import { actor, otherActor, id, now, later, company, completeData } from './fixtures';
const draft = () => domain.createDraft(id, actor, completeData(), now).bilty;
const issued = () => domain.issueBilty(draft(), 1, company, 'EX/0001', actor, later).bilty;

// These checks catch missing domain exports without hiding module import failures.
test('drafts remain unnumbered and preserve three e-way references and two invoices', () => {
  assert.equal(typeof domain.createDraft, 'function');
  const result = domain.createDraft(id, actor, completeData(), now);
  assert.equal(result.bilty.number, null);
  assert.equal(result.bilty.status, 'draft');
  assert.equal(result.bilty.data.ewayBills.length, 3);
  assert.equal(result.bilty.data.invoices.length, 2);
  assert.equal(result.event?.action, 'created');
});
test('partial drafts cannot bypass issue validation', () => {
  const b = domain.createDraft(
    id,
    actor,
    { consignor: { name: 'A' }, consignee: { name: 'B' } },
    now,
  ).bilty;
  assert.throws(() => domain.issueBilty(b, 1, company, 'EX/1', actor, later), /fromLocation/);
  assert.equal(b.status, 'draft');
  assert.equal(b.number, null);
});
test('duplicate and malformed e-way references are rejected even on draft save', () => {
  for (const ewayBills of [['123456789012', '123456789012'], ['123'], ['']])
    assert.throws(() => domain.createDraft(id, actor, { ewayBills }, now), /ewayBills/);
});
test('duplicate invoices and impossible invoice dates are rejected', () => {
  for (const invoices of [
    [{ number: 'INV' }, { number: 'inv' }],
    [{ number: 'INV', date: '2026-02-30' }],
  ])
    assert.throws(() => domain.createDraft(id, actor, { invoices }, now), /invoices/);
});
test('supplied negative, fractional and oversized money is rejected', () => {
  for (const freightPaise of [-1, 1.1, NaN, 100000000000])
    assert.throws(
      () => domain.createDraft(id, actor, { charges: { freightPaise } }, now),
      /charges/,
    );
  assert.throws(
    () =>
      domain.createDraft(
        id,
        actor,
        { charges: { freightPaise: 99999999999, loadingPaise: 1 } },
        now,
      ),
    /total/i,
  );
});
test('zero freight is allowed; zero and negative weight are not', () => {
  const data = completeData();
  data.charges.freightPaise = 0;
  assert.equal(
    domain.issueBilty(
      domain.createDraft(id, actor, data, now).bilty,
      1,
      company,
      'EX/1',
      actor,
      later,
    ).bilty.status,
    'issued',
  );
  for (const value of ['0', '-1', '1.0001'])
    assert.throws(
      () => domain.createDraft(id, actor, { actualWeight: { value, unit: 'kg' } }, now),
      /actualWeight/,
    );
});
test('print projection agrees on total, paise and separate measurements', () => {
  const p = domain.printData(issued());
  assert.equal(p.totalPaise, 15025);
  assert.equal(p.amountInWords, 'Rupees One hundred fifty and twenty-five paise only');
  assert.equal(p.data.actualWeight?.value, '313.200');
  assert.equal(p.data.chargeableWeight?.value, '320');
  assert.equal(p.data.volumeCbm, '1.08');
  assert.equal(p.data.invoices.length, 2);
});
test('issuance freezes company details and separates created/issued timestamps', () => {
  const profile = structuredClone(company),
    b = draft();
  const result = domain.issueBilty(b, 1, profile, 'EX/1', actor, later);
  profile.address = 'Changed';
  b.data.consignor.address = 'Changed';
  assert.equal(result.bilty.companySnapshot?.address, 'Delhi');
  assert.equal(result.bilty.data.consignor.address, 'Noida');
  assert.equal(result.bilty.createdAt, now);
  assert.equal(result.bilty.issuedAt, later);
});
test('address-only issued edit creates history and EDITED marker', () => {
  const b = issued(),
    data = structuredClone(b.data);
  data.consignor.address = 'New address';
  const result = domain.editBilty(b, 2, data, 'Correct address', actor, later);
  assert.equal(result.bilty.isEdited, true);
  assert.equal(result.bilty.version, 3);
  assert.equal(result.bilty.number, 'EX/0001');
  assert.equal(result.event?.before?.data.consignor.address, 'Noida');
  assert.equal(result.event?.after.data.consignor.address, 'New address');
  assert.equal(b.data.consignor.address, 'Noida');
});
test('unit, insurance and reference edits are audited, not just old selected fields', () => {
  for (const change of [
    (d: ReturnType<typeof draft>['data']) => {
      d.actualWeight!.unit = 'tonne';
    },
    (d: ReturnType<typeof draft>['data']) => {
      d.insurance.risk = 'Declared risk';
    },
    (d: ReturnType<typeof draft>['data']) => {
      d.ewayBills.pop();
    },
  ]) {
    const b = issued(),
      data = structuredClone(b.data);
    change(data);
    assert.equal(domain.editBilty(b, 2, data, 'Correction', actor, later).bilty.isEdited, true);
  }
});
test('issued edits require reason and cannot remove mandatory data', () => {
  const b = issued(),
    data = structuredClone(b.data);
  data.goodsDescription = '';
  assert.throws(() => domain.editBilty(b, 2, data, 'Correction', actor, later), /goodsDescription/);
  data.goodsDescription = 'Changed';
  assert.throws(() => domain.editBilty(b, 2, data, ' ', actor, later), /reason/i);
});
test('no-op edit creates no audit and no version increment', () => {
  const b = issued(),
    r = domain.editBilty(b, 2, b.data, '', actor, later);
  assert.equal(r.event, null);
  assert.equal(r.bilty.version, 2);
});
test('stale edits cannot overwrite newer versions', () => {
  const b = issued();
  assert.throws(() => domain.editBilty(b, 1, b.data, 'Correction', actor, later), /version/i);
});
test('cancel keeps permanent identity and is terminal', () => {
  const b = issued(),
    r = domain.cancelBilty(b, 2, 'Wrong consignment', actor, later);
  assert.equal(r.bilty.number, 'EX/0001');
  assert.equal(r.bilty.status, 'cancelled');
  assert.throws(() => domain.issueBilty(r.bilty, 3, company, 'EX/2', actor, later), /cancelled/i);
  assert.throws(
    () => domain.editBilty(r.bilty, 3, r.bilty.data, 'Correction', actor, later),
    /cancelled/i,
  );
  assert.throws(() => domain.cancelBilty(b, 2, ' ', actor, later), /reason/i);
});
test('cross-company operations fail even at the domain boundary', () => {
  const b = draft();
  assert.throws(() => domain.issueBilty(b, 1, company, 'EX/1', otherActor, later), /company/i);
});
test('repeating issuance returns original number without an extra event', () => {
  const b = issued(),
    r = domain.issueBilty(b, 1, company, 'EX/9999', actor, later);
  assert.equal(r.bilty.number, 'EX/0001');
  assert.equal(r.event, null);
});
test('unexpected fields and invalid enum values fail runtime validation', () => {
  assert.throws(() => domain.createDraft(id, actor, { number: 'injected' }, now), /number/);
  assert.throws(() => domain.createDraft(id, actor, { freightType: 'credit' }, now), /freightType/);
});
test('biltyLayout selection is frozen into company snapshot on issue', () => {
  const layoutCompany = { ...company, biltyLayout: 'modern-panels' as const };
  const b = domain.issueBilty(draft(), 1, layoutCompany, 'EX/1', actor, later).bilty;
  assert.equal(b.companySnapshot?.biltyLayout, 'modern-panels');
});
test('legacy company without biltyLayout freezes the classic default on issue', () => {
  const legacyCompany = { ...company };
  delete (legacyCompany as { biltyLayout?: string }).biltyLayout;
  const b = domain.issueBilty(draft(), 1, legacyCompany, 'EX/1', actor, later).bilty;
  assert.equal(b.companySnapshot?.biltyLayout, 'classic-grid');
  assert.equal(b.status, 'issued');
});
