import { Module } from '@nestjs/common';
import { AdminAccessService } from './super-admin-access.service';
import { AdminAccessController } from './super-admin-access.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAccess } from './entities/super-admin-access.entity';
import { ApiKeyGuard } from './api-key-auth-gaurd';
import { AdminAccessLog } from './entities/super-admin-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AdminAccess, AdminAccessLog])],
  controllers: [AdminAccessController],
  providers: [AdminAccessService, ApiKeyGuard],
  exports: [AdminAccessService, ApiKeyGuard],
})
export class AdminAccessModule { }
