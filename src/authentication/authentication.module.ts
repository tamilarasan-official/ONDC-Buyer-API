import { Module, forwardRef } from "@nestjs/common";
import { AuthenticationService } from "./authentication.service";
import { AuthenticationController } from "./authentication.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "src/user/entities/user.entity";
import { UserOtp } from "src/user/entities/user-otp.entity";
import { UserAddress } from "src/user/entities/user-address.entity";
import { SharedNotificationModule } from "src/shared/notification.module";
import { OtpModule } from "src/otp/otp.module";
import { UserModule } from "src/user/user.module";
import { GuestSession } from "./entities/guest-session.entity";
import { GuestIdentity } from "./entities/guest-identity.entity";
import { GuestSessionCleanupService } from "./guest-session-cleanup.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserOtp,
      UserAddress,
      GuestSession,
      GuestIdentity,
    ]),
    SharedNotificationModule,
    OtpModule,
    forwardRef(() => UserModule),
  ],
  controllers: [AuthenticationController],
  providers: [AuthenticationService, GuestSessionCleanupService],
  exports: [AuthenticationService],
})
export class AuthenticationModule {}
