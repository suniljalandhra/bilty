import { makeDataSource } from './data-source';
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error('Set DATABASE_URL to the intended PostgreSQL database before migrating');
  const db = makeDataSource(url);
  await db.initialize();
  try {
    const applied = await db.runMigrations();
    console.log(`Applied ${applied.length} migration(s)`);
  } finally {
    await db.destroy();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
