import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('..', import.meta.url));
const project = `bilty-test-${process.pid}-${randomUUID().slice(0, 8)}`;
const compose = ['compose', '--project-name', project, '--file', 'docker-compose.test.yml'];
function docker(args, capture = false) {
  const result = spawnSync('docker', [...compose, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Docker ${args[0]} failed${capture ? ': ' + result.stderr : ''}`);
  return result.stdout;
}
let exitCode = 1;
try {
  docker(['up', '--detach', '--wait', '--wait-timeout', '90', 'postgres']);
  const address = docker(['port', 'postgres', '5432'], true).trim();
  const port = address.match(/^127\.0\.0\.1:(\d+)$/)?.[1];
  if (!port) throw new Error('Expected a localhost-only test database port');
  const result = spawnSync('pnpm', ['test:integration'], {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      BILTY_TEST_DATABASE_URL: `postgresql://bilty_test:bilty-test-only@127.0.0.1:${port}/bilty_test`,
      BILTY_TEST_ALLOW_RESET: 'yes',
    },
  });
  if (result.error) throw result.error;
  exitCode = result.status ?? 1;
} catch (error) {
  console.error(error.message);
} finally {
  // Only this invocation's disposable test project is removed. Dev resources are separate.
  try {
    docker(['down', '--volumes', '--remove-orphans']);
  } catch (error) {
    console.error(error.message);
    exitCode = 1;
  }
}
process.exitCode = exitCode;
