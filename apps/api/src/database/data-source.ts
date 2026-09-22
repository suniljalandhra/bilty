import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { BiltyFoundation1790000000000 } from './migrations/1790000000000-BiltyFoundation';

import { AuthTables1790000000001 } from './migrations/1790000000001-AuthTables';

import { PdfShares1790000000002 } from './migrations/1790000000002-PdfShares';
import { PasswordAuth1790000000003 } from './migrations/1790000000003-PasswordAuth';

export function makeDataSource(url: string): DataSource {
  return new DataSource({
    type: 'postgres',
    url,
    synchronize: false,
    migrationsRun: false,
    migrations: [
      BiltyFoundation1790000000000,
      AuthTables1790000000001,
      PdfShares1790000000002,
      PasswordAuth1790000000003,
    ],
    migrationsTransactionMode: 'all',
    extra: { max: 16, connectionTimeoutMillis: 5000 },
  });
}
