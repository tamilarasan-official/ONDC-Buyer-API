import { Controller, Post, Body } from '@nestjs/common';
import { OtpService } from './otp.service';
import { SendOtpDto, VerifyOtpDto } from './dto/send-otp.dto';
import { OtpResponseDto, VerifyOtpResponseDto } from './dto/otp-response.dto';

@Controller('otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('send')
  async sendOtp(
    @Body() sendOtpDto: SendOtpDto,
  ): Promise<OtpResponseDto> {
    return await this.otpService.sendOtp(sendOtpDto);
  }

  @Post('verify')
  async verifyOtp(
    @Body() verifyOtpDto: VerifyOtpDto,
  ): Promise<VerifyOtpResponseDto> {
    return await this.otpService.verifyOtp(verifyOtpDto);
  }
}
