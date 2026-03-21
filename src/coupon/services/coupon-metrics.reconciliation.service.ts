import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";
import { DataSource } from "typeorm";
import { CronJob } from "cron";

@Injectable()
export class CouponMetricsReconciliationService {
  private readonly logger = new Logger(CouponMetricsReconciliationService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly dataSource: DataSource,
  ) {
    this.registerReconcileCron();
  }

  private registerReconcileCron() {
    const expression =
      this.configService.get<string>("COUPON_METRICS_RECONCILE_CRON") ||
      "0 */2 * * *";

    const job = new CronJob(
      expression,
      () => this.reconcileMetrics(),
      null,
      false,
      "Asia/Kolkata",
    );

    this.schedulerRegistry.addCronJob("coupon_metrics_reconciliation", job);
    job.start();

    this.logger.log(
      `Registered coupon metrics reconciliation cron: expression=${expression} timezone=Asia/Kolkata`,
    );
  }

  async reconcileMetrics(): Promise<void> {
    const correlationId = `coupon-metrics-reconcile-${Date.now()}`;

    try {
      // Ensure dedupe contains all paid-like order transitions so downstream metrics stay deterministic.
      await this.dataSource.query(
        `
        INSERT INTO order_paid_events_dedupe(order_id, user_id, processed_at)
        SELECT o.id, o.user_id, now()
        FROM "order" o
        WHERE o.status IN ('paid', 'confirmed', 'delivered', 'completed')
        ON CONFLICT (order_id) DO NOTHING
      `,
      );

      await this.dataSource.query(
        `
        INSERT INTO user_order_metrics(user_id, paid_order_count, updated_at)
        SELECT d.user_id, COUNT(*)::int AS paid_order_count, now()
        FROM order_paid_events_dedupe d
        GROUP BY d.user_id
        ON CONFLICT (user_id)
        DO UPDATE SET
          paid_order_count = EXCLUDED.paid_order_count,
          updated_at = now()
      `,
      );

      this.logger.log(
        `[${correlationId}] Coupon metrics reconciliation completed`,
      );
    } catch (error) {
      this.logger.error(
        `[${correlationId}] Coupon metrics reconciliation failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
