import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StoreService } from "./store.service";
import { StoreController } from "./store.controller";
import { Store } from "./entities/store.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Store])],
  controllers: [StoreController],
  providers: [StoreService],
  exports: [StoreService],
})
export class StoreModule {}
