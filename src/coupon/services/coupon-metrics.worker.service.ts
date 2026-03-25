import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Worker } from "bullmq";
import Redis from "ioredis";
import {
  CouponMetricsJobData,
  CouponRedeemRetryJobPayload,
  PaidOrderEventJobPayload,
} from "../coupon-metrics.types";
import { CouponMetricsQueueService } from "./coupon-metrics.queue.service";
import { CouponService } from "./coupon.service";
import { PaymentStatus } from "../dto/redeem-coupon.dto";

const COUPON_METRICS_QUEUE_NAME = "coupon-metrics";

@Injectable()
export class CouponMetricsWorkerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(CouponMetricsWorkerService.name);
  private worker: Worker<CouponMetricsJobData> | null = null;
  private workerConnection: Redis | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly couponService: CouponService,
    private readonly couponMetricsQueueService: CouponMetricsQueueService,
  ) {}

  onApplicationBootstrap() {
    const appRole =
      String(
        this.configService.get<string>("APP_ROLE") ?? process.env.APP_ROLE ?? "",
      ).trim().toLowerCase() || "both";

    if (appRole === "api") {
      this.logger.log("CouponMetricsWorkerService disabled for APP_ROLE=api");
      return;
    }

    const host = this.configService.get<string>("REDIS_HOST") || "localhost";
    const port = this.configService.get<number>("REDIS_PORT") || 6379;
    const password = this.configService.get<string>("REDIS_PASSWORD") || undefined;
    const prefix = this.configService.get<string>("BULL_PREFIX") || "tazty-buyer";

    this.workerConnection = new Redis({
      host,
      port,
      password,
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    const concurrency = Number(this.configService.get("COUPON_METRICS_CONCURRENCY")) || 5;

    this.worker = new Worker<CouponMetricsJobData>(
      COUPON_METRICS_QUEUE_NAME,
      (job) => this.processJob(job),
      {
        connection: this.workerConnection,
        concurrency,
        prefix,
      },
    );

    this.worker.on("failed", async (job, err) => {
      if (!job) return;
      const correlationId = (job.data.payload as any)?.correlationId || "coupon-metrics-worker";
      const maxAttempts = Number(job.opts.attempts) || 5;
      this.logger.error(
        `[${correlationId}] Coupon metrics job failed id=${job.id} type=${job.data.type} attempts=${job.attemptsMade}/${maxAttempts}: ${err.message}`,
      );

      if (job.attemptsMade >= maxAttempts) {
        try {
          await this.couponMetricsQueueService.enqueueDlq(job.data, err.message);
        } catch (dlqError) {
          this.logger.error(
            `[${correlationId}] Failed to enqueue DLQ record for job id=${job.id} type=${job.data.type}: ${dlqError instanceof Error ? dlqError.message : String(dlqError)}`,
          );
        }
      }
    });

    this.worker.on("completed", (job) => {
      const correlationId = (job.data.payload as any)?.correlationId || "coupon-metrics-worker";
      this.logger.log(
        `[${correlationId}] Coupon metrics job completed id=${job.id} type=${job.data.type}`,
      );
    });

    this.logger.log(
      `CouponMetricsWorkerService started queue=${COUPON_METRICS_QUEUE_NAME} redis=${host}:${port} concurrency=${concurrency}`,
    );
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    if (this.workerConnection) {
      await this.workerConnection.quit();
      this.workerConnection = null;
    }
  }

  private async processJob(job: Job<CouponMetricsJobData>): Promise<void> {
    if (job.data.type === "paid-order-event") {
      const payload = job.data.payload as PaidOrderEventJobPayload;
      await this.couponService.recordPaidOrderEvent(
        payload.orderId,
        payload.userId,
        payload.correlationId,
      );
      return;
    }

    if (job.data.type === "coupon-redeem-retry") {
      const payload = job.data.payload as CouponRedeemRetryJobPayload;
      await this.couponService.redeemCoupon({
        reservation_token: payload.reservationToken,
        order_id: payload.orderId,
        user_id: payload.userId,
        payment_status: PaymentStatus.PAID,
        idempotency_key: `coupon-redeem-retry-${payload.orderId}-${payload.reservationToken}`,
      });
      return;
    }

    throw new Error(`Unknown coupon metrics job type: ${String((job.data as any)?.type)}`);
  }
}
