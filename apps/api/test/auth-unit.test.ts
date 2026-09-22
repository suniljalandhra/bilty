import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { readConfig } from '../src/modules/auth/config';
import { TokenService, hashToken } from '../src/modules/auth/tokens';
import { verifiedIdentity } from '../src/modules/auth/google';
const env = {
  DATABASE_URL: 'postgresql://localhost/test',
  GOOGLE_CLIENT_ID: 'client',
  GOOGLE_CLIENT_SECRET: 'secret',
  GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/callback',
  FRONTEND_URL: 'http://localhost:3001',
  JWT_SECRET: 'a'.repeat(48),
};
test('configuration rejects short secrets and insecure production origins', () => {
  assert.throws(() => readConfig({ ...env, JWT_SECRET: 'short' }));
  assert.throws(() => readConfig({ ...env, NODE_ENV: 'production' }));
  assert.throws(() => readConfig({ ...env, FRONTEND_URL: 'http://localhost:3001/path' }));
});
test('access tokens reject wrong algorithm, audience, signature and expiry', () => {
  const tokens = new TokenService(readConfig(env));
  const token = tokens.sign(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
  );
  assert.equal(tokens.verify(token).sub, '00000000-0000-4000-8000-000000000001');
  for (const options of [{ algorithm: 'HS384' }, { audience: 'other' }, { expiresIn: -1 }]) {
    const bad = jwt.sign(
      { sub: '00000000-0000-4000-8000-000000000001', sid: '00000000-0000-4000-8000-000000000002' },
      env.JWT_SECRET,
      {
        algorithm: 'HS256',
        issuer: 'bilty-api',
        audience: 'bilty-web',
        expiresIn: 900,
        ...options,
      } as jwt.SignOptions,
    );
    assert.throws(() => tokens.verify(bad));
  }
  assert.throws(() => tokens.verify(token.slice(0, -5) + 'xxxxx'));
});
test('Google identity requires verified email, subject and callback nonce', () => {
  const claims = {
    sub: 'google-user',
    email: ' Person@Example.com ',
    email_verified: true,
    nonce: 'nonce',
    name: 'Person',
  };
  assert.equal(verifiedIdentity(claims, hashToken('nonce')).email, 'person@example.com');
  for (const patch of [{ email_verified: false }, { sub: '' }, { nonce: 'wrong' }, { email: '' }])
    assert.throws(() => verifiedIdentity({ ...claims, ...patch }, hashToken('nonce')));
});
test('company profile refuses invalid inline logos instead of breaking later printing', async () => {
  const { parseCompany } = await import('../src/modules/bilty/validation');
  assert.throws(() => parseCompany({ name: 'A', logoUrl: 'data:image/png;base64,YWJj' }));
});
test('development can start without Google secrets but production requires them', () => {
  const dev = readConfig({ ...env, GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' });
  assert.equal(dev.GOOGLE_CLIENT_ID, '');
  assert.throws(() =>
    readConfig({
      ...env,
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://app.example.com',
      GOOGLE_CALLBACK_URL: 'https://api.example.com/auth/google/callback',
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
    }),
  );
});

test('password validation enforces minimum 10 chars with uppercase, lowercase, number, special', async () => {
  const { passwordSchema } = await import('../src/modules/auth/password');

  // Should fail - too short
  assert.throws(() => passwordSchema.parse('Aa1!short'));

  // Should fail - no uppercase
  assert.throws(() => passwordSchema.parse('abcdefgh1!'));

  // Should fail - no lowercase
  assert.throws(() => passwordSchema.parse('ABCDEFGH1!'));

  // Should fail - no number
  assert.throws(() => passwordSchema.parse('Abcdefghi!'));

  // Should fail - no special character
  assert.throws(() => passwordSchema.parse('Abcdefghi1'));

  // Should fail - empty string
  assert.throws(() => passwordSchema.parse(''));

  // Should pass - meets all requirements
  assert.equal(passwordSchema.parse('Abcdefghi1!'), 'Abcdefghi1!');

  // Should pass - unicode/emoji allowed if requirements met
  assert.equal(passwordSchema.parse('Abcdefghi1!🎉'), 'Abcdefghi1!🎉');
});

test('password hashing produces verifiable bcrypt hash', async () => {
  const { hashPassword, verifyPassword } = await import('../src/modules/auth/password');

  const password = 'SecurePass1!';
  const hash = await hashPassword(password);

  // Hash should be bcrypt format
  assert.match(hash, /^\$2[aby]\$\d{2}\$/);

  // Correct password should verify
  assert.equal(await verifyPassword(password, hash), true);

  // Wrong password should not verify
  assert.equal(await verifyPassword('WrongPass1!', hash), false);

  // Different hashes for same password (due to salt)
  const hash2 = await hashPassword(password);
  assert.notEqual(hash, hash2);
});
