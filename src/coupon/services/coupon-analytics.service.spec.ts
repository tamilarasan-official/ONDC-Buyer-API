import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CouponAnalyticsService } from "./coupon-analytics.service";

describe("CouponAnalyticsService", () => {
  let service: CouponAnalyticsService;
  let dataSource: { query: jest.Mock };

  beforeEach(() => {
    dataSource = {
      query: jest.fn(),
    };

    service = new CouponAnalyticsService(dataSource as any);
  });

  it("should return overview analytics", async () => {
    dataSource.query
      .mockResolvedValueOnce([
        {
          total_campaigns: "5",
          active_campaigns: "3",
        },
      ])
      .mockResolvedValueOnce([
        {
          total_coupons: "120",
          active_coupons: "90",
        },
      ])
      .mockResolvedValueOnce([
        {
          reserved_count: "8",
          redeemed_count: "20",
          rolled_back_count: "5",
          failed_count: "2",
          total_discount_amount: "2500.5",
          delivery_waived_count: "7",
          orders_with_coupon: "18",
        },
      ]);

    const result = await service.getOverview(
      "2026-03-01T00:00:00Z",
      "2026-03-31T23:59:59Z",
    );

    expect(result.campaigns).toEqual({ total: 5, active: 3 });
    expect(result.coupons).toEqual({ total: 120, active: 90 });
    expect(result.funnel).toEqual({
      reserved: 8,
      redeemed: 20,
      rolled_back: 5,
      failed: 2,
      redemption_rate: 74.07,
    });
    expect(result.financials).toEqual({
      total_discount_amount: 2500.5,
      avg_discount_amount: 125.03,
      delivery_waived_count: 7,
      orders_with_coupon: 18,
    });
  });

  it("should reject invalid date range", async () => {
    await expect(
      service.getOverview("2026-04-01T00:00:00Z", "2026-03-01T00:00:00Z"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("should return campaign analytics", async () => {
    dataSource.query
      .mockResolvedValueOnce([
        {
          id: "12",
          campaign_key: "summer-2026",
          title: "Summer 2026",
          status: "active",
        },
      ])
      .mockResolvedValueOnce([
        {
          total_codes: "100",
          active_codes: "85",
          inactive_codes: "5",
          expired_codes: "8",
          revoked_codes: "2",
        },
      ])
      .mockResolvedValueOnce([
        {
          reserved_count: "4",
          redeemed_count: "35",
          rolled_back_count: "3",
          failed_count: "2",
          unique_redeemed_users: "29",
          total_discount_amount: "5600",
          delivery_waived_count: "11",
          orders_with_coupon: "32",
        },
      ])
      .mockResolvedValueOnce([
        {
          date: "2026-03-18",
          redeemed_count: "10",
          total_discount_amount: "1500",
        },
      ])
      .mockResolvedValueOnce([
        {
          coupon_id: "777",
          code: "SUMMERAB12",
          type: "percent",
          redeemed_count: "15",
          total_discount_amount: "2200",
        },
      ]);

    const result = await service.getCampaignAnalytics(
      12,
      "2026-03-01T00:00:00Z",
      "2026-03-31T23:59:59Z",
    );

    expect(result.campaign).toEqual({
      id: 12,
      campaign_key: "summer-2026",
      title: "Summer 2026",
      status: "active",
    });

    expect(result.codes).toEqual({
      total: 100,
      active: 85,
      inactive: 5,
      expired: 8,
      revoked: 2,
    });

    expect(result.funnel).toEqual({
      reserved: 4,
      redeemed: 35,
      rolled_back: 3,
      failed: 2,
      unique_redeemed_users: 29,
      redemption_rate: 87.5,
    });

    expect(result.financials).toEqual({
      total_discount_amount: 5600,
      avg_discount_amount: 160,
      delivery_waived_count: 11,
      orders_with_coupon: 32,
    });

    expect(result.daily).toEqual([
      {
        date: "2026-03-18",
        redeemed_count: 10,
        total_discount_amount: 1500,
      },
    ]);

    expect(result.top_coupons).toEqual([
      {
        coupon_id: 777,
        code: "SUMMERAB12",
        type: "percent",
        redeemed_count: 15,
        total_discount_amount: 2200,
      },
    ]);
  });

  it("should throw not found when campaign is missing", async () => {
    dataSource.query.mockResolvedValueOnce([]);

    await expect(service.getCampaignAnalytics(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
