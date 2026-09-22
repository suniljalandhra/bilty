import assert from 'node:assert/strict';
import test from 'node:test';

async function client() {
  return import(`../src/lib/api.ts?case=${crypto.randomUUID()}`);
}
function browserLock(t: Parameters<Parameters<typeof test>[1]>[0]) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let queued = Promise.resolve();
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      locks: {
        request: (_name: string, work: () => Promise<unknown>) => {
          const result = queued.then(work);
          queued = result.then(
            () => undefined,
            () => undefined,
          );
          return result;
        },
      },
    },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
  });
}
function response(body: unknown, status = 200) {
  return Response.json(body, { status });
}

test('simultaneous authenticated requests share one cookie refresh and receive a bearer token', async (t) => {
  browserLock(t);
  let rotations = 0;
  const headers: string[] = [];
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url, options) => {
    assert.equal(options?.credentials, 'include');
    if (String(url).endsWith('/auth/refresh')) {
      rotations++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return response({ accessToken: 'memory-only-access', expiresIn: 900 });
    }
    if (String(url).endsWith('/auth/logout')) return response({ loggedOut: true });
    headers.push(new Headers(options?.headers).get('Authorization') || '');
    return response({ value: 'saved document' });
  };
  const api = await client();
  try {
    const values = await Promise.all([
      api.api('/biltys/a'),
      api.api('/biltys/b'),
      api.api('/company'),
    ]);
    assert.deepEqual(values, [
      { value: 'saved document' },
      { value: 'saved document' },
      { value: 'saved document' },
    ]);
    assert.equal(rotations, 1);
    assert.deepEqual(headers, Array(3).fill('Bearer memory-only-access'));
  } finally {
    await api.signOut();
  }
});

test('an expired bearer token is refreshed and an authenticated request is retried only once', async (t) => {
  browserLock(t);
  let rotations = 0,
    requests = 0;
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/auth/refresh'))
      return response({ accessToken: `token-${++rotations}`, expiresIn: 900 });
    requests++;
    return response({ message: 'Session revoked' }, 401);
  };
  const api = await client();
  await assert.rejects(
    api.api('/biltys'),
    (error: unknown) => error instanceof api.ApiError && error.status === 401,
  );
  assert.equal(rotations, 2);
  assert.equal(requests, 2);
});

test('failed refresh does not send an unauthenticated document request', async (t) => {
  browserLock(t);
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const paths: string[] = [];
  globalThis.fetch = async (url) => {
    paths.push(new URL(String(url)).pathname);
    return response({ message: 'Session expired' }, 401);
  };
  const api = await client();
  await assert.rejects(api.api('/biltys'), /Session expired/);
  assert.deepEqual(paths, ['/auth/refresh']);
});

test('public JSON authentication requests include cookies and surface API errors', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const calls: Array<{ path: string; method: string; body: string }> = [];
  globalThis.fetch = async (url, options) => {
    calls.push({
      path: new URL(String(url)).pathname,
      method: options?.method || 'GET',
      body: String(options?.body || ''),
    });
    if (String(url).endsWith('/auth/login'))
      return response({ accessToken: 'login-access', expiresIn: 900 });
    return response({ message: 'Invalid or expired verification token' }, 400);
  };
  const api = await client();
  assert.deepEqual(
    await api.publicApi('/auth/login', api.json('POST', { email: 'user@example.com' })),
    { accessToken: 'login-access', expiresIn: 900 },
  );
  await assert.rejects(
    api.publicApi('/auth/verify-email', api.json('POST', { token: 'bad' })),
    /Invalid or expired verification token/,
  );
  assert.deepEqual(calls[0], {
    path: '/auth/login',
    method: 'POST',
    body: '{"email":"user@example.com"}',
  });
});
