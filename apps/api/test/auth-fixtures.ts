import { makeDataSource } from '../src/database/data-source';
import { readConfig } from '../src/modules/auth/config';
import { verifiedIdentity, type GoogleProvider } from '../src/modules/auth/google';
export const config = readConfig({
  DATABASE_URL: 'postgresql://localhost/test',
  GOOGLE_CLIENT_ID: 'client',
  GOOGLE_CLIENT_SECRET: 'secret',
  GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/callback',
  FRONTEND_URL: 'http://localhost:3001',
  JWT_SECRET: 'test-secret-'.repeat(5),
  NODE_ENV: 'test',
});
export const google: GoogleProvider = {
  authorizationUrl(state, nonce, verifier) {
    return (
      'https://accounts.google.com/o/oauth2/v2/auth?' +
      new URLSearchParams({ state, nonce, verifier })
    );
  },
  async exchange(code, _verifier, nonceHash) {
    return verifiedIdentity(JSON.parse(code), nonceHash);
  },
};
export function testDatabase() {
  const url = process.env.BILTY_TEST_DATABASE_URL;
  if (!url || process.env.BILTY_TEST_ALLOW_RESET !== 'yes')
    throw new Error('Disposable test database and explicit reset permission required');
  return makeDataSource(url);
}
export async function resetDatabase(db: ReturnType<typeof testDatabase>) {
  await db.initialize();
  await db.query('DROP SCHEMA public CASCADE');
  await db.query('CREATE SCHEMA public');
  await db.runMigrations();
}
