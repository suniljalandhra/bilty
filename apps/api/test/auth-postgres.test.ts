import 'reflect-metadata';
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/modules/auth/auth.service';
import { CompanyService } from '../src/modules/company/company.service';
import { config, google, testDatabase, resetDatabase } from './auth-fixtures';
import { hashToken } from '../src/modules/auth/tokens';
const db = testDatabase();
const auth = new AuthService(db, config, google);
const companies = new CompanyService(db, config);
before(() => resetDatabase(db));
after(async () => {
  if (db.isInitialized) await db.destroy();
});
beforeEach(() => db.query('TRUNCATE users, companies, oauth_states CASCADE'));
async function login(email = 'owner@example.com', invite?: string) {
  const flow = await auth.beginLogin(invite);
  const p = new URL(flow.url).searchParams;
  return auth.finishLogin(
    p.get('state')!,
    flow.browserToken,
    JSON.stringify({
      sub: email,
      email,
      email_verified: true,
      nonce: p.get('nonce'),
      name: 'Owner',
    }),
  );
}
async function owner(email = 'owner@example.com') {
  const tokens = await login(email);
  const initial = await auth.authenticate(tokens.accessToken);
  await auth.onboard(initial, { profile: { name: 'Transport' }, numberPrefix: 'TR/' });
  return { tokens, principal: await auth.authenticate(tokens.accessToken) };
}
test('OAuth state is browser-bound, consumed once and never stored as a bearer token', async () => {
  const f = await auth.beginLogin();
  const p = new URL(f.url).searchParams;
  const code = JSON.stringify({
    sub: 'google',
    email: 'a@example.com',
    email_verified: true,
    nonce: p.get('nonce'),
  });
  const rows = await db.query('SELECT * FROM oauth_states');
  assert.equal(rows[0].state_hash, hashToken(p.get('state')!));
  await assert.rejects(() => auth.finishLogin(p.get('state')!, 'wrong', code));
  await auth.finishLogin(p.get('state')!, f.browserToken, code);
  await assert.rejects(() => auth.finishLogin(p.get('state')!, f.browserToken, code));
});
test('unverified Google identity and expired state create no user', async () => {
  const f = await auth.beginLogin();
  const p = new URL(f.url).searchParams;
  await assert.rejects(() =>
    auth.finishLogin(
      p.get('state')!,
      f.browserToken,
      JSON.stringify({
        sub: 'bad',
        email: 'a@example.com',
        email_verified: false,
        nonce: p.get('nonce'),
      }),
    ),
  );
  const g = await auth.beginLogin();
  await db.query("UPDATE oauth_states SET expires_at=now()-interval '1 minute'");
  await assert.rejects(() =>
    auth.finishLogin(new URL(g.url).searchParams.get('state')!, g.browserToken, '{}'),
  );
  assert.equal((await db.query('SELECT * FROM users')).length, 0);
});
test('onboarding creates one company even with concurrent requests and cannot set counter', async () => {
  const t = await login();
  const p = await auth.authenticate(t.accessToken);
  assert.equal(p.companyId, null);
  await assert.rejects(() =>
    auth.onboard(p, { profile: { name: 'A' }, numberPrefix: 'A/', nextNumber: 42 }),
  );
  const results = await Promise.allSettled([
    auth.onboard(p, { profile: { name: 'A' }, numberPrefix: 'A/' }),
    auth.onboard(p, { profile: { name: 'B' }, numberPrefix: 'B/' }),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await db.query('SELECT * FROM companies')).length, 1);
  assert.equal((await auth.authenticate(t.accessToken)).role, 'admin');
});
test('invite email mismatch rolls back identity; acceptance is single use under concurrency', async () => {
  const a = await owner();
  const invite = await companies.createInvite(a.principal, {
    email: ' Worker@Example.com ',
    role: 'employee',
  });
  await assert.rejects(() => login('wrong@example.com', invite.token));
  assert.equal((await db.query("SELECT * FROM users WHERE email='wrong@example.com'")).length, 0);
  const results = await Promise.allSettled([
    login('worker@example.com', invite.token),
    login('worker@example.com', invite.token),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const members = await companies.members(a.principal);
  assert.equal(members.length, 2);
});
test('another company membership cannot be replaced by an invite', async () => {
  const a = await owner();
  const b = await owner('other@example.com');
  const invite = await companies.createInvite(a.principal, {
    email: 'other@example.com',
    role: 'admin',
  });
  await assert.rejects(() => login('other@example.com', invite.token));
  assert.equal((await auth.authenticate(b.tokens.accessToken)).companyId, b.principal.companyId);
});
test('refresh rotates and reuse revokes both old access and replacement refresh', async () => {
  const a = await owner();
  const next = await auth.refresh(a.tokens.refreshToken);
  assert.notEqual(next.refreshToken, a.tokens.refreshToken);
  assert.ok(await auth.authenticate(next.accessToken));
  await assert.rejects(() => auth.refresh(a.tokens.refreshToken));
  await assert.rejects(() => auth.authenticate(next.accessToken));
  await assert.rejects(() => auth.refresh(next.refreshToken));
});
test('concurrent refresh detects reuse and invalidates the session', async () => {
  const a = await owner();
  const results = await Promise.allSettled([
    auth.refresh(a.tokens.refreshToken),
    auth.refresh(a.tokens.refreshToken),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  await assert.rejects(() => auth.authenticate(a.tokens.accessToken));
});
test('expiry and current/all-session logout immediately reject access', async () => {
  const a = await owner();
  const second = await login();
  await auth.logout(a.principal, false);
  await assert.rejects(() => auth.authenticate(a.tokens.accessToken));
  const p = await auth.authenticate(second.accessToken);
  await auth.logout(p, true);
  await assert.rejects(() => auth.authenticate(second.accessToken));
  const third = await login();
  await db.query("UPDATE sessions SET expires_at=now()-interval '1 second'");
  await assert.rejects(() => auth.refresh(third.refreshToken));
  await assert.rejects(() => auth.authenticate(third.accessToken));
});
test('last admin stays active; member revocation kills sessions and same-company invite can reactivate', async () => {
  const a = await owner();
  await assert.rejects(() => companies.revokeMember(a.principal, a.principal.userId));
  const invite = await companies.createInvite(a.principal, {
    email: 'worker@example.com',
    role: 'employee',
  });
  const t = await login('worker@example.com', invite.token);
  const worker = await auth.authenticate(t.accessToken);
  await assert.rejects(() =>
    companies.createInvite(worker, { email: 'x@example.com', role: 'admin' }),
  );
  await companies.revokeMember(a.principal, worker.userId);
  await assert.rejects(() => auth.authenticate(t.accessToken));
  await assert.rejects(() => login('worker@example.com'));
  const again = await companies.createInvite(a.principal, {
    email: 'worker@example.com',
    role: 'employee',
  });
  const restored = await login('worker@example.com', again.token);
  assert.equal((await auth.authenticate(restored.accessToken)).companyId, a.principal.companyId);
});
test('expired/revoked invites fail and foreign admin cannot revoke another tenant member', async () => {
  const a = await owner();
  const b = await owner('other@example.com');
  await assert.rejects(() => companies.revokeMember(a.principal, b.principal.userId));
  const invite = await companies.createInvite(a.principal, {
    email: 'worker@example.com',
    role: 'employee',
  });
  await companies.revokeInvite(a.principal, invite.id);
  await assert.rejects(() => login('worker@example.com', invite.token));
  const expired = await companies.createInvite(a.principal, {
    email: 'worker@example.com',
    role: 'employee',
  });
  await db.query("UPDATE invites SET expires_at=now()-interval '1 second'");
  await assert.rejects(() => login('worker@example.com', expired.token));
});
test('two admins cannot concurrently revoke every administrator', async () => {
  const a = await owner();
  const invite = await companies.createInvite(a.principal, {
    email: 'admin@example.com',
    role: 'admin',
  });
  const t = await login('admin@example.com', invite.token);
  const b = await auth.authenticate(t.accessToken);
  const results = await Promise.allSettled([
    companies.revokeMember(a.principal, b.userId),
    companies.revokeMember(b, a.principal.userId),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    (await db.query("SELECT user_id FROM memberships WHERE active=true AND role='admin'")).length,
    1,
  );
});
test('role changes take effect for already minted access tokens', async () => {
  const a = await owner();
  await db.query("UPDATE memberships SET role='employee' WHERE user_id=$1", [a.principal.userId]);
  assert.equal((await auth.authenticate(a.tokens.accessToken)).role, 'employee');
  await assert.rejects(() =>
    companies.createInvite(a.principal, { email: 'new@example.com', role: 'admin' }),
  );
});
test('refresh does not extend absolute session lifetime or store raw credentials', async () => {
  const a = await owner();
  const next = await auth.refresh(a.tokens.refreshToken);
  assert.equal(next.expiresAt, a.tokens.expiresAt);
  const rows = await db.query('SELECT token_hash FROM refresh_tokens');
  assert.ok(rows.every((r: any) => /^[a-f0-9]{64}$/.test(r.token_hash)));
  assert.ok(
    !rows.some(
      (r: any) => r.token_hash === a.tokens.refreshToken || r.token_hash === next.refreshToken,
    ),
  );
});
