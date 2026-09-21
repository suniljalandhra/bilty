import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { BiltyFoundation1790000000000 } from './migrations/1790000000000-BiltyFoundation';

export function makeDataSource(url: string): DataSource {
  return new DataSource({
    type: 'postgres',
    url,
    synchronize: false,
    migrationsRun: false,
    migrations: [BiltyFoundation1790000000000],
    migrationsTransactionMode: 'all',
    extra: { max: 16, connectionTimeoutMillis: 5000 },
  });
}
