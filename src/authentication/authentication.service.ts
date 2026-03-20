import { BadRequestException, Injectable } from "@nestjs/common";
import { LoginDto } from "./dto/login.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/user/entities/user.entity";
import { Repository } from "typeorm";
import {
  generateAccessToken,
  generateRefreshToken,
  generateGuestAccessToken,
  verifyRefreshToken,
} from "src/shared/utils/jwt";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { UserService } from "src/user/user.service";
import { GenerateOtpDto } from "./dto/generate-otp.dto";
import { GuestLoginDto } from "./dto/guest-login.dto";
import { GuestSession } from "./entities/guest-session.entity";
import { GuestIdentity } from "./entities/guest-identity.entity";
import { createHash, randomBytes, randomUUID } from "crypto";

@Injectable()
export class AuthenticationService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly userService: UserService,
    @InjectRepository(GuestSession)
    private readonly guestSessionRepository: Repository<GuestSession>,
    @InjectRepository(GuestIdentity)
    private readonly guestIdentityRepository: Repository<GuestIdentity>,
  ) {}

  async generateOtp(generateOtpDto: GenerateOtpDto) {
    try {
      const user = await this.userService.generateOtp(generateOtpDto);
      if (user) {
        return { message: "OTP sent successfully" };
      }
    } catch (error) {
      throw new BadRequestException("Failed to generate OTP", error);
    }
  }

  async login(loginDto: LoginDto) {
    try {
      const user = await this.userService.login(loginDto);

      // If the client provides an existing guest `identity_token`, link that
      // stable guest identity to the newly created/confirmed user.
      const rawIdentityToken = loginDto.identity_token?.trim();
      if (rawIdentityToken) {
        const identityTokenHash = createHash("sha256")
          .update(rawIdentityToken)
          .digest("hex");

        const guestIdentity = await this.guestIdentityRepository.findOne({
          where: { identity_token_hash: identityTokenHash },
        });

        if (guestIdentity) {
          guestIdentity.converted_to_user = true;
          guestIdentity.linked_user_id = user.id;
          guestIdentity.converted_at = new Date();
          await this.guestIdentityRepository.save(guestIdentity);

          // Invalidate currently active guest sessions for this identity
          // so the app must use the user JWT after conversion.
          await this.guestSessionRepository.update(
            { id: guestIdentity.identity_id },
            { is_active: false },
          );
        }
      }

      const payload = {
        id: user.id,
        phone_number: user.phone_number,
      };

      return {
        access_token: generateAccessToken(payload),
        refresh_token: generateRefreshToken(payload),
        existing_user: !!(user.name && user.email),
      };
    } catch (error) {
      throw new BadRequestException("Login failed", error.message);
    }
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    try {
      const user = verifyRefreshToken(refreshTokenDto.refresh_token) as any;
      if (!user) {
        throw new BadRequestException("Invalid refresh token");
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
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException("Failed to refresh token", error.message);
    }
  }

  async guestLogin(guestLoginDto: GuestLoginDto) {
    const now = Date.now();
    const jti = randomUUID();

    // 30 minutes is kept in sync with `generateGuestAccessToken()`.
    const expiresAt = new Date(now + 30 * 60 * 1000);

    const rawDeviceId = guestLoginDto.device_id?.trim();
    const deviceIdHash = rawDeviceId
      ? createHash("sha256").update(rawDeviceId).digest("hex")
      : null;

    const platform = (guestLoginDto.platform || "ios").trim().toLowerCase();
    const appVersion = guestLoginDto.app_version?.trim() || null;

    let identityId: string;
    let identityTokenToReturn: string;

    const rawIdentityToken = guestLoginDto.identity_token?.trim() || null;
    if (rawIdentityToken) {
      const identityTokenHash = createHash("sha256")
        .update(rawIdentityToken)
        .digest("hex");

      const existingIdentity = await this.guestIdentityRepository.findOne({
        where: { identity_token_hash: identityTokenHash },
      });

      if (existingIdentity) {
        identityId = existingIdentity.identity_id;
        identityTokenToReturn = rawIdentityToken;

        existingIdentity.last_seen_at = new Date(now);
        existingIdentity.platform = platform || existingIdentity.platform;
        if (deviceIdHash && !existingIdentity.device_id_hash) {
          existingIdentity.device_id_hash = deviceIdHash;
        }
        existingIdentity.app_version = appVersion;
        await this.guestIdentityRepository.save(existingIdentity);
      } else {
        identityId = randomUUID();
        identityTokenToReturn = randomBytes(32).toString("base64url");

        const newIdentity = this.guestIdentityRepository.create({
          identity_id: identityId,
          identity_token_hash: createHash("sha256")
            .update(identityTokenToReturn)
            .digest("hex"),
          platform,
          device_id_hash: deviceIdHash,
          app_version: appVersion,
          last_seen_at: new Date(now),
        });

        await this.guestIdentityRepository.save(newIdentity);
      }
    } else {
      identityId = randomUUID();
      identityTokenToReturn = randomBytes(32).toString("base64url");

      const newIdentity = this.guestIdentityRepository.create({
        identity_id: identityId,
        identity_token_hash: createHash("sha256")
          .update(identityTokenToReturn)
          .digest("hex"),
        platform,
        device_id_hash: deviceIdHash,
        app_version: appVersion,
        last_seen_at: new Date(now),
      });

      await this.guestIdentityRepository.save(newIdentity);
    }

    const session = this.guestSessionRepository.create({
      id: identityId,
      session_token_id: jti,
      platform,
      app_version: appVersion,
      device_id_hash: deviceIdHash,
      is_active: true,
      expires_at: expiresAt,
      last_seen_at: new Date(now),
    });

    await this.guestSessionRepository.save(session);

    const payload = {
      type: "guest",
      guest_id: identityId,
      jti,
      platform,
    };

    return {
      access_token: generateGuestAccessToken(payload),
      token_type: "Bearer",
      is_guest: true,
      expires_in_seconds: 1800,
      identity_token: identityTokenToReturn,
    };
  }
}
