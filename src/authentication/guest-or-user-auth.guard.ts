import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Request } from "express";
import { MoreThan, Repository } from "typeorm";
import { verifyAccessToken } from "../shared/utils/jwt";
import { GuestSession } from "./entities/guest-session.entity";

@Injectable()
export class GuestOrUserAuthGuard implements CanActivate {
  constructor(
    @InjectRepository(GuestSession)
    private readonly guestSessionRepository: Repository<GuestSession>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) throw new UnauthorizedException("No token provided");

    try {
      const payload = verifyAccessToken(token) as any;

      // Regular logged-in user token (existing live payload shape)
      if (payload?.id) {
        (request as any).user = payload;
        return true;
      }

      // Guest token flow
      if (
        payload?.type === "guest" &&
        typeof payload?.guest_id === "string" &&
        typeof payload?.jti === "string"
      ) {
        const session = await this.guestSessionRepository.findOne({
          where: {
            id: payload.guest_id,
            session_token_id: payload.jti,
            is_active: true,
            expires_at: MoreThan(new Date()),
          },
        });

        if (!session) {
          throw new UnauthorizedException(
            "Guest session invalid or expired",
          );
        }

        // Debounce DB writes: update last_seen_at only every N minutes.
        // This prevents heavy write load on every discovery request.
        const debounceMinutes = 10;
        const now = new Date();
        const shouldUpdateLastSeenAt =
          !session.last_seen_at ||
          session.last_seen_at.getTime() <
            now.getTime() - debounceMinutes * 60 * 1000;

        if (shouldUpdateLastSeenAt) {
          session.last_seen_at = now;
          await this.guestSessionRepository.save(session);
        }

        (request as any).guest = {
          guest_id: payload.guest_id,
          jti: payload.jti,
          platform: payload.platform,
          type: "guest",
        };

        return true;
      }

      throw new UnauthorizedException("Invalid token payload");
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new UnauthorizedException("Invalid token");
    }
  }
}

