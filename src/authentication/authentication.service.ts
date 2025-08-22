import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from 'src/shared/utils/jwt';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UserService } from 'src/user/user.service';
import { GenerateOtpDto } from './dto/generate-otp.dto';

@Injectable()
export class AuthenticationService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly userService: UserService,
  ) { }

  async generateOtp(generateOtpDto: GenerateOtpDto) {
    try {
      const user = await this.userService.generateOtp(generateOtpDto)
      if(user) {
        return { message: 'OTP sent successfully' };
      }
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to generate OTP', error);
    }
  }

  async login(loginDto: LoginDto) {
    try {
      console.log("Login DTO:", loginDto);
      const user = await this.userService.login(loginDto)
      console.log("User after login:", user);

      const payload = {
        id: user.id,
        phone_number: user.phone_number,
      };

      console.log("Payload for tokens:", payload);

      return {
        access_token: generateAccessToken(payload),
        refresh_token: generateRefreshToken(payload),
      }

    } catch (error) {
      console.error("Login error:", error);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        console.error("Specific error caught:", error);
        throw error;
      }
      console.error("General error caught:", error);
      throw new BadRequestException('Login failed', error.message);
    }
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    try {
      const user = verifyRefreshToken(refreshTokenDto.refresh_token) as any;
      if (!user) {
        throw new BadRequestException('Invalid refresh token');
      }

      const newPayload = {
        id: user.id,
        phone_number: user.phone_number,
      };

      return {
        access_token: generateAccessToken(newPayload),
        refresh_token: generateRefreshToken(newPayload),
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to refresh token', error.message);
    }
  }
}
