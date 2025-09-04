import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationService } from '../buyer/notification.service';
import { FCMService } from '../buyer/fcm.service';
import { Notification } from '../notification/entities/notification.entity';
import { User } from '../user/entities/user.entity';
import { UserDeviceToken } from '../user/entities/user-device-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      User,
      UserDeviceToken,
    ]),
  ],
  providers: [NotificationService, FCMService],
  exports: [NotificationService, FCMService],
})
export class SharedNotificationModule {}
