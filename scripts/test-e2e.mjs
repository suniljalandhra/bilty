import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('..', import.meta.url));
const project = `bilty-e2e-${process.pid}-${randomUUID().slice(0, 8)}`;
const compose = ['compose', '--project-name', project, '--file', 'docker-compose.test.yml'];
const children = [];
function docker(args, capture = false) {
  const r = spawnSync('docker', [...compose, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (r.status !== 0) throw new Error(`Docker failed: ${r.stderr ?? args[0]}`);
  return r.stdout;
}
function start(args, env) {
  const child = spawn('pnpm', args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    detached: true,
  });
  children.push(child);
  return child;
}
async function ready(url) {
  for (let i = 0; i < 120; i++) {
    if (children.some((c) => c.exitCode !== null)) throw new Error('Test server exited');
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Test server did not become ready: ${url}`);
}
let exit = 1;
try {
  docker(['up', '-d', '--wait', 'postgres']);
  const port = docker(['port', 'postgres', '5432'], true).trim().split(':').pop();
  start(['--filter', '@bilty/api', 'exec', 'tsx', 'test/e2e-server.ts'], {
    BILTY_E2E: 'yes',
    BILTY_TEST_DATABASE_URL: `postgresql://bilty_test:bilty-test-only@127.0.0.1:${port}/bilty_test`,
    GOOGLE_CLIENT_ID: 'test-client',
    GOOGLE_CLIENT_SECRET: 'test-secret',
    GOOGLE_CALLBACK_URL: 'http://localhost:3100/auth/google/callback',
    FRONTEND_URL: 'http://localhost:3101',
    PUBLIC_API_URL: 'http://localhost:3100',
    JWT_SECRET: randomUUID() + randomUUID(),
    NODE_ENV: 'test',
    PORT: '3100',
  });
  start(
    ['--filter', '@bilty/web', 'exec', 'next', 'dev', '--hostname', '127.0.0.1', '--port', '3101'],
    { NEXT_PUBLIC_API_URL: 'http://localhost:3100', NEXT_DIST_DIR: '.next-e2e' },
  );
  await ready('http://localhost:3100/health');
  await ready('http://localhost:3101');
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'playwright',
      'test',
      '--config',
      'e2e/playwright.config.ts',
      ...process.argv.slice(2).filter((argument) => argument !== '--'),
    ],
    { cwd, env: { ...process.env, E2E_WEB_URL: 'http://localhost:3101' }, stdio: 'inherit' },
  );
  exit = result.status ?? 1;
} finally {
  for (const c of children) {
    try {
      process.kill(-c.pid, 'SIGTERM');
    } catch {}
  }
  await new Promise((r) => setTimeout(r, 1000));
  docker(['down', '--volumes', '--remove-orphans']);
}
process.exitCode = exit;
