import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CatalogSyncService } from './catalog-sync.service';
import { OndcSearchModule } from '../ondc-search/ondc-search.module';
import { CatalogIngestionModule } from '../catalog-ingestion/catalog-ingestion.module';
import { CatalogSyncController } from './catalog-sync.controller';

@Module({
  imports: [
    ConfigModule,
    OndcSearchModule,
    CatalogIngestionModule,
  ],
  providers: [CatalogSyncService],
  exports: [CatalogSyncService],
  controllers: [CatalogSyncController],
})
export class CatalogSyncModule {}
