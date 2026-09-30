import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../src/modules/auth/config';
const env = {
  DATABASE_URL: 'postgresql://localhost/test',
  GOOGLE_CLIENT_ID: 'client',
  GOOGLE_CLIENT_SECRET: 'secret',
  GOOGLE_CALLBACK_URL: 'https://api.example.com/auth/google/callback',
  FRONTEND_URL: 'https://app.example.com',
  JWT_SECRET: 'a'.repeat(48),
};
test('production refuses console delivery and incomplete Resend configuration', () => {
  assert.throws(() => readConfig({ ...env, NODE_ENV: 'production' }), /email|Resend/i);
  assert.throws(() => readConfig({ ...env, EMAIL_PROVIDER: 'resend' }), /Resend/i);
  assert.throws(() =>
    readConfig({
      ...env,
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 'test-key',
      EMAIL_FROM: 'invalid',
    }),
  );
  const config = readConfig({
    ...env,
    NODE_ENV: 'production',
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 'test-key',
    EMAIL_FROM: 'noreply@mail.winggroup.org',
  });
  assert.equal(config.EMAIL_PROVIDER, 'resend');
});
test('Resend receives the correct recipient and verification/reset links with a bounded request', async () => {
  const { AuthEmailSender } = await import('../src/modules/auth/email');
  const config = readConfig({
    ...env,
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 'test-key',
    EMAIL_FROM: 'noreply@mail.winggroup.org',
  });
  const sent: any[] = [];
  const sender = new AuthEmailSender(config, async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options?.method, 'POST');
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer test-key');
    assert.ok(options?.signal);
    const key = new Headers(options?.headers).get('Idempotency-Key');
    assert.ok(key && !key.includes('secret-token'));
    sent.push(JSON.parse(options?.body as string));
    return Response.json({ id: 'email-id' });
  });
  await sender.send('verification', 'person@example.com', 'secret-token');
  await sender.send('reset', 'person@example.com', 'reset-token');
  assert.deepEqual(sent[0].to, ['person@example.com']);
  assert.equal(sent[0].from, 'Bilty <noreply@mail.winggroup.org>');
  assert.match(sent[0].text, /https:\/\/app.example.com\/verify-email\?token=secret-token/);
  assert.match(sent[0].text, /24 hours/);
  assert.match(sent[1].text, /https:\/\/app.example.com\/reset-password\?token=reset-token/);
  assert.match(sent[1].text, /1 hour/);
  assert.match(sent[1].html, /href="https:\/\/app.example.com\/reset-password\?token=reset-token"/);
});
test('provider rejection, network errors and malformed responses expose no secrets', async () => {
  const { AuthEmailSender } = await import('../src/modules/auth/email');
  const config = readConfig({
    ...env,
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 'private-key',
    EMAIL_FROM: 'noreply@mail.winggroup.org',
  });
  for (const response of [
    () => Promise.resolve(Response.json({ message: 'private-key secret-token' }, { status: 429 })),
    () => Promise.reject(new Error('private-key secret-token')),
    () => Promise.resolve(Response.json({})),
  ]) {
    const sender = new AuthEmailSender(config, response);
    await assert.rejects(
      sender.send('reset', 'person@example.com', 'secret-token'),
      (error: any) => {
        assert.equal(error.message, 'Authentication email delivery failed');
        assert.doesNotMatch(String(error), /private-key|secret-token|person@example.com/);
        return true;
      },
    );
  }
});
