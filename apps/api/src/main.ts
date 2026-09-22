import { createApp } from './app';
import { makeDataSource } from './database/data-source';
import { readConfig } from './modules/auth/config';
async function main() {
  const config = readConfig();
  const db = makeDataSource(config.DATABASE_URL);
  await db.initialize();
  try {
    const app = await createApp(db, config);
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      await app.close();
      await db.destroy();
    };
    process.once('SIGINT', () => {
      void stop();
    });
    process.once('SIGTERM', () => {
      void stop();
    });
    await app.listen(config.PORT, '0.0.0.0');
  } catch (error) {
    await db.destroy();
    throw error;
  }
}
void main().catch(() => {
  console.error('API startup failed; verify configuration, database connectivity and migrations.');
  process.exitCode = 1;
});
