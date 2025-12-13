import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppSettings } from "./entities/app-settings.entity";
import { AppSettingsService } from "./services/app-settings.service";
import { AppSettingsController } from "./controllers/app-settings.controller";

@Module({
  imports: [TypeOrmModule.forFeature([AppSettings])],
  providers: [AppSettingsService],
  controllers: [AppSettingsController],
  exports: [AppSettingsService],
})
export class AppSettingsModule {}
