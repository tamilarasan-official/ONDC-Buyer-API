import {
  BadRequestException,
  ConflictException,
  Injectable,
  Inject,
  forwardRef,
  Optional,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "./entities/user.entity";
import { Repository } from "typeorm";
import { LoginDto } from "src/authentication/dto/login.dto";
import { UserOtp } from "./entities/user-otp.entity";
import { GenerateOtpDto } from "src/authentication/dto/generate-otp.dto";
import { UserAddress } from "./entities/user-address.entity";
import { NotificationService } from "../buyer/notification.service";
import { OtpService } from "../otp/otp.service";
import { OtpPurpose } from "../otp/entities/otp-verification.entity";
import { ConfigService } from "@nestjs/config";
import { CartService } from "../buyer/cart.service";

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(UserOtp)
    private readonly userOtpRepository: Repository<UserOtp>,

    @InjectRepository(UserAddress)
    private readonly userAddressRepository: Repository<UserAddress>,

    private readonly notificationService: NotificationService,
    private readonly otpService: OtpService,
    private readonly configService: ConfigService,

    @Optional()
    @Inject(forwardRef(() => CartService))
    private readonly cartService?: CartService,
  ) {}

  async generateOtp(generateOtpDto: GenerateOtpDto) {
    try {
      // Convert phone number to string format for OTP service
      const phoneNumberString = `+91${generateOtpDto.phone_number}`;

      // Send OTP using the new OTP service
      const otpResponse = await this.otpService.sendOtp({
        phone_number: phoneNumberString,
        purpose: OtpPurpose.REGISTRATION,
      });

      if (!otpResponse.success) {
        throw new BadRequestException(otpResponse.message);
      }

      // Create or find user
      let user = await this.userRepository.findOne({
        where: { phone_number: generateOtpDto.phone_number },
      });

      if (!user) {
        user = this.userRepository.create(generateOtpDto);
        await this.userRepository.save(user);
      }

      return {
        ...user,
        otp_sent: true,
        message: otpResponse.message,
        expires_in_minutes: otpResponse.expires_in_minutes,
      };
    } catch (error) {
      throw new BadRequestException("Failed to generate OTP", error);
    }
  }

  async login(loginDto: LoginDto) {
    try {
      // Convert phone number to string format for OTP service
      const phoneNumberString = `+91${loginDto.phone_number}`;

      // Verify OTP using the new OTP service
      const otpResponse = await this.otpService.verifyOtp({
        phone_number: phoneNumberString,
        otp: loginDto.otp.toString(),
        purpose: OtpPurpose.REGISTRATION,
      });

      if (!otpResponse.success || !otpResponse.verified) {
        throw new BadRequestException(otpResponse.message);
      }

      // Find user
      const user = await this.userRepository.findOne({
        where: { phone_number: loginDto.phone_number },
      });

      if (!user) {
        throw new NotFoundException("User not found");
      }

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

      // Get support contact information from ConfigService
      const supportNumber = this.configService.get<string>("SUPPORT_PHONE");
      const supportEmail = this.configService.get<string>("SUPPORT_EMAIL");

      // Convert to plain object and add support contact information
      // Explicitly map all fields to ensure proper serialization
      const profileData: any = {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        phone_number: profile.phone_number,
        status: profile.status,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        addresses: profile.addresses || [],
        support_number: supportNumber || null,
        support_email: supportEmail || null,
      };

      return profileData;
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

      // Update cart if needed (new address set as default)
      if (this.shouldUpdateCart(user.id, createAddressDto, true)) {
        await this.updateCartForAddressChange(user.id);
      }

      return address;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException("Failed to add address", error);
    }
  }

  async getAllAddresses(user: any) {
    try {
      // Optimized query using QueryBuilder for better performance
      // Uses direct column reference instead of relation to avoid unnecessary joins
      const addresses = await this.userAddressRepository
        .createQueryBuilder("address")
        .where("address.user_id = :userId", { userId: user.id })
        .orderBy("address.is_default", "DESC")
        .addOrderBy("address.created_at", "DESC")
        .getMany();

      return addresses;
    } catch (error) {
      throw new BadRequestException("Failed to retrieve addresses", error);
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

  async updateAddress(user: any, addressId: number, updateAddressDto: any) {
    try {
      const profile = await this.userRepository.findOne({
        where: { id: user.id },
        relations: ["addresses"],
      });

      if (!profile) {
        throw new NotFoundException("User profile not found");
      }

      const address = await this.userAddressRepository.findOne({
        where: { id: addressId, user: { id: user.id } },
      });

      if (!address) {
        throw new NotFoundException("Address not found");
      }

      // Store original address data for comparison
      const originalAddress = { ...address };

      // If setting this address as default, unset all other addresses first
      if (updateAddressDto.is_default === true) {
        for (const addr of profile.addresses) {
          // Skip the address being updated
          if (addr.id !== addressId) {
            addr.is_default = false;
            await this.userAddressRepository.save(addr);
          }
        }
      }

      const updatedAddress = Object.assign(address, updateAddressDto);
      await this.userAddressRepository.save(updatedAddress);

      // Update cart if needed
      if (this.shouldUpdateCart(user.id, updateAddressDto, false, originalAddress)) {
        await this.updateCartForAddressChange(user.id);
      }

      return updatedAddress;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException("Failed to update address", error);
    }
  }

  /**
   * Check if cart needs to be updated based on address changes
   * @param userId - User ID
   * @param addressData - New/updated address data
   * @param isNewAddress - Whether this is a new address or update
   * @param existingAddress - Existing address (for updates)
   * @returns boolean - Whether cart should be updated
   */
  private shouldUpdateCart(
    userId: number,
    addressData: any,
    isNewAddress: boolean,
    existingAddress?: UserAddress,
  ): boolean {
    // Case 1: New address created as default
    if (isNewAddress && addressData.is_default === true) {
      return true;
    }

    // Case 2: Existing address set as default
    if (!isNewAddress && addressData.is_default === true) {
      return true;
    }

    // Case 3: Default address coordinates/pincode updated
    if (!isNewAddress && existingAddress?.is_default === true) {
      const locationChanged =
        (addressData.latitude !== undefined &&
          addressData.latitude !== existingAddress.latitude) ||
        (addressData.longitude !== undefined &&
          addressData.longitude !== existingAddress.longitude) ||
        (addressData.pincode !== undefined &&
          addressData.pincode !== existingAddress.pincode);

      return locationChanged;
    }

    return false;
  }

  /**
   * Update cart when user's default address changes
   * @param userId - User ID
   */
  private async updateCartForAddressChange(userId: number): Promise<void> {
    // Skip cart update if CartService is not available (e.g., in AuthenticationModule context)
    if (!this.cartService) {
      this.logger.warn(
        `⚠️ CartService not available, skipping cart update for user ${userId}`,
      );
      return;
    }

    try {
      this.logger.log(
        `🔄 Updating cart for user ${userId} due to address change`,
      );

      // Use CartService's public method to recalculate cart
      await this.cartService.recalculateCartForUser(userId);
    } catch (error) {
      this.logger.error(
        `❌ Failed to update cart for user ${userId} after address change: ${error.message}`,
        error.stack,
      );
      // Don't throw error - address update should succeed even if cart update fails
      // Cart will be updated on next cart operation (add item, get cart, etc.)
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
