import { Module, forwardRef } from "@nestjs/common";
import { UserService } from "./user.service";
import { UserController } from "./user.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HttpModule } from "@nestjs/axios";
import { User } from "./entities/user.entity";
import { UserOtp } from "./entities/user-otp.entity";
import { UserAddress } from "./entities/user-address.entity";
import { SharedNotificationModule } from "../shared/notification.module";
import { OtpModule } from "../otp/otp.module";
import { BuyerModule } from "../buyer/buyer.module";
import { AppSettingsModule } from "../shared/app-settings.module";
import { AppServiceableAreaService } from "../shared/services/app-serviceable-area.service";
import { LocationService } from "../shared/services/location.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserOtp, UserAddress]),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    SharedNotificationModule,
    OtpModule,
    AppSettingsModule,
    forwardRef(() => BuyerModule),
  ],
  controllers: [UserController],
  providers: [UserService, AppServiceableAreaService, LocationService],
  exports: [UserService],
})
export class UserModule {}
