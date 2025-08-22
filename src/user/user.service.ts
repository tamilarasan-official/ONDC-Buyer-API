import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "./entities/user.entity";
import { Repository } from "typeorm";
import { LoginDto } from "src/authentication/dto/login.dto";
import { UserOtp } from "./entities/user-otp.entity";
import { GenerateOtpDto } from "src/authentication/dto/generate-otp.dto";

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(UserOtp)
    private readonly userOtpRepository: Repository<UserOtp>
  ) {}

  async generateOtp(generateOtpDto: GenerateOtpDto) {
    try {
      let user = await this.userRepository.findOne({
        where: { phone_number: generateOtpDto.phone_number },
      });

      if (!user) {
        user = this.userRepository.create(generateOtpDto);
        await this.userRepository.save(user);
      }

      const otp = Math.floor(1000 + Math.random() * 9000);
      user.userOtp = this.userOtpRepository.create({ otp, user });

      await this.userOtpRepository.save(user.userOtp);

      return user;
    } catch (error) {
      throw new BadRequestException("Failed to generate OTP", error);
    }
  }

  async login(loginDto: LoginDto) {
    try {
      const user = await this.userRepository.findOne({
        where: { phone_number: loginDto.phone_number },
        relations: ["userOtp"],
      });

      if (!user?.userOtp) {
        throw new NotFoundException("OTP already expired or not found");
      }

      if (user.userOtp.otp !== loginDto.otp) {
        throw new BadRequestException("Invalid OTP");
      }

      const otpEntity = user.userOtp;

      user.userOtp = null;
      await this.userRepository.save(user);

      await this.userOtpRepository.remove(otpEntity);

      return user;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException("Login failed", error);
    }
  }

  async profile(user: any) {
    try {
      const profile = await this.userRepository.findOne({
        where: { id: user.id },
      });

      if (!profile) {
        throw new NotFoundException("User profile not found");
      }

      profile.phone_number = Number(profile.phone_number);

      return profile;
    } catch (error) {
      throw new BadRequestException("Failed to retrieve user profile", error);
    }
  }

  async updateProfile(user: any, updateUserDto: any) {
    try {
      const profile = await this.userRepository.findOne({
        where: { id: user.id },
      });

      if (!profile) {
        throw new NotFoundException("User profile not found");
      }

      if (updateUserDto.phone_number) {
        const existingUser = await this.userRepository.findOne({
          where: { phone_number: updateUserDto.phone_number },
        });

        if (existingUser && existingUser.id !== profile.id) {
          throw new ConflictException("Phone number already in use");
        }
      }

      if (updateUserDto.email) {
        const existingEmailUser = await this.userRepository.findOne({
          where: { email: updateUserDto.email },
        });

        if (existingEmailUser && existingEmailUser.id !== profile.id) {
          throw new ConflictException("Email already in use");
        }
      }

      const updatedUser = Object.assign(profile, updateUserDto);
      await this.userRepository.save(updatedUser);

      updatedUser.phone_number = Number(updatedUser.phone_number);

      return updatedUser;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new ConflictException("Failed to update user profile", error);
    }
  }
}
