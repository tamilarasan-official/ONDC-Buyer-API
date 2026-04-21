import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import { GuestSession } from "./entities/guest-session.entity";

@Injectable()
export class GuestSessionCleanupService {
  private readonly logger = new Logger(GuestSessionCleanupService.name);

  constructor(
    @InjectRepository(GuestSession)
    private readonly guestSessionRepository: Repository<GuestSession>,
  ) {}

  // Cleanup runs every 6 hours by default.
  @Cron("0 */6 * * *", {
    timeZone: "Asia/Kolkata",
  })
  async cleanupExpiredGuestSessions() {
    const now = new Date();
    const result = await this.guestSessionRepository.delete({
      expires_at: LessThan(now),
    });

    if (result.affected && result.affected > 0) {
      this.logger.log(
        `🧹 Cleaned up expired guest sessions: ${result.affected}`,
      );
    }
  }
}

