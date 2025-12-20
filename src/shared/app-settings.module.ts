import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppSettings } from "./entities/app-settings.entity";
import { AppSettingsService } from "./services/app-settings.service";
import { AppSettingsController } from "./controllers/app-settings.controller";
import { AdminAccess } from "src/super-admin-access/entities/super-admin-access.entity";
import { AdminAccessService } from "src/super-admin-access/super-admin-access.service";
import { AdminAccessLog } from "src/super-admin-access/entities/super-admin-log.entity";

@Module({
  imports: [TypeOrmModule.forFeature([AppSettings, AdminAccess, AdminAccessLog])],
  providers: [AppSettingsService, AdminAccessService],
  controllers: [AppSettingsController],
  exports: [AppSettingsService],
})
export class AppSettingsModule {}
