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
import { UserAddress } from "./entities/user-address.entity";
import { NotificationService } from "../buyer/notification.service";

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(UserOtp)
    private readonly userOtpRepository: Repository<UserOtp>,

    @InjectRepository(UserAddress)
    private readonly userAddressRepository: Repository<UserAddress>,
    
    private readonly notificationService: NotificationService
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

      // Create OTP notification
      try {
        await this.notificationService.createOTPNotification(
          user.id,
          generateOtpDto.phone_number,
          otp.toString()
        );
      } catch (notificationError) {
        console.error('Failed to create OTP notification:', notificationError.message);
        // Don't throw error as OTP generation should still succeed
      }

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

  async profile(user: any) {
    try {
      const profile = await this.userRepository.findOne({
        where: { id: user.id },
        relations: ["addresses"],
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

  async addAddress(user: any, createAddressDto: any) {
    try {
      const profile = await this.userRepository.findOne({
        where: { id: user.id },
        relations: ["addresses"],
      });

      if (!profile) {
        throw new NotFoundException("User profile not found");
      }

      if (createAddressDto.is_default) {
        for (const addr of profile.addresses) {
          addr.is_default = false;
          await this.userAddressRepository.save(addr);
        }
      }

      const address = this.userAddressRepository.create({
        ...createAddressDto,
        user: profile,
      });
      await this.userAddressRepository.save(address);

      return address;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException("Failed to add address", error);
    }
  }

  async getAddress(id: number) {
    try {
      const address = await this.userAddressRepository.findOne({
        where: { id },
        relations: ["user"],
      });

      if (!address) {
        throw new NotFoundException("Address not found");
      }

      address.user.phone_number = Number(address.user.phone_number);

      return address;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException("Failed to retrieve address", error);
    }
  }

  async updateAddress(user: any, updateAddressDto: any) {
    try {
      const profile = await this.userRepository.findOne({
        where: { id: user.id },
        relations: ["addresses"],
      });

      if (!profile) {
        throw new NotFoundException("User profile not found");
      }

      const address = await this.userAddressRepository.findOne({
        where: { id: updateAddressDto.id, user: { id: user.id } },
      });

      if (!address) {
        throw new NotFoundException("Address not found");
      }

      if (updateAddressDto.is_default) {
        for (const addr of profile.addresses) {
          addr.is_default = false;
          await this.userAddressRepository.save(addr);
        }
      }

      const updatedAddress = Object.assign(address, updateAddressDto);
      await this.userAddressRepository.save(updatedAddress);

      return updatedAddress;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException("Failed to update address", error);
    }
  }

  async deleteAddress(id: number) {
    try {
      const address = await this.userAddressRepository.findOne({
        where: { id },
      });

      if (!address) {
        throw new NotFoundException("Address not found");
      }

      await this.userAddressRepository.remove(address);

      return { message: "Address deleted successfully" };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException("Failed to delete address", error);
    }
  }
}
