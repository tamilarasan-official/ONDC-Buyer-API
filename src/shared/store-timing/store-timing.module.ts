import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StoreTimings } from "../../store/entities/store-timings.entity";
import { StoreCloseTimings } from "../../store/entities/store-close-timings.entity";
import { StoreLocation } from "../../store/entities/store-location.entity";
import { StoreAvailabilityService } from "./store-availability.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([StoreTimings, StoreCloseTimings, StoreLocation]),
  ],
  providers: [StoreAvailabilityService],
  exports: [StoreAvailabilityService],
})
export class StoreTimingModule {}
