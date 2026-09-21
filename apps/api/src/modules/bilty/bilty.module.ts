import { Module, type DynamicModule } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BiltyService } from './bilty.service';

@Module({})
export class BiltyModule {
  /** Register with an initialized DataSource owned by the application's lifecycle. */
  static forDataSource(dataSource: DataSource): DynamicModule {
    return {
      module: BiltyModule,
      providers: [{ provide: BiltyService, useFactory: () => new BiltyService(dataSource) }],
      exports: [BiltyService],
    };
  }
}
