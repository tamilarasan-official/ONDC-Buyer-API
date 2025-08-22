import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { LoginDto } from './dto/login.dto';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { GenerateOtpDto } from './dto/generate-otp.dto';

@Controller('authentication')
export class AuthenticationController {
  constructor(private readonly authenticationService: AuthenticationService) {}

  @Post('generate-otp')
  generateOtp(@Body() generateOtpDto: GenerateOtpDto) {
    return this.authenticationService.generateOtp(generateOtpDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authenticationService.login(loginDto);
  }

  @Post('refresh-token')
  refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authenticationService.refreshToken(refreshTokenDto);
  }

}
