import { CouponMetricsReconciliationService } from "./coupon-metrics.reconciliation.service";

describe("CouponMetricsReconciliationService", () => {
  it("should reconcile metrics by backfilling dedupe and upserting user counts", async () => {
    const configService = {
      get: jest.fn().mockReturnValue("*/15 * * * *"),
    } as any;

    const schedulerRegistry = {
      addCronJob: jest.fn(),
    } as any;

    const dataSource = {
      query: jest.fn().mockResolvedValue([]),
    } as any;

    const service = new CouponMetricsReconciliationService(
      configService,
      schedulerRegistry,
      dataSource,
    );

    await service.reconcileMetrics();

    expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
      "coupon_metrics_reconciliation",
      expect.anything(),
    );
    expect(dataSource.query).toHaveBeenCalledTimes(2);
  });

  it("should swallow reconciliation errors to avoid scheduler crashes", async () => {
    const configService = {
      get: jest.fn().mockReturnValue("*/15 * * * *"),
    } as any;

    const schedulerRegistry = {
      addCronJob: jest.fn(),
    } as any;

    const dataSource = {
      query: jest
        .fn()
        .mockRejectedValueOnce(new Error("table missing")),
    } as any;

    const service = new CouponMetricsReconciliationService(
      configService,
      schedulerRegistry,
      dataSource,
    );

    await expect(service.reconcileMetrics()).resolves.toBeUndefined();
  });
});
