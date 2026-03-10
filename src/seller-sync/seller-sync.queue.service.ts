import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { EntityManager, Repository } from "typeorm";
import { SellerSyncJobData } from "./seller-sync.types";
import { SellerSyncQueue } from "./entities/seller-sync-queue.entity";

const SELLER_SYNC_QUEUE_NAME = "seller-sync";
const OUTBOX_MAX_ATTEMPTS_DEFAULT = 10;

@Injectable()
export class SellerSyncQueueService {
  private readonly logger = new Logger(SellerSyncQueueService.name);
  private readonly queue: Queue<SellerSyncJobData>;

  constructor(
    @Inject("REDIS_CLIENT") redisClient: Redis,
    private readonly configService: ConfigService,
    @InjectRepository(SellerSyncQueue)
    private readonly outboxRepository: Repository<SellerSyncQueue>,
  ) {
    const prefix = this.configService.get<string>("BULL_PREFIX") || "tazty-buyer";

    this.queue = new Queue<SellerSyncJobData>(SELLER_SYNC_QUEUE_NAME, {
      connection: redisClient,
      prefix,
      defaultJobOptions: {
        attempts: this.getDefaultAttempts(),
        backoff: {
          type: "exponential",
          delay: this.getDefaultBackoffDelay(),
        },
        removeOnComplete: this.getRemoveOnComplete(),
        removeOnFail: false,
      },
    });
  }

  private getDefaultAttempts(): number {
    const attempts =
      this.configService.get<number>("SELLER_SYNC_ATTEMPTS") ?? 5;
    return attempts > 0 ? attempts : 5;
  }

  private getDefaultBackoffDelay(): number {
    const delay =
      this.configService.get<number>("SELLER_SYNC_BACKOFF_DELAY_MS") ?? 2000;
    return delay > 0 ? delay : 2000;
  }

  private getRemoveOnComplete(): boolean {
    const val = this.configService.get<string>("SELLER_SYNC_REMOVE_ON_COMPLETE");
    if (val === undefined || val === null) return false;
    return val === "true" || val === "1";
  }

  /** COD orders: delay (ms) before job is processed. Default 30s. */
  getCodDelayMs(): number {
    const ms = Number(this.configService.get("SELLER_SYNC_COD_DELAY_MS"));
    return ms > 0 ? ms : 30_000;
  }

  private getOutboxMaxAttempts(): number {
    const n = Number(this.configService.get("SELLER_SYNC_OUTBOX_MAX_ATTEMPTS"));
    return n > 0 ? n : OUTBOX_MAX_ATTEMPTS_DEFAULT;
  }

  /** Find existing outbox row by type and reference (e.g. when inserted in same tx as order). */
  async getOutboxRow(
    type: string,
    referenceId: string,
  ): Promise<SellerSyncQueue | null> {
    return this.outboxRepository.findOne({
      where: { type, reference_id: referenceId },
      order: { id: "DESC" },
    });
  }

  /** Insert outbox row (pending). Call before enqueue. */
  async addOutboxRow(
    type: "order.push" | "order.cancel" | "review.push",
    referenceId: string,
    payload: Record<string, unknown>,
  ): Promise<SellerSyncQueue> {
    const row = this.outboxRepository.create({
      reference_id: referenceId,
      type,
      payload,
      status: "pending",
      attempts: 0,
    });
    return this.outboxRepository.save(row);
  }

  /**
   * Insert outbox row inside an existing transaction (same tx as order save).
   * Use so outbox is committed only when order is committed.
   */
  async addOutboxRowInTransaction(
    manager: EntityManager,
    type: "order.push" | "order.cancel" | "review.push",
    referenceId: string,
    payload: Record<string, unknown>,
  ): Promise<SellerSyncQueue> {
    const row = manager.getRepository(SellerSyncQueue).create({
      reference_id: referenceId,
      type,
      payload,
      status: "pending",
      attempts: 0,
    });
    return manager.getRepository(SellerSyncQueue).save(row);
  }

  /** Mark outbox row as queued after successful enqueue. */
  async updateOutboxToQueued(
    id: string,
    jobId?: string | null,
  ): Promise<void> {
    await this.outboxRepository.update(id, {
      status: "queued",
      ...(jobId != null ? { bullmq_job_id: jobId } : {}),
      last_error: null,
    });
  }

  /** Update outbox after failed enqueue. */
  async updateOutboxFailed(
    id: string,
    lastError: string,
  ): Promise<void> {
    const row = await this.outboxRepository.findOne({ where: { id } });
    if (!row) return;
    row.attempts += 1;
    row.last_error = lastError;
    if (row.attempts >= this.getOutboxMaxAttempts()) {
      row.status = "failed";
    }
    await this.outboxRepository.save(row);
  }

  /**
   * Mark outbox row as sent (seller returned 2xx). Called by worker on success.
   */
  async updateOutboxToSent(
    referenceId: string,
    type: string,
    attempts?: number,
  ): Promise<void> {
    const row = await this.outboxRepository.findOne({
      where: { reference_id: referenceId, type },
      order: { id: "DESC" },
    });
    if (!row) return;
    await this.outboxRepository.update(row.id, {
      status: "sent",
      sent_at: new Date(),
      last_error: null,
      ...(attempts != null ? { attempts } : {}),
    });
    this.logger.log(`Outbox marked sent: type=${type}, reference_id=${referenceId}`);
  }

  /**
   * Mark outbox row as failed after worker exhausted attempts. Called by worker on final failure.
   */
  async markOutboxFailedByReference(
    referenceId: string,
    type: string,
    lastError: string,
    attempts?: number,
  ): Promise<void> {
    const row = await this.outboxRepository.findOne({
      where: { reference_id: referenceId, type },
      order: { id: "DESC" },
    });
    if (!row) return;
    await this.outboxRepository.update(row.id, {
      status: "failed",
      last_error: lastError,
      ...(attempts != null ? { attempts } : {}),
    });
    this.logger.log(`Outbox marked failed: type=${type}, reference_id=${referenceId}`);
  }

  async enqueueOrderPush(payload: any, options?: { delayMs?: number }): Promise<string | null> {
    const externalOrderNo = payload?.external_order_no;
    this.logger.log(
      `Enqueuing seller order push job for external_order_no=${externalOrderNo}`,
    );

    const jobId = externalOrderNo
      ? `order.push-${externalOrderNo}`
      : undefined;

    const jobOpts: { jobId?: string; delay?: number } = { jobId };
    if (options?.delayMs != null && options.delayMs > 0) {
      jobOpts.delay = options.delayMs;
    }

    const job = await this.queue.add(
      "order.push",
      {
        type: "order.push",
        endpoint: "/orders",
        payload,
      },
      jobOpts,
    );
    return job?.id ?? null;
  }

  async enqueueOrderCancel(payload: {
    external_order_id: string;
    cancel_code: string;
  }): Promise<string | null> {
    this.logger.log(
      `Enqueuing seller order cancel job for external_order_id=${payload.external_order_id}`,
    );

    const job = await this.queue.add(
      "order.cancel",
      {
        type: "order.cancel",
        endpoint: "/orders/cancel-by-order",
        payload,
      },
      { jobId: `order.cancel-${payload.external_order_id}` },
    );
    return job?.id ?? null;
  }

  async enqueueReviewPush(payload: any): Promise<string | null> {
    const orderId = payload?.order_id;
    this.logger.log(
      `Enqueuing seller review push job for order_id=${orderId}`,
    );

    const jobId =
      orderId != null ? `review.push-${orderId}` : undefined;

    const job = await this.queue.add(
      "review.push",
      {
        type: "review.push",
        endpoint: "/reviews",
        payload,
      },
      { jobId },
    );
    return job?.id ?? null;
  }

}
