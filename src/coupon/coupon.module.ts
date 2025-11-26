import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { CouponCampaign } from "./entities/coupon-campaign.entity";
import { Coupon } from "./entities/coupon.entity";
import { CouponRedemption } from "./entities/coupon-redemption.entity";
import { CouponCounter } from "./entities/coupon-counter.entity";
import { CouponService } from "./services/coupon.service";
import { CouponExportService } from "./services/coupon-export.service";
import { RedisCouponService } from "./services/redis-coupon.service";
import { AdminCouponController } from "./controllers/admin-coupon.controller";
import { PublicCouponController } from "./controllers/public-coupon.controller";

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      CouponCampaign,
      Coupon,
      CouponRedemption,
      CouponCounter,
    ]),
  ],
  controllers: [AdminCouponController, PublicCouponController],
  providers: [
    CouponService,
    CouponExportService,
    RedisCouponService,
  ],
  exports: [CouponService, RedisCouponService],
})
export class CouponModule {}


