import 'reflect-metadata';
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { makeDataSource } from '../src/database/data-source';
import { BiltyService } from '../src/modules/bilty/bilty.service';
import { actor, otherActor, company, companyId, otherCompanyId, completeData } from './fixtures';

const url = process.env.BILTY_TEST_DATABASE_URL;
if (!url || process.env.BILTY_TEST_ALLOW_RESET !== 'yes')
  throw new Error(
    'Provide a disposable BILTY_TEST_DATABASE_URL and BILTY_TEST_ALLOW_RESET=yes; this suite resets its public schema.',
  );
const db = makeDataSource(url);
let service: BiltyService;
before(async () => {
  await db.initialize();
  await db.query('DROP SCHEMA public CASCADE');
  await db.query('CREATE SCHEMA public');
  await db.runMigrations();
  service = new BiltyService(db);
});
after(async () => {
  if (db.isInitialized) await db.destroy();
});
beforeEach(async () => {
  await db.query('TRUNCATE bilty_audit, biltys, parties, memberships, companies CASCADE');
  for (const [id, userId] of [
    [companyId, actor.userId],
    [otherCompanyId, otherActor.userId],
  ]) {
    await db.query('INSERT INTO companies(id,profile,number_prefix) VALUES($1,$2,$3)', [
      id,
      company,
      'EX/',
    ]);
    await db.query("INSERT INTO memberships(user_id,company_id,role) VALUES($1,$2,'employee')", [
      userId,
      id,
    ]);
  }
});
test('migration can be reverted and reapplied on an empty database', async () => {
  await db.undoLastMigration();
  await db.runMigrations();
  const rows = await db.query('SELECT * FROM biltys');
  assert.equal(rows.length, 0);
});
test('draft, issue, edit and cancel persist snapshots and full audit', async () => {
  const b = await service.createDraft(actor, completeData());
  const issued = await service.issue(actor, b.id, b.version);
  assert.equal(issued.number, 'EX/0001');
  const data = structuredClone(issued.data);
  data.consignee.address = 'Corrected address';
  const edited = await service.edit(actor, b.id, issued.version, data, 'Correct address');
  assert.equal(edited.isEdited, true);
  const cancelled = await service.cancel(actor, b.id, edited.version, 'Customer cancelled');
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.number, 'EX/0001');
  const audit = await service.history(actor, b.id);
  assert.deepEqual(
    audit.map((e) => e.action),
    ['created', 'issued', 'edited', 'cancelled'],
  );
  assert.equal(audit[2]?.before?.data.consignee.address, 'Mumbai');
  assert.equal(audit[2]?.after.data.consignee.address, 'Corrected address');
  assert.deepEqual(await service.get(actor, b.id), cancelled);
  await assert.rejects(() => service.issue(actor, b.id, cancelled.version), /cancelled/i);
});
test('company scope denies read, history, edit, issue, cancel and list leakage', async () => {
  const b = await service.createDraft(actor, completeData());
  await assert.rejects(() => service.get(otherActor, b.id), /not found/i);
  await assert.rejects(() => service.history(otherActor, b.id), /not found/i);
  await assert.rejects(() => service.edit(otherActor, b.id, 1, b.data, 'Change'), /not found/i);
  await assert.rejects(() => service.issue(otherActor, b.id, 1), /not found/i);
  await assert.rejects(() => service.cancel(otherActor, b.id, 1, 'Change'), /not found/i);
  assert.equal((await service.list(otherActor)).length, 0);
});
test('revoked membership and forged company context deny access', async () => {
  const b = await service.createDraft(actor, completeData());
  await assert.rejects(
    () => service.get({ ...actor, companyId: otherCompanyId }, b.id),
    /membership/i,
  );
  await db.query('UPDATE memberships SET active=false WHERE user_id=$1', [actor.userId]);
  await assert.rejects(() => service.get(actor, b.id), /membership/i);
  await assert.rejects(() => service.createDraft(actor, completeData()), /membership/i);
});
test('cross-company or wrong-role party references cannot be linked', async () => {
  const partyId = randomUUID();
  await db.query("INSERT INTO parties(id,company_id,kind,snapshot) VALUES($1,$2,'consignee',$3)", [
    partyId,
    otherCompanyId,
    { name: 'Foreign' },
  ]);
  await assert.rejects(
    () =>
      service.createDraft(actor, { ...completeData(), consignor: { partyId, name: 'Foreign' } }),
    /party/i,
  );
  await db.query('UPDATE parties SET company_id=$1 WHERE id=$2', [companyId, partyId]);
  await assert.rejects(
    () =>
      service.createDraft(actor, { ...completeData(), consignor: { partyId, name: 'Wrong role' } }),
    /party/i,
  );
  assert.equal((await service.list(actor)).length, 0);
});
test('issued company and party snapshots survive source changes', async () => {
  const partyId = randomUUID();
  await db.query("INSERT INTO parties(id,company_id,kind,snapshot) VALUES($1,$2,'consignor',$3)", [
    partyId,
    companyId,
    { name: 'Saved sender', address: 'Old address' },
  ]);
  const b = await service.createDraft(actor, {
    ...completeData(),
    consignor: { partyId, name: 'Saved sender', address: 'Old address' },
  });
  const issued = await service.issue(actor, b.id, 1);
  await db.query('UPDATE companies SET profile=$1 WHERE id=$2', [
    { ...company, address: 'New company address' },
    companyId,
  ]);
  await db.query('UPDATE parties SET snapshot=$1 WHERE id=$2', [
    { name: 'Renamed', address: 'New address' },
    partyId,
  ]);
  const loaded = await service.get(actor, b.id);
  assert.equal(loaded.companySnapshot?.address, 'Delhi');
  assert.equal(loaded.data.consignor.address, 'Old address');
  assert.deepEqual(loaded, issued);
});
test('simultaneous issuances allocate unique numbers across database connections', async () => {
  const drafts = await Promise.all(
    Array.from({ length: 12 }, () => service.createDraft(actor, completeData())),
  );
  const records = await Promise.all(drafts.map((b) => service.issue(actor, b.id, 1)));
  assert.equal(new Set(records.map((b) => b.number)).size, 12);
  assert.deepEqual(
    records.map((b) => b.number).sort(),
    Array.from({ length: 12 }, (_, i) => 'EX/' + String(i + 1).padStart(4, '0')),
  );
  const rows = await db.query('SELECT next_number FROM companies WHERE id=$1', [companyId]);
  assert.equal(rows[0].next_number, '13');
});
test('concurrent retries issue the same draft only once', async () => {
  const b = await service.createDraft(actor, completeData());
  const records = await Promise.all(Array.from({ length: 8 }, () => service.issue(actor, b.id, 1)));
  assert.ok(records.every((r) => r.number === 'EX/0001' && r.version === 2));
  assert.equal((await service.history(actor, b.id)).length, 2);
  const rows = await db.query('SELECT next_number FROM companies WHERE id=$1', [companyId]);
  assert.equal(rows[0].next_number, '2');
});
test('invalid issuance rolls back without consuming a number or adding history', async () => {
  const bad = await service.createDraft(actor, { consignor: { name: 'A' } });
  await assert.rejects(() => service.issue(actor, bad.id, 1), /Required before issue/);
  assert.equal((await service.get(actor, bad.id)).status, 'draft');
  assert.equal((await service.history(actor, bad.id)).length, 1);
  const good = await service.createDraft(actor, completeData());
  assert.equal((await service.issue(actor, good.id, 1)).number, 'EX/0001');
});
test('database uniqueness conflict rolls back number allocation and document update', async () => {
  const a = await service.createDraft(actor, completeData());
  await service.issue(actor, a.id, 1);
  await db.query('UPDATE companies SET next_number=1 WHERE id=$1', [companyId]);
  const b = await service.createDraft(actor, completeData());
  await assert.rejects(() => service.issue(actor, b.id, 1));
  assert.equal((await service.get(actor, b.id)).number, null);
  assert.equal((await service.history(actor, b.id)).length, 1);
  const rows = await db.query('SELECT next_number FROM companies WHERE id=$1', [companyId]);
  assert.equal(rows[0].next_number, '1');
});
test('competing edits reject stale version instead of losing data', async () => {
  const b = await service.createDraft(actor, completeData());
  const results = await Promise.allSettled([
    service.edit(actor, b.id, 1, { ...b.data, remarks: 'First' }, ''),
    service.edit(actor, b.id, 1, { ...b.data, remarks: 'Second' }, ''),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
  assert.equal((await service.get(actor, b.id)).version, 2);
  assert.equal((await service.history(actor, b.id)).length, 2);
});
