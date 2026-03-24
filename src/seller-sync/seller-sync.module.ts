import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SellerSyncQueueService } from "./seller-sync.queue.service";
import { SellerSyncWorkerService } from "./seller-sync.worker.service";
import { SellerSyncQueue } from "./entities/seller-sync-queue.entity";
import { Order } from "../order/entities/order.entity";

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    TypeOrmModule.forFeature([SellerSyncQueue, Order]),
  ],
  providers: [SellerSyncQueueService, SellerSyncWorkerService],
  exports: [SellerSyncQueueService],
})
export class SellerSyncModule {}

