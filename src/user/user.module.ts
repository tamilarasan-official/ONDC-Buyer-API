import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserOtp } from './entities/user-otp.entity';
import { UserAddress } from './entities/user-address.entity';
import { SharedNotificationModule } from '../shared/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserOtp, UserAddress]),
    SharedNotificationModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
