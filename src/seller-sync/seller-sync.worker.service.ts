import { HttpService } from "@nestjs/axios";
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { firstValueFrom } from "rxjs";
import { Job, Worker } from "bullmq";
import Redis from "ioredis";
import { Repository } from "typeorm";
import { Order } from "../order/entities/order.entity";
import { SellerSyncJobData } from "./seller-sync.types";
import { SellerSyncQueueService } from "./seller-sync.queue.service";

const SELLER_SYNC_QUEUE_NAME = "seller-sync";

/** Get reference_id from job data for outbox updates. */
function getReferenceId(data: SellerSyncJobData): string | null {
  const p = data.payload;
  if (!p) return null;
  if (data.type === "order.push") return p.external_order_no ?? p.order_number ?? null;
  if (data.type === "order.cancel") return p.external_order_id ?? null;
  if (data.type === "review.push") return p.order_id != null ? String(p.order_id) : null;
  return null;
}

/**
 * BullMQ worker for seller-sync queue. Uses a dedicated Redis connection
 * (required for blocking BRPOP). On success (2xx) marks outbox "sent"; on
 * final failure marks outbox "failed". No cron - retries are via BullMQ attempts.
 */
@Injectable()
export class SellerSyncWorkerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SellerSyncWorkerService.name);
  private worker: Worker<SellerSyncJobData> | null = null;
  private workerConnection: Redis | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly sellerSyncQueueService: SellerSyncQueueService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  onApplicationBootstrap() {
    process.stdout.write("[SellerSync] onApplicationBootstrap() entered\n");
    const appRole =
      String(
        this.configService.get<string>("APP_ROLE") ?? process.env.APP_ROLE ?? "",
      ).trim().toLowerCase() || "both";
    process.stdout.write(`[SellerSync] APP_ROLE=${appRole}\n`);
    if (appRole === "api") {
      this.logger.log(
        "SellerSyncWorkerService disabled (APP_ROLE=api, worker not started)",
      );
      process.stdout.write(
        "[SellerSync] Skipping worker start (APP_ROLE=api)\n",
      );
      return;
    }

    const host = this.configService.get<string>("REDIS_HOST") || "localhost";
    const port = this.configService.get<number>("REDIS_PORT") || 6379;
    const password = this.configService.get<string>("REDIS_PASSWORD") || undefined;

    this.workerConnection = new Redis({
      host,
      port,
      password,
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    const concurrency =
      Number(this.configService.get("SELLER_SYNC_CONCURRENCY")) || 5;
    const prefix = this.configService.get<string>("BULL_PREFIX") || "tazty-buyer";

    this.worker = new Worker<SellerSyncJobData>(
      SELLER_SYNC_QUEUE_NAME,
      (job) => this.processJob(job),
      {
        connection: this.workerConnection,
        concurrency,
        prefix,
      },
    );

    this.worker.on("failed", (job, err) => {
      if (job) {
        const responseBody = (err as any)?.response?.data;
        this.logger.error(
          `Seller sync job ${job.id} failed (type=${job.data.type}, attempt=${job.attemptsMade}/${job.opts.attempts}): ${err.message}`,
        );
        if (responseBody) {
          this.logger.error(
            `Seller response: ${JSON.stringify(responseBody)}`,
          );
        }
        // Mark outbox "failed" when max attempts reached (no more retries).
        const maxAttempts = Number(job.opts.attempts) || 5;
        // moveToFailed increments attemptsMade before this event; do not add +1 (avoids off-by-one).
        const attemptsMade = Number(job.attemptsMade) || 0;
        if (attemptsMade >= maxAttempts) {
          const refId = getReferenceId(job.data);
          if (refId) {
            this.sellerSyncQueueService
              .markOutboxFailedByReference(
                refId,
                job.data.type,
                err.message,
                attemptsMade,
              )
              .catch((e) =>
                this.logger.warn(`Failed to mark outbox failed: ${e.message}`),
              );
          }
        }
      }
    });

    this.worker.on("completed", (job) => {
      this.logger.log(
        `Seller sync job ${job.id} completed (type=${job.data.type})`,
      );
      const refId = getReferenceId(job.data);
      if (refId) {
        // moveToCompleted increments attemptsMade before this event; +1 would double-count (e.g. 1st success → 2).
        const attemptsUsed = Number(job.attemptsMade) || 0;
        this.sellerSyncQueueService
          .updateOutboxToSent(refId, job.data.type, attemptsUsed)
          .catch((e) =>
            this.logger.warn(`Failed to mark outbox sent: ${e.message}`),
          );
      }
    });

    this.worker.on("ready", () => {
      this.logger.log("Worker ready, waiting for jobs (queue=seller-sync)");
      process.stdout.write(
        "[SellerSync] Worker ready, waiting for jobs (queue=seller-sync)\n",
      );
    });

    this.logger.log(
      `SellerSyncWorkerService started (queue=${SELLER_SYNC_QUEUE_NAME}, concurrency=${concurrency}, redis=${host}:${port})`,
    );
    process.stdout.write(
      `[SellerSync] Worker started queue=${SELLER_SYNC_QUEUE_NAME} redis=${host}:${port}\n`,
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

  private getSellerApiUrl(): string {
    const fromEnv = process.env.SELLER_API_URL;
    if (fromEnv?.trim()) return fromEnv.trim();
    const fromConfig = this.configService.get<string>("SELLER_API_URL");
    if (fromConfig?.trim()) return fromConfig.trim();
    return "http://localhost:3000";
  }

  private async processJob(job: Job<SellerSyncJobData>): Promise<void> {
    const baseUrl = this.getSellerApiUrl();
    const endpoint = `${baseUrl}${job.data.endpoint}`;

    this.logger.log(
      `Processing seller sync job ${job.id} (type=${job.data.type}, attempt=${job.attemptsMade + 1}) to ${endpoint}`,
    );

    // order.push: skip HTTP if outbox already skipped or buyer order already cancelled (e.g. COD delay window).
    if (job.data.type === "order.push") {
      const refId = getReferenceId(job.data);
      if (refId) {
        const outboxRow = await this.sellerSyncQueueService.getOutboxRow(
          "order.push",
          refId,
        );
        if (outboxRow?.status === "skipped") {
          this.logger.debug(
            `[SELLER_SYNC_SKIP] worker order.push skip=outbox_skipped job_id=${job.id} reference_id=${refId} outbox_id=${outboxRow.id}`,
          );
          this.logger.log(
            `Skipping order.push job ${job.id}: outbox already skipped (reference_id=${refId})`,
          );
          return;
        }
        const order = await this.orderRepository.findOne({
          where: { order_number: refId },
          select: ["id", "status"],
        });
        if (order?.status === "cancelled") {
          this.logger.debug(
            `[SELLER_SYNC_SKIP] worker order.push skip=buyer_cancelled job_id=${job.id} reference_id=${refId} order_id=${order.id} marking_outbox_skipped`,
          );
          await this.sellerSyncQueueService.markOutboxSkippedByReference(
            refId,
            "order.push",
            "order_cancelled_before_push",
          );
          this.logger.log(
            `Skipping order.push job ${job.id}: order cancelled on buyer (reference_id=${refId})`,
          );
          return;
        }
      }
    }

    const timeoutMs =
      Number(this.configService.get("SELLER_SYNC_TIMEOUT_MS")) || 10000;

    try {
      const response = await firstValueFrom(
        this.httpService.post(endpoint, job.data.payload, {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: timeoutMs,
        }),
      );
      this.logger.log(
        `Seller responded ${response.status} for job ${job.id}`,
      );
      // Outbox "sent" is set in worker.on("completed")
    } catch (err) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      this.logger.error(
        `Seller returned ${status ?? "no response"} for job ${job.id}: ${err.message}`,
      );
      if (body) {
        this.logger.error(`Seller error body: ${JSON.stringify(body)}`);
      }
      throw err;
    }
  }
}
