import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';
import { AirtelSmsProvider } from '../sms/providers/airtel-sms.provider';
import { OtpVerification } from './entities/otp-verification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([OtpVerification]),
    HttpModule.register({
      timeout: 10000,
    }),
    ConfigModule,
  ],
  controllers: [OtpController],
  providers: [OtpService, AirtelSmsProvider],
  exports: [OtpService],
})
export class OtpModule {}
