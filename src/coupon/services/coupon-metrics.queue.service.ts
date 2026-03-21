import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import {
  CouponMetricsJobData,
  CouponRedeemRetryJobPayload,
  PaidOrderEventJobPayload,
} from "../coupon-metrics.types";

const COUPON_METRICS_QUEUE_NAME = "coupon-metrics";
const COUPON_METRICS_DLQ_NAME = "coupon-metrics-dlq";

@Injectable()
export class CouponMetricsQueueService {
  private readonly logger = new Logger(CouponMetricsQueueService.name);
  private readonly queue: Queue<CouponMetricsJobData>;
  private readonly dlqQueue: Queue<CouponMetricsJobData>;

  constructor(
    @Inject("REDIS_CLIENT") redisClient: Redis,
    private readonly configService: ConfigService,
  ) {
    const prefix = this.configService.get<string>("BULL_PREFIX") || "tazty-buyer";

    this.queue = new Queue<CouponMetricsJobData>(COUPON_METRICS_QUEUE_NAME, {
      connection: redisClient,
      prefix,
      defaultJobOptions: {
        attempts: this.getAttempts(),
        backoff: {
          type: "exponential",
          delay: this.getBackoffDelayMs(),
        },
        removeOnComplete: this.getRemoveOnComplete(),
        removeOnFail: false,
      },
    });

    this.dlqQueue = new Queue<CouponMetricsJobData>(COUPON_METRICS_DLQ_NAME, {
      connection: redisClient,
      prefix,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
      },
    });
  }

  private getAttempts(): number {
    const attempts = Number(this.configService.get("COUPON_METRICS_ATTEMPTS"));
    return attempts > 0 ? attempts : 5;
  }

  private getBackoffDelayMs(): number {
    const delay = Number(this.configService.get("COUPON_METRICS_BACKOFF_DELAY_MS"));
    return delay > 0 ? delay : 2000;
  }

  private getRemoveOnComplete(): boolean {
    const value = String(this.configService.get("COUPON_METRICS_REMOVE_ON_COMPLETE") ?? "").toLowerCase();
    return value === "1" || value === "true";
  }

  private getDlqAlertThreshold(): number {
    const threshold = Number(
      this.configService.get("COUPON_METRICS_DLQ_ALERT_THRESHOLD"),
    );
    return threshold > 0 ? threshold : 100;
  }

  async enqueuePaidOrderEvent(
    payload: PaidOrderEventJobPayload,
  ): Promise<string | null> {
    const job = await this.queue.add(
      "paid-order-event",
      {
        type: "paid-order-event",
        payload,
      },
      {
        jobId: `paid-order-event-${payload.orderId}`,
      },
    );

    this.logger.log(
      `[${payload.correlationId}] Enqueued paid order metrics job for order ${payload.orderId}, user ${payload.userId}`,
    );
    return job?.id ?? null;
  }

  async enqueueCouponRedeemRetry(
    payload: CouponRedeemRetryJobPayload,
  ): Promise<string | null> {
    const job = await this.queue.add(
      "coupon-redeem-retry",
      {
        type: "coupon-redeem-retry",
        payload,
      },
      {
        jobId: `coupon-redeem-retry-${payload.orderId}-${payload.reservationToken}`,
      },
    );

    this.logger.log(
      `[${payload.correlationId}] Enqueued coupon redeem retry for order ${payload.orderId}, token=${payload.reservationToken}`,
    );
    return job?.id ?? null;
  }

  async enqueueDlq(
    data: CouponMetricsJobData,
    reason: string,
  ): Promise<void> {
    const correlationId = (data.payload as any)?.correlationId || "coupon-metrics-dlq";

    await this.dlqQueue.add(
      data.type,
      data,
      {
        jobId: `dlq-${data.type}-${Date.now()}-${Math.round(Math.random() * 10000)}`,
      },
    );

    this.logger.error(
      `[${correlationId}] Sent job to DLQ queue=${COUPON_METRICS_DLQ_NAME}, type=${data.type}, reason=${reason}`,
    );

    try {
      const counts = await (this.dlqQueue as any).getJobCounts(
        "waiting",
        "active",
        "delayed",
        "paused",
      );
      const depth =
        (counts.waiting || 0) +
        (counts.active || 0) +
        (counts.delayed || 0) +
        (counts.paused || 0);

      this.logger.log(
        `[${correlationId}] DLQ depth=${depth} (waiting=${counts.waiting || 0}, active=${counts.active || 0}, delayed=${counts.delayed || 0}, paused=${counts.paused || 0})`,
      );

      if (depth >= this.getDlqAlertThreshold()) {
        this.logger.warn(
          `[${correlationId}] DLQ depth alert threshold reached: depth=${depth}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `[${correlationId}] Failed to fetch DLQ depth: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
