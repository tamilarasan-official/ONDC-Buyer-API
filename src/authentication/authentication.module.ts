import { Module } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { AuthenticationController } from './authentication.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/user/entities/user.entity';
import { UserService } from 'src/user/user.service';
import { UserOtp } from 'src/user/entities/user-otp.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserOtp])],
  controllers: [AuthenticationController],
  providers: [AuthenticationService, UserService],
  exports: [AuthenticationService],
})
export class AuthenticationModule {}
