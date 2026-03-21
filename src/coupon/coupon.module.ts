import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { CouponCampaign } from "./entities/coupon-campaign.entity";
import { Coupon } from "./entities/coupon.entity";
import { CouponRedemption } from "./entities/coupon-redemption.entity";
import { CouponCounter } from "./entities/coupon-counter.entity";
import { Item } from "../item/entities/item.entity";
import { Store } from "../store/entities/store.entity";
import { Cart } from "../cart/entities/cart.entity";
import { CartItem } from "../cart/entities/cart-item.entity";
import { CouponService } from "./services/coupon.service";
import { CouponExportService } from "./services/coupon-export.service";
import { RedisCouponService } from "./services/redis-coupon.service";
import { CouponAnalyticsService } from "./services/coupon-analytics.service";
import { CouponMetricsQueueService } from "./services/coupon-metrics.queue.service";
import { CouponMetricsWorkerService } from "./services/coupon-metrics.worker.service";
import { CouponMetricsReconciliationService } from "./services/coupon-metrics.reconciliation.service";
import { AdminCouponController } from "./controllers/admin-coupon.controller";
import { AdminAccessModule } from "../super-admin-access/super-admin-access.module";

@Module({
  imports: [
    ConfigModule,
    AdminAccessModule,
    TypeOrmModule.forFeature([
      CouponCampaign,
      Coupon,
      CouponRedemption,
      CouponCounter,
      Item,
      Store,
      Cart,
      CartItem,
    ]),
  ],
  controllers: [AdminCouponController],
  providers: [
    CouponService,
    CouponExportService,
    RedisCouponService,
    CouponAnalyticsService,
    CouponMetricsQueueService,
    CouponMetricsWorkerService,
    CouponMetricsReconciliationService,
  ],
  exports: [CouponService, RedisCouponService, CouponMetricsQueueService],
})
export class CouponModule {}


