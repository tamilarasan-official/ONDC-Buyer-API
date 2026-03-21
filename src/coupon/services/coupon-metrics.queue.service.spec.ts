jest.mock("bullmq", () => {
  class Queue {
    static instances: Queue[] = [];
    static addMock = jest.fn().mockResolvedValue({ id: "job-1" });
    static getJobCountsMock = jest.fn().mockResolvedValue({
      waiting: 10,
      active: 5,
      delayed: 0,
      paused: 0,
    });

    public readonly name: string;

    constructor(name: string) {
      this.name = name;
      Queue.instances.push(this);
    }

    add(...args: any[]) {
      return Queue.addMock(...args);
    }

    getJobCounts(...args: any[]) {
      return Queue.getJobCountsMock(...args);
    }
  }

  return { Queue };
});

import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { CouponMetricsQueueService } from "./coupon-metrics.queue.service";

describe("CouponMetricsQueueService", () => {
  beforeEach(() => {
    const mockedQueue = Queue as any;
    mockedQueue.instances.length = 0;
    mockedQueue.addMock.mockClear();
    mockedQueue.getJobCountsMock.mockClear();
  });

  it("should log DLQ depth and alert when threshold is reached", async () => {
    const mockedQueue = Queue as any;
    mockedQueue.getJobCountsMock.mockResolvedValue({
      waiting: 40,
      active: 30,
      delayed: 10,
      paused: 0,
    });

    const configService = {
      get: jest.fn((key: string) => {
        if (key === "BULL_PREFIX") return "tazty-buyer";
        if (key === "COUPON_METRICS_DLQ_ALERT_THRESHOLD") return "50";
        return undefined;
      }),
    } as unknown as ConfigService;

    const service = new CouponMetricsQueueService({} as any, configService);
    const warnSpy = jest.spyOn((service as any).logger, "warn");

    await service.enqueueDlq(
      {
        type: "coupon-redeem-retry",
        payload: {
          orderId: 1,
          userId: 2,
          reservationToken: "token-1",
          correlationId: "corr-1",
        },
      } as any,
      "test-failure",
    );

    expect(mockedQueue.getJobCountsMock).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("DLQ depth alert threshold reached: depth=80"),
    );
  });

  it("should not throw when DLQ depth query fails", async () => {
    const mockedQueue = Queue as any;
    mockedQueue.getJobCountsMock.mockRejectedValue(new Error("redis down"));

    const configService = {
      get: jest.fn((key: string) => {
        if (key === "BULL_PREFIX") return "tazty-buyer";
        return undefined;
      }),
    } as unknown as ConfigService;

    const service = new CouponMetricsQueueService({} as any, configService);

    await expect(
      service.enqueueDlq(
        {
          type: "paid-order-event",
          payload: {
            orderId: 10,
            userId: 22,
            correlationId: "corr-2",
          },
        } as any,
        "test-failure",
      ),
    ).resolves.toBeUndefined();
  });
});
