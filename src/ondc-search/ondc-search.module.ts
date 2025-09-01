import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { OndcSearchService } from './ondc-search.service';
import { OndcSearchController } from './ondc-search.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  providers: [OndcSearchService],
  exports: [OndcSearchService],
  controllers: [OndcSearchController], // Export for use in other modules
})
export class OndcSearchModule {}
