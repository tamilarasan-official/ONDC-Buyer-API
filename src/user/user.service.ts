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
      user.otp = this.userOtpRepository.create({ otp, user });

      await this.userOtpRepository.save(user.otp);

      return user;
    } catch (error) {
      throw new BadRequestException("Failed to generate OTP", error);
    }
  }

  async login(loginDto: LoginDto) {
    try {
      const user = await this.userRepository.findOne({
        where: { phone_number: loginDto.phone_number },
        relations: ["otp"],
      });

      if (!user?.otp) {
        throw new NotFoundException("OTP already expired or not found");
      }

      if (user.otp.otp !== loginDto.otp) {
        throw new BadRequestException("Invalid OTP");
      }

      const otpEntity = user.otp;

      user.otp = null;
      await this.userRepository.save(user);

      await this.userOtpRepository.remove(otpEntity);

      return user;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        console.log("Known error:", error.message);
        throw error;
      }
      console.log("Unknown error:", error);
      throw new BadRequestException("Login failed", error);
    }
  }
}
