import 'reflect-metadata';
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/modules/auth/auth.service';
import { BiltyService } from '../src/modules/bilty/bilty.service';
import { ShareService } from '../src/modules/print/share.service';
import { actorOf, type Principal } from '../src/modules/auth/access';
import { config, google, testDatabase, resetDatabase } from './auth-fixtures';
import { completeData } from './fixtures';
const db = testDatabase(),
  auth = new AuthService(db, config, google),
  biltys = new BiltyService(db),
  shares = new ShareService(db, config);
let a: Principal, b: Principal;
before(() => resetDatabase(db));
after(async () => {
  if (db.isInitialized) await db.destroy();
});
beforeEach(async () => {
  await db.query('TRUNCATE users, companies, oauth_states CASCADE');
  for (const email of ['a@example.com', 'b@example.com']) {
    const f = await auth.beginLogin();
    const p = new URL(f.url).searchParams;
    const t = await auth.finishLogin(
      p.get('state')!,
      f.browserToken,
      JSON.stringify({ sub: email, email, email_verified: true, nonce: p.get('nonce') }),
    );
    await auth.onboard(await auth.authenticate(t.accessToken), {
      profile: { name: 'Transport' },
      numberPrefix: 'SH/',
    });
    const user = await auth.authenticate(t.accessToken);
    if (email[0] === 'a') a = user;
    else b = user;
  }
});
async function issued() {
  const d = await biltys.createDraft(actorOf(a), completeData());
  return biltys.issue(actorOf(a), d.id, 1);
}
test('only issued same-company documents can be shared; tokens are hashed', async () => {
  const draft = await biltys.createDraft(actorOf(a), {});
  await assert.rejects(() =>
    shares.create(a, draft.id, { expiresInHours: 1, format: 'a4', copy: 'office' }),
  );
  const doc = await issued();
  await assert.rejects(() =>
    shares.create(b, doc.id, { expiresInHours: 1, format: 'a4', copy: 'office' }),
  );
  const share = await shares.create(a, doc.id, { expiresInHours: 1, format: 'a4', copy: 'driver' });
  assert.equal(share.version, 2);
  const token = new URL(share.url).pathname.split('/').pop()!;
  const stored = await db.query('SELECT token_hash FROM bilty_shares');
  assert.match(stored[0].token_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(stored[0].token_hash, token);
  const result = await shares.resolve(token);
  assert.equal(result.record.number, 'SH/0001');
});
test('shared version stays fixed across edits and cancellation disables every link', async () => {
  const doc = await issued();
  const share = await shares.create(a, doc.id, {
    expiresInHours: 1,
    format: 'thermal',
    copy: 'consignee',
  });
  const token = new URL(share.url).pathname.split('/').pop()!;
  const edited = await biltys.edit(
    actorOf(a),
    doc.id,
    2,
    { ...doc.data, remarks: 'Changed after sharing' },
    'Correction',
  );
  assert.equal((await shares.resolve(token)).record.data.remarks, '');
  await biltys.cancel(actorOf(a), doc.id, edited.version, 'Cancelled');
  await assert.rejects(() => shares.resolve(token));
});
test('sharing supports revocation, expiry and tenant-scoped listing', async () => {
  const doc = await issued();
  const share = await shares.create(a, doc.id, { expiresInHours: 1, format: 'a4', copy: 'office' });
  const token = new URL(share.url).pathname.split('/').pop()!;
  await assert.rejects(() => shares.list(b, doc.id));
  await assert.rejects(() => shares.revoke(b, doc.id, share.id));
  await shares.revoke(a, doc.id, share.id);
  await assert.rejects(() => shares.resolve(token));
  const next = await shares.create(a, doc.id, { expiresInHours: 1, format: 'a4', copy: 'office' });
  await db.query("UPDATE bilty_shares SET expires_at=now()-interval '1 second'");
  await assert.rejects(() => shares.resolve(new URL(next.url).pathname.split('/').pop()!));
});
test('concurrent cancellation cannot leave an accessible share', async () => {
  const doc = await issued();
  const results = await Promise.allSettled([
    shares.create(a, doc.id, { expiresInHours: 1, format: 'a4', copy: 'office' }),
    biltys.cancel(actorOf(a), doc.id, doc.version, 'Cancelled during sharing'),
  ]);
  assert.equal(results[1].status, 'fulfilled');
  const created = results[0];
  if (created.status === 'fulfilled')
    await assert.rejects(() =>
      shares.resolve(new URL(created.value.url).pathname.split('/').pop()!),
    );
  else assert.match(String(created.reason), /issued/);
});
