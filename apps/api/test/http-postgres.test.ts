import 'reflect-metadata';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/app';
import { AuthService } from '../src/modules/auth/auth.service';
import { config, google, testDatabase, resetDatabase } from './auth-fixtures';
import { completeData } from './fixtures';
const db = testDatabase();
let app: INestApplication;
let base: string;
let token: string;
let otherToken: string;
before(async () => {
  await resetDatabase(db);
  app = await createApp(db, config, google);
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
  const auth = app.get(AuthService);
  for (const email of ['a@example.com', 'b@example.com']) {
    const flow = await auth.beginLogin();
    const p = new URL(flow.url).searchParams;
    const t = await auth.finishLogin(
      p.get('state')!,
      flow.browserToken,
      JSON.stringify({ sub: email, email, email_verified: true, nonce: p.get('nonce') }),
    );
    await auth.onboard(await auth.authenticate(t.accessToken), {
      profile: { name: email },
      numberPrefix: 'EX/',
    });
    if (email === 'a@example.com') token = t.accessToken;
    else otherToken = t.accessToken;
  }
});
after(async () => {
  if (app) await app.close();
  if (db.isInitialized) await db.destroy();
});
function request(
  path: string,
  method = 'GET',
  body?: unknown,
  bearer = token,
  headers: Record<string, string> = {},
) {
  return fetch(base + path, {
    method,
    headers: {
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
}
test('HTTP rejects unauthenticated and spoofed tenant requests', async () => {
  assert.equal((await request('/company', 'GET', undefined, '')).status, 401);
  assert.equal((await request('/biltys', 'POST', { data: {}, companyId: 'spoof' })).status, 400);
  const created = (await (
    await request('/biltys', 'POST', { data: completeData() })
  ).json()) as any;
  assert.equal((await request(`/biltys/${created.id}`, 'GET', undefined, otherToken)).status, 404);
  assert.equal(
    (await request(`/biltys/${created.id}/history`, 'GET', undefined, otherToken)).status,
    404,
  );
  assert.equal(
    (await request(`/biltys/${created.id}/issue`, 'POST', { expectedVersion: 1 }, otherToken))
      .status,
    404,
  );
});
test('HTTP full PUT prevents accidental field clearing, preserves arrays, rejects stale writes and exposes history/print', async () => {
  const b = (await (await request('/biltys', 'POST', { data: completeData() })).json()) as any;
  assert.equal((await request(`/biltys/${b.id}`, 'PATCH', { remarks: 'partial' })).status, 404);
  assert.equal(
    (
      await request(`/biltys/${b.id}`, 'PUT', {
        expectedVersion: 1,
        data: { remarks: 'partial' },
        reason: '',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/biltys/${b.id}`, 'PUT', {
        expectedVersion: 1,
        data: { ...b.data, charges: { freightPaise: 1 } },
        reason: '',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(`/biltys/${b.id}`, 'PUT', {
        expectedVersion: 1,
        data: { ...b.data, remarks: 'Changed' },
        reason: '',
      })
    ).status,
    200,
  );
  assert.equal(
    (await request(`/biltys/${b.id}`, 'PUT', { expectedVersion: 1, data: b.data, reason: '' }))
      .status,
    409,
  );
  const issuedResponse = await request(`/biltys/${b.id}/issue`, 'POST', { expectedVersion: 2 });
  assert.equal(issuedResponse.status, 201);
  const issued = (await issuedResponse.json()) as any;
  assert.equal(issued.data.ewayBills.length, 3);
  assert.equal((await request(`/biltys/${b.id}/history`)).status, 200);
  assert.equal((await request(`/biltys/${b.id}/print`)).status, 200);
  assert.equal((await request('/biltys?limit=1000')).status, 400);
});
test('archiving a party retains old bilty references but forbids new links', async () => {
  const partyResponse = await request('/parties', 'POST', {
    kind: 'consignor',
    name: 'Sender',
    address: 'Delhi',
  });
  assert.equal(partyResponse.status, 201);
  const party = (await partyResponse.json()) as any;
  const b = (await (
    await request('/biltys', 'POST', {
      data: { ...completeData(), consignor: { partyId: party.id, name: 'Sender' } },
    })
  ).json()) as any;
  assert.equal((await request(`/parties/${party.id}`, 'DELETE')).status, 200);
  assert.deepEqual(await (await request('/parties')).json(), []);
  assert.equal((await request('/biltys', 'POST', { data: b.data })).status, 400);
  assert.equal(
    (await request(`/biltys/${b.id}/issue`, 'POST', { expectedVersion: 1 })).status,
    201,
  );
  assert.equal(
    (
      await request(`/biltys/${b.id}`, 'PUT', {
        expectedVersion: 2,
        data: { ...b.data, remarks: 'After archive' },
        reason: 'Correct remarks',
      })
    ).status,
    200,
  );
  assert.equal((await request(`/parties/${party.id}`, 'GET', undefined, otherToken)).status, 404);
});
test('OAuth callback uses browser cookie, fixed redirect and refresh cookie; refresh enforces Origin', async () => {
  const start = await request('/auth/google', 'GET', undefined, '');
  assert.equal(start.status, 302);
  const p = new URL(start.headers.get('location')!).searchParams;
  const cookie = start.headers.getSetCookie()[0]!.split(';')[0]!;
  const code = JSON.stringify({
    sub: 'c@example.com',
    email: 'c@example.com',
    email_verified: true,
    nonce: p.get('nonce'),
  });
  const callback = await request(
    '/auth/google/callback?' + new URLSearchParams({ state: p.get('state')!, code }),
    'GET',
    undefined,
    '',
    { Cookie: cookie },
  );
  assert.ok(
    callback.headers.getSetCookie().some((v) => v.startsWith('bilty_oauth=;')),
    'OAuth binding cookie must be cleared before redirect',
  );
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get('location'), config.FRONTEND_URL + '/auth/callback');
  const refreshCookie = callback.headers
    .getSetCookie()
    .find((v) => v.startsWith('bilty_refresh='))!;
  assert.match(refreshCookie, /HttpOnly/);
  assert.match(refreshCookie, /SameSite=Lax/);
  assert.match(refreshCookie, /Path=\/auth/);
  const c = refreshCookie.split(';')[0]!;
  assert.equal((await request('/auth/refresh', 'POST', {}, '', { Cookie: c })).status, 403);
  assert.equal(
    (await request('/auth/refresh', 'POST', {}, '', { Cookie: c, Origin: 'https://evil.example' }))
      .status,
    403,
  );
  const refreshed = await request('/auth/refresh', 'POST', {}, '', {
    Cookie: c,
    Origin: config.FRONTEND_URL,
  });
  assert.equal(refreshed.status, 200);
  assert.equal(refreshed.headers.get('cache-control'), 'no-store');
  const t = (await refreshed.json()) as any;
  assert.ok(t.accessToken);
  assert.equal(t.refreshToken, undefined);
  assert.equal((await request('/company', 'GET', undefined, t.accessToken)).status, 403);
  assert.equal(
    (await request('/auth/logout', 'POST', {}, t.accessToken, { Origin: config.FRONTEND_URL }))
      .status,
    200,
  );
  assert.equal((await request('/auth/me', 'GET', undefined, t.accessToken)).status, 401);
});
test('oversized JSON is rejected as a client error', async () => {
  const response = await request('/biltys', 'POST', { data: { remarks: 'x'.repeat(270000) } });
  assert.equal(response.status, 413);
});
test('PDF and share HTTP routes respect authentication, tenant scope and revocation', async () => {
  const b = (await (await request('/biltys', 'POST', { data: completeData() })).json()) as any;
  await request(`/biltys/${b.id}/issue`, 'POST', { expectedVersion: 1 });
  assert.equal((await request(`/biltys/${b.id}/pdf`, 'GET', undefined, '')).status, 401);
  assert.equal((await request(`/biltys/${b.id}/pdf`, 'GET', undefined, otherToken)).status, 404);
  const pdf = await request(`/biltys/${b.id}/pdf?format=thermal&copy=driver`);
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers.get('content-type')!, /application\/pdf/);
  const created = await request(`/biltys/${b.id}/shares`, 'POST', {
    expiresInHours: 1,
    format: 'a4',
    copy: 'office',
  });
  assert.equal(created.status, 201);
  const share = (await created.json()) as any;
  const path = new URL(share.url).pathname;
  const publicPdf = await request(path, 'GET', undefined, '');
  assert.equal(publicPdf.status, 200);
  assert.equal((await request(`/biltys/${b.id}/shares/${share.id}`, 'DELETE')).status, 200);
  assert.equal((await request(path, 'GET', undefined, '')).status, 404);
});
test('bilty search and status filters apply before pagination', async () => {
  await request('/biltys', 'POST', {
    data: { ...completeData(), vehicleNumber: 'SEARCH-ONLY-VEHICLE' },
  });
  const response = await request('/biltys?q=SEARCH-ONLY-VEHICLE&status=draft&limit=1');
  assert.equal(response.status, 200);
  const results = (await response.json()) as any[];
  assert.equal(results.length, 1);
  assert.equal(results[0].data.vehicleNumber, 'SEARCH-ONLY-VEHICLE');
  assert.deepEqual(await (await request('/biltys?q=SEARCH-ONLY-VEHICLE&status=issued')).json(), []);
});
test('cancelled OAuth returns to a fixed login screen and clears login cookies', async () => {
  const start = await request('/auth/google', 'GET', undefined, '');
  const state = new URL(start.headers.get('location')!).searchParams.get('state')!;
  const c = start.headers.getSetCookie()[0]!.split(';')[0]!;
  const failure = await request(
    '/auth/google/callback?' + new URLSearchParams({ state, error: 'access_denied' }),
    'GET',
    undefined,
    '',
    { Cookie: c },
  );
  assert.equal(failure.status, 302);
  assert.equal(
    failure.headers.get('location'),
    config.FRONTEND_URL + '/login?error=sign_in_failed',
  );
  assert.ok(failure.headers.getSetCookie().some((v) => v.startsWith('bilty_refresh=;')));
});

async function captureEmailToken(
  kind: 'verify-email' | 'reset-password',
  action: () => Promise<void>,
) {
  let captured = '';
  const original = console.log;
  console.log = (...args: unknown[]) => {
    const match = args.join(' ').match(new RegExp(`${kind}\\?token=([A-Za-z0-9_-]+)`));
    if (match) captured = match[1]!;
  };
  try {
    await action();
  } finally {
    console.log = original;
  }
  assert.ok(captured, `${kind} token was not emitted`);
  return captured;
}

test('email/password registration, verification, login, reset and resend form one secure flow', async () => {
  const mixedCaseEmail = 'Password.User@Example.COM';
  const email = mixedCaseEmail.toLowerCase();
  const firstVerification = await captureEmailToken('verify-email', async () => {
    const response = await request(
      '/auth/register',
      'POST',
      { email: mixedCaseEmail, password: 'SecurePass1!', name: 'Password User' },
      '',
    );
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { message: 'Verification email sent' });
  });

  assert.equal(
    (await request('/auth/login', 'POST', { email, password: 'SecurePass1!' }, '')).status,
    403,
  );

  const secondVerification = await captureEmailToken('verify-email', async () => {
    const response = await request('/auth/resend-verification', 'POST', { email }, '');
    assert.equal(response.status, 200);
  });
  assert.notEqual(firstVerification, secondVerification);
  const invalidatedVerification = await request(
    '/auth/verify-email',
    'POST',
    { token: firstVerification },
    '',
  );
  assert.equal(invalidatedVerification.status, 400, await invalidatedVerification.text());

  const verified = await request('/auth/verify-email', 'POST', { token: secondVerification }, '');
  assert.equal(verified.status, 200);
  const verifiedBody = (await verified.json()) as any;
  assert.ok(verifiedBody.accessToken);
  assert.equal(
    (await request('/auth/verify-email', 'POST', { token: secondVerification }, '')).status,
    400,
  );

  assert.equal(
    (
      await request(
        '/auth/login',
        'POST',
        { email: 'PASSWORD.USER@EXAMPLE.COM', password: 'wrong' },
        '',
      )
    ).status,
    401,
  );
  const login = await request('/auth/login', 'POST', { email, password: 'SecurePass1!' }, '');
  assert.equal(login.status, 200);
  const loginBody = (await login.json()) as any;
  assert.equal((await request('/auth/me', 'GET', undefined, loginBody.accessToken)).status, 200);

  const resetToken = await captureEmailToken('reset-password', async () => {
    assert.equal((await request('/auth/forgot-password', 'POST', { email }, '')).status, 200);
  });
  assert.equal(
    (
      await request(
        '/auth/reset-password',
        'POST',
        { token: resetToken, password: 'NewSecurePass2!' },
        '',
      )
    ).status,
    200,
  );
  assert.equal((await request('/auth/me', 'GET', undefined, loginBody.accessToken)).status, 401);
  assert.equal(
    (await request('/auth/login', 'POST', { email, password: 'SecurePass1!' }, '')).status,
    401,
  );
  assert.equal(
    (await request('/auth/login', 'POST', { email, password: 'NewSecurePass2!' }, '')).status,
    200,
  );
  assert.equal(
    (
      await request(
        '/auth/reset-password',
        'POST',
        { token: resetToken, password: 'AnotherPass3!' },
        '',
      )
    ).status,
    400,
  );

  assert.equal(
    (
      await request(
        '/auth/register',
        'POST',
        { email, password: 'DifferentPass4!', name: 'Duplicate' },
        '',
      )
    ).status,
    201,
  );
  assert.equal(
    (await request('/auth/forgot-password', 'POST', { email: 'missing@example.com' }, '')).status,
    200,
  );
});

test('Google-authenticated users can add one password without exposing account type publicly', async () => {
  assert.equal(
    (
      await request(
        '/auth/register',
        'POST',
        { email: 'a@example.com', password: 'UnusedPass1!', name: 'Duplicate Google User' },
        '',
      )
    ).status,
    201,
  );
  assert.equal(
    (await request('/auth/add-password', 'POST', { password: 'GoogleLinked1!' }, token)).status,
    200,
  );
  assert.equal(
    (
      await request(
        '/auth/login',
        'POST',
        { email: 'A@EXAMPLE.COM', password: 'GoogleLinked1!' },
        '',
      )
    ).status,
    200,
  );
  assert.equal(
    (await request('/auth/add-password', 'POST', { password: 'AnotherGoogle2!' }, token)).status,
    409,
  );
});
