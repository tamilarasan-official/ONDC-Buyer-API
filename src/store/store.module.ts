import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StoreService } from "./store.service";
import { StoreController } from "./store.controller";
import { Store } from "./entities/store.entity";
import { StoreCloseTimings } from "./entities/store-close-timings.entity";
import { StoreLocation } from "./entities/store-location.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Store, StoreCloseTimings, StoreLocation])],
  controllers: [StoreController],
  providers: [StoreService],
  exports: [StoreService],
})
export class StoreModule {}
