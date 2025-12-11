import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BannerService } from "./banner.service";
import { BannerController } from "./banner.controller";
import { Banner } from "./entities/banner.entity";
import { UploadService } from "src/shared/upload.service";
import { Store } from "../store/entities/store.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Banner, Store])],
  controllers: [BannerController],
  providers: [BannerService, UploadService],
  exports: [BannerService],
})
export class BannerModule {}
