import { Module, forwardRef } from "@nestjs/common";
import { UserService } from "./user.service";
import { UserController } from "./user.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "./entities/user.entity";
import { UserOtp } from "./entities/user-otp.entity";
import { UserAddress } from "./entities/user-address.entity";
import { SharedNotificationModule } from "../shared/notification.module";
import { OtpModule } from "../otp/otp.module";
import { BuyerModule } from "../buyer/buyer.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserOtp, UserAddress]),
    SharedNotificationModule,
    OtpModule,
    forwardRef(() => BuyerModule),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
