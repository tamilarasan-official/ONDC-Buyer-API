import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
// Note: Install ioredis: npm install ioredis
// Uncomment the import when ioredis is installed:
import Redis from "ioredis";

@Injectable()
export class RedisCouponService {
  private readonly logger = new Logger(RedisCouponService.name);
  private readonly redis: Redis;
  private readonly reserveScript: string;
  private readonly defaultReservationTtl: number;

  constructor(private readonly configService: ConfigService) {
    const redisHost =
      this.configService.get<string>("REDIS_HOST") || "localhost";
    const redisPort = this.configService.get<number>("REDIS_PORT") || 6379;
    const redisPassword = this.configService.get<string>("REDIS_PASSWORD");

    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.defaultReservationTtl =
      this.configService.get<number>("COUPON_RESERVATION_TTL") || 900; // 15 minutes

    // Load LUA script
    this.reserveScript = `
      local quota_key = KEYS[1]
      local reservation_key = KEYS[2]
      local metadata = ARGV[1]
      local ttl = tonumber(ARGV[2]) or ${this.defaultReservationTtl}

      local quota = redis.call('GET', quota_key)
      if quota == false then
        quota = -1
      else
        quota = tonumber(quota)
      end

      if quota ~= -1 and quota <= 0 then
        return "NO_QUOTA"
      end

      if quota ~= -1 then
        local new_quota = redis.call('DECR', quota_key)
        if new_quota < 0 then
          redis.call('INCR', quota_key)
          return "NO_QUOTA"
        end
      end

      redis.call('HSET', reservation_key, 'metadata', metadata, 'created_at', redis.call('TIME')[1])
      redis.call('EXPIRE', reservation_key, ttl)

      return "OK"
    `;

    this.redis.on("error", (error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });

    this.redis.on("connect", () => {
      this.logger.log("Redis connected successfully");
    });
  }

  /**
   * Initialize quota for a coupon in Redis
   */
  async initializeQuota(couponId: number, limit: number): Promise<void> {
    const key = `coupon:quota:${couponId}`;
    await this.redis.set(key, limit);
    this.logger.log(`Initialized quota for coupon ${couponId}: ${limit}`);
  }

  /**
   * Initialize quota only when key is absent.
   * Returns true when initialization happened, false when key already existed.
   */
  async initializeQuotaIfAbsent(
    couponId: number,
    limit: number,
  ): Promise<boolean> {
    const key = `coupon:quota:${couponId}`;
    const result = await this.redis.set(key, limit, "NX");
    const initialized = result === "OK";

    if (initialized) {
      this.logger.log(
        `Initialized missing quota for coupon ${couponId} with remaining=${limit}`,
      );
    }

    return initialized;
  }

  /**
   * Reserve a coupon atomically using LUA script
   */
  async reserveCoupon(
    couponId: number,
    reservationToken: string,
    metadata: Record<string, any>,
    ttl?: number,
  ): Promise<{ success: boolean; reason?: string }> {
    const quotaKey = `coupon:quota:${couponId}`;
    const reservationKey = `coupon:reservation:${reservationToken}`;
    const metadataJson = JSON.stringify(metadata);
    const reservationTtl = ttl || this.defaultReservationTtl;

    try {
      const result = await this.redis.eval(
        this.reserveScript,
        2,
        quotaKey,
        reservationKey,
        metadataJson,
        reservationTtl.toString(),
      );

      if (result === "OK") {
        this.logger.log(
          `Reserved coupon ${couponId} with token ${reservationToken}`,
        );
        return { success: true };
      } else if (result === "NO_QUOTA") {
        this.logger.warn(`No quota available for coupon ${couponId}`);
        return { success: false, reason: "NO_QUOTA" };
      } else {
        this.logger.error(`Unexpected result from reservation script: ${result}`);
        return { success: false, reason: "UNKNOWN_ERROR" };
      }
    } catch (error) {
      this.logger.error(
        `Error reserving coupon ${couponId}: ${error.message}`,
        error.stack,
      );
      return { success: false, reason: "REDIS_ERROR" };
    }
  }

  /**
   * Get reservation metadata
   */
  async getReservation(
    reservationToken: string,
  ): Promise<Record<string, any> | null> {
    const key = `coupon:reservation:${reservationToken}`;
    const metadata = await this.redis.hget(key, "metadata");
    if (!metadata) {
      return null;
    }
    return JSON.parse(metadata);
  }

  /**
   * Release reservation and increment quota (rollback)
   * IMPORTANT: Always restores quota if reservation token exists, even if reservation expired
   * This is because quota was consumed when reservation was created, so it must be restored
   */
  async releaseReservation(
    couponId: number,
    reservationToken: string,
  ): Promise<void> {
    const quotaKey = `coupon:quota:${couponId}`;
    const reservationKey = `coupon:reservation:${reservationToken}`;

    // Check if reservation exists
    const exists = await this.redis.exists(reservationKey);
    
    if (exists) {
      // Delete reservation if it exists
      await this.redis.del(reservationKey);
      this.logger.log(
        `🗑️ Deleted reservation ${reservationToken} for coupon ${couponId}`,
      );
    } else {
      // Reservation doesn't exist (expired or already deleted)
      this.logger.warn(
        `⚠️ Reservation ${reservationToken} for coupon ${couponId} does not exist in Redis (may have expired). Quota will still be restored.`,
      );
    }

    // ALWAYS restore quota - quota was consumed when reservation was created
    // Even if reservation expired, we need to restore the quota
    await this.redis.incr(quotaKey);
    this.logger.log(
      `✅ Restored quota for coupon ${couponId} (reservation ${exists ? 'released' : 'expired/missing'})`,
    );
  }

  /**
   * Get remaining quota
   */
  async getQuota(couponId: number): Promise<number | null> {
    const key = `coupon:quota:${couponId}`;
    const quota = await this.redis.get(key);
    return quota ? parseInt(quota, 10) : null;
  }

  /**
   * Increment quota (for compensating operations)
   */
  async incrementQuota(couponId: number, amount: number = 1): Promise<void> {
    const key = `coupon:quota:${couponId}`;
    await this.redis.incrby(key, amount);
    this.logger.log(`Incremented quota for coupon ${couponId} by ${amount}`);
  }

  /**
   * Delete reservation (after successful redemption)
   */
  async deleteReservation(reservationToken: string): Promise<void> {
    const key = `coupon:reservation:${reservationToken}`;
    await this.redis.del(key);
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    await this.redis.quit();
  }
}

