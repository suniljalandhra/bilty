// Test harness only; excluded from the production TypeScript build.
import 'reflect-metadata';
import { createServer } from 'node:http';
import { createApp } from '../src/app';
import { readConfig } from '../src/modules/auth/config';
import { verifiedIdentity, type GoogleProvider } from '../src/modules/auth/google';
import { makeDataSource } from '../src/database/data-source';
async function main() {
  if (process.env.BILTY_E2E !== 'yes' || !process.env.BILTY_TEST_DATABASE_URL)
    throw new Error('Isolated E2E configuration required');
  const config = readConfig({ ...process.env, DATABASE_URL: process.env.BILTY_TEST_DATABASE_URL });
  const db = makeDataSource(config.DATABASE_URL);
  await db.initialize();
  await db.runMigrations();
  const googlePort = Number(process.env.E2E_GOOGLE_PORT ?? 3102);
  const provider: GoogleProvider = {
    authorizationUrl(state, nonce, verifier) {
      return (
        `http://localhost:${googlePort}/authorize?` +
        new URLSearchParams({ state, nonce, verifier })
      );
    },
    async exchange(code, _verifier, nonceHash) {
      return verifiedIdentity(JSON.parse(Buffer.from(code, 'base64url').toString()), nonceHash);
    },
  };
  const identityServer = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${googlePort}`);
    if (url.pathname === '/authorize') {
      // All hidden values are generated random base64url protocol fields.
      const hidden = ['state', 'nonce', 'verifier']
        .map((k) => `<input type="hidden" name="${k}" value="${url.searchParams.get(k) ?? ''}">`)
        .join('');
      res.setHeader('Content-Type', 'text/html');
      res.end(
        `<html><body><h1>Test Google provider</h1><form action="/approve">${hidden}<label>Email <input name="email" type="email" required value="owner@example.com"></label><button>Continue</button></form></body></html>`,
      );
      return;
    }
    if (url.pathname === '/approve') {
      const email = url.searchParams.get('email') ?? '';
      const code = Buffer.from(
        JSON.stringify({
          sub: email,
          email,
          email_verified: true,
          name: 'Test Operator',
          nonce: url.searchParams.get('nonce'),
        }),
      ).toString('base64url');
      res.writeHead(302, {
        Location:
          config.GOOGLE_CALLBACK_URL +
          '?' +
          new URLSearchParams({ state: url.searchParams.get('state') ?? '', code }),
      });
      res.end();
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => identityServer.listen(googlePort, '127.0.0.1', resolve));
  const app = await createApp(db, config, provider);
  await app.listen(config.PORT, '127.0.0.1');
  const stop = async () => {
    identityServer.close();
    await app.close();
    await db.destroy();
  };
  process.once('SIGTERM', () => {
    void stop();
  });
  process.once('SIGINT', () => {
    void stop();
  });
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
