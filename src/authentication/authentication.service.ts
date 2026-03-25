import { BadRequestException, Injectable, Logger } from "@nestjs/common";
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
  private readonly logger = new Logger(AuthenticationService.name);
  private readonly guestAccessTokenTtlSeconds =
    Number(process.env.GUEST_ACCESS_TOKEN_TTL_SECONDS) || 1800;

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
      const existingUser = !!user.email;
      let guestLinkStatus:
        | "not_provided"
        | "invalid_identity_token"
        | "skipped_existing_user"
        | "linked"
        | "already_linked_same_user"
        | "skipped_linked_other_user" = "not_provided";

      // If the client provides an existing guest `identity_token`, link that
      // stable guest identity to the newly created/confirmed user.
      // Security hardening:
      // - Skip linking for existing users
      // - Allow one-time conversion only
      // - Reject relinking to a different user
      const rawIdentityToken = loginDto.identity_token?.trim();
      if (rawIdentityToken) {
        const identityTokenHash = createHash("sha256")
          .update(rawIdentityToken)
          .digest("hex");

        const guestIdentity = await this.guestIdentityRepository.findOne({
          where: { identity_token_hash: identityTokenHash },
        });

        if (!guestIdentity) {
          guestLinkStatus = "invalid_identity_token";
        } else if (existingUser) {
          guestLinkStatus = "skipped_existing_user";
        } else if (guestIdentity.converted_to_user) {
          const linkedUserId = guestIdentity.linked_user_id;
          if (linkedUserId === user.id) {
            guestLinkStatus = "already_linked_same_user";
          } else {
            guestLinkStatus = "skipped_linked_other_user";
            this.logger.warn(
              `Skipped guest link: identity ${guestIdentity.identity_id} already linked to user ${linkedUserId}, attempted by user ${user.id}`,
            );
          }
        } else {
          // Atomic one-time conversion to avoid race conditions.
          const updateResult = await this.guestIdentityRepository
            .createQueryBuilder()
            .update(GuestIdentity)
            .set({
              converted_to_user: true,
              linked_user_id: user.id,
              converted_at: new Date(),
            })
            .where("identity_id = :identityId", {
              identityId: guestIdentity.identity_id,
            })
            .andWhere("converted_to_user = false")
            .execute();

          if (updateResult.affected && updateResult.affected > 0) {
            guestLinkStatus = "linked";
            // Invalidate currently active guest sessions for this identity
            // so the app must use the user JWT after conversion.
            await this.guestSessionRepository.update(
              { id: guestIdentity.identity_id },
              { is_active: false },
            );
          } else {
            // If another request linked it first, resolve idempotently.
            const latestIdentity = await this.guestIdentityRepository.findOne({
              where: { identity_id: guestIdentity.identity_id },
            });
            if (latestIdentity?.linked_user_id === user.id) {
              guestLinkStatus = "already_linked_same_user";
            } else {
              guestLinkStatus = "skipped_linked_other_user";
              this.logger.warn(
                `Skipped guest link after concurrent update: identity ${guestIdentity.identity_id}, attempted by user ${user.id}`,
              );
            }
          }
        }
      }

      const payload = {
        id: user.id,
        phone_number: user.phone_number,
      };

      return {
        access_token: generateAccessToken(payload),
        refresh_token: generateRefreshToken(payload),
        existing_user: existingUser,
        guest_link_status: guestLinkStatus,
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
    const guestTtlSeconds = this.guestAccessTokenTtlSeconds;

    // Keep DB session TTL in sync with guest JWT TTL.
    const expiresAt = new Date(now + guestTtlSeconds * 1000);

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
      expires_in_seconds: guestTtlSeconds,
      identity_token: identityTokenToReturn,
    };
  }
}
