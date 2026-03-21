import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class CouponAnalyticsService {
  constructor(private readonly dataSource: DataSource) {}

  private toNumber(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private parsePeriod(from?: string, to?: string): {
    fromTs: string | null;
    toTs: string | null;
  } {
    const fromTs = from ? new Date(from).toISOString() : null;
    const toTs = to ? new Date(to).toISOString() : null;

    if (fromTs && toTs && new Date(fromTs) > new Date(toTs)) {
      throw new BadRequestException("from must be earlier than or equal to to");
    }

    return { fromTs, toTs };
  }

  async getOverview(from?: string, to?: string): Promise<{
    period: { from: string | null; to: string | null };
    campaigns: { total: number; active: number };
    coupons: { total: number; active: number };
    funnel: {
      reserved: number;
      redeemed: number;
      rolled_back: number;
      failed: number;
      redemption_rate: number;
    };
    financials: {
      total_discount_amount: number;
      avg_discount_amount: number;
      delivery_waived_count: number;
      orders_with_coupon: number;
    };
  }> {
    const { fromTs, toTs } = this.parsePeriod(from, to);

    const [campaignSummary] = await this.dataSource.query(
      `
      SELECT
        COUNT(*)::int AS total_campaigns,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active_campaigns
      FROM coupon_campaigns
      `,
    );

    const [couponSummary] = await this.dataSource.query(
      `
      SELECT
        COUNT(*)::int AS total_coupons,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active_coupons
      FROM coupons
      `,
    );

    const [redemptionSummary] = await this.dataSource.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'reserved')::int AS reserved_count,
        COUNT(*) FILTER (WHERE status = 'redeemed')::int AS redeemed_count,
        COUNT(*) FILTER (WHERE status = 'rolled_back')::int AS rolled_back_count,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count,
        COALESCE(SUM(CASE WHEN status = 'redeemed' THEN amount_applied ELSE 0 END), 0)::numeric AS total_discount_amount,
        COUNT(*) FILTER (WHERE status = 'redeemed' AND delivery_waived = true)::int AS delivery_waived_count,
        COUNT(DISTINCT CASE WHEN status = 'redeemed' AND order_id IS NOT NULL THEN order_id END)::int AS orders_with_coupon
      FROM coupon_redemptions
      WHERE ($1::timestamptz IS NULL OR created_at >= $1)
        AND ($2::timestamptz IS NULL OR created_at <= $2)
      `,
      [fromTs, toTs],
    );

    const reserved = this.toNumber(redemptionSummary?.reserved_count);
    const redeemed = this.toNumber(redemptionSummary?.redeemed_count);
    const rolledBack = this.toNumber(redemptionSummary?.rolled_back_count);
    const failed = this.toNumber(redemptionSummary?.failed_count);
    const finalAttempts = redeemed + rolledBack + failed;

    return {
      period: {
        from: fromTs,
        to: toTs,
      },
      campaigns: {
        total: this.toNumber(campaignSummary?.total_campaigns),
        active: this.toNumber(campaignSummary?.active_campaigns),
      },
      coupons: {
        total: this.toNumber(couponSummary?.total_coupons),
        active: this.toNumber(couponSummary?.active_coupons),
      },
      funnel: {
        reserved,
        redeemed,
        rolled_back: rolledBack,
        failed,
        redemption_rate:
          finalAttempts > 0
            ? Number(((redeemed / finalAttempts) * 100).toFixed(2))
            : 0,
      },
      financials: {
        total_discount_amount: this.toNumber(
          redemptionSummary?.total_discount_amount,
        ),
        avg_discount_amount:
          redeemed > 0
            ? Number(
                (
                  this.toNumber(redemptionSummary?.total_discount_amount) /
                  redeemed
                ).toFixed(2),
              )
            : 0,
        delivery_waived_count: this.toNumber(
          redemptionSummary?.delivery_waived_count,
        ),
        orders_with_coupon: this.toNumber(redemptionSummary?.orders_with_coupon),
      },
    };
  }

  async getCampaignAnalytics(
    campaignId: number,
    from?: string,
    to?: string,
  ): Promise<{
    campaign: {
      id: number;
      campaign_key: string;
      title: string;
      status: string;
    };
    period: { from: string | null; to: string | null };
    codes: {
      total: number;
      active: number;
      inactive: number;
      expired: number;
      revoked: number;
    };
    funnel: {
      reserved: number;
      redeemed: number;
      rolled_back: number;
      failed: number;
      unique_redeemed_users: number;
      redemption_rate: number;
    };
    financials: {
      total_discount_amount: number;
      avg_discount_amount: number;
      delivery_waived_count: number;
      orders_with_coupon: number;
    };
    daily: Array<{
      date: string;
      redeemed_count: number;
      total_discount_amount: number;
    }>;
    top_coupons: Array<{
      coupon_id: number;
      code: string;
      type: string;
      redeemed_count: number;
      total_discount_amount: number;
    }>;
  }> {
    const { fromTs, toTs } = this.parsePeriod(from, to);

    const [campaignRow] = await this.dataSource.query(
      `
      SELECT id, campaign_key, title, status
      FROM coupon_campaigns
      WHERE id = $1
      LIMIT 1
      `,
      [campaignId],
    );

    if (!campaignRow) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found`);
    }

    const [codeSummary] = await this.dataSource.query(
      `
      SELECT
        COUNT(*)::int AS total_codes,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active_codes,
        COUNT(*) FILTER (WHERE status = 'inactive')::int AS inactive_codes,
        COUNT(*) FILTER (WHERE status = 'expired')::int AS expired_codes,
        COUNT(*) FILTER (WHERE status = 'revoked')::int AS revoked_codes
      FROM coupons
      WHERE campaign_id = $1
      `,
      [campaignId],
    );

    const [redemptionSummary] = await this.dataSource.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'reserved')::int AS reserved_count,
        COUNT(*) FILTER (WHERE status = 'redeemed')::int AS redeemed_count,
        COUNT(*) FILTER (WHERE status = 'rolled_back')::int AS rolled_back_count,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count,
        COUNT(DISTINCT CASE WHEN status = 'redeemed' THEN user_id END)::int AS unique_redeemed_users,
        COALESCE(SUM(CASE WHEN status = 'redeemed' THEN amount_applied ELSE 0 END), 0)::numeric AS total_discount_amount,
        COUNT(*) FILTER (WHERE status = 'redeemed' AND delivery_waived = true)::int AS delivery_waived_count,
        COUNT(DISTINCT CASE WHEN status = 'redeemed' AND order_id IS NOT NULL THEN order_id END)::int AS orders_with_coupon
      FROM coupon_redemptions
      WHERE campaign_id = $1
        AND ($2::timestamptz IS NULL OR created_at >= $2)
        AND ($3::timestamptz IS NULL OR created_at <= $3)
      `,
      [campaignId, fromTs, toTs],
    );

    const dailyRows = await this.dataSource.query(
      `
      SELECT
        DATE(created_at)::text AS date,
        COUNT(*) FILTER (WHERE status = 'redeemed')::int AS redeemed_count,
        COALESCE(SUM(CASE WHEN status = 'redeemed' THEN amount_applied ELSE 0 END), 0)::numeric AS total_discount_amount
      FROM coupon_redemptions
      WHERE campaign_id = $1
        AND ($2::timestamptz IS NULL OR created_at >= $2)
        AND ($3::timestamptz IS NULL OR created_at <= $3)
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
      `,
      [campaignId, fromTs, toTs],
    );

    const topCouponRows = await this.dataSource.query(
      `
      SELECT
        c.id::bigint AS coupon_id,
        c.code,
        c.type,
        COUNT(r.id) FILTER (WHERE r.status = 'redeemed')::int AS redeemed_count,
        COALESCE(SUM(CASE WHEN r.status = 'redeemed' THEN r.amount_applied ELSE 0 END), 0)::numeric AS total_discount_amount
      FROM coupons c
      LEFT JOIN coupon_redemptions r
        ON r.coupon_id = c.id
       AND ($2::timestamptz IS NULL OR r.created_at >= $2)
       AND ($3::timestamptz IS NULL OR r.created_at <= $3)
      WHERE c.campaign_id = $1
      GROUP BY c.id, c.code, c.type
      ORDER BY redeemed_count DESC, total_discount_amount DESC
      LIMIT 10
      `,
      [campaignId, fromTs, toTs],
    );

    const redeemed = this.toNumber(redemptionSummary?.redeemed_count);
    const rolledBack = this.toNumber(redemptionSummary?.rolled_back_count);
    const failed = this.toNumber(redemptionSummary?.failed_count);
    const finalAttempts = redeemed + rolledBack + failed;

    return {
      campaign: {
        id: this.toNumber(campaignRow.id),
        campaign_key: String(campaignRow.campaign_key),
        title: String(campaignRow.title),
        status: String(campaignRow.status),
      },
      period: {
        from: fromTs,
        to: toTs,
      },
      codes: {
        total: this.toNumber(codeSummary?.total_codes),
        active: this.toNumber(codeSummary?.active_codes),
        inactive: this.toNumber(codeSummary?.inactive_codes),
        expired: this.toNumber(codeSummary?.expired_codes),
        revoked: this.toNumber(codeSummary?.revoked_codes),
      },
      funnel: {
        reserved: this.toNumber(redemptionSummary?.reserved_count),
        redeemed,
        rolled_back: rolledBack,
        failed,
        unique_redeemed_users: this.toNumber(
          redemptionSummary?.unique_redeemed_users,
        ),
        redemption_rate:
          finalAttempts > 0
            ? Number(((redeemed / finalAttempts) * 100).toFixed(2))
            : 0,
      },
      financials: {
        total_discount_amount: this.toNumber(
          redemptionSummary?.total_discount_amount,
        ),
        avg_discount_amount:
          redeemed > 0
            ? Number(
                (
                  this.toNumber(redemptionSummary?.total_discount_amount) /
                  redeemed
                ).toFixed(2),
              )
            : 0,
        delivery_waived_count: this.toNumber(
          redemptionSummary?.delivery_waived_count,
        ),
        orders_with_coupon: this.toNumber(redemptionSummary?.orders_with_coupon),
      },
      daily: (dailyRows || []).map((row: Record<string, unknown>) => ({
        date: String(row.date),
        redeemed_count: this.toNumber(row.redeemed_count),
        total_discount_amount: this.toNumber(row.total_discount_amount),
      })),
      top_coupons: (topCouponRows || []).map((row: Record<string, unknown>) => ({
        coupon_id: this.toNumber(row.coupon_id),
        code: String(row.code),
        type: String(row.type),
        redeemed_count: this.toNumber(row.redeemed_count),
        total_discount_amount: this.toNumber(row.total_discount_amount),
      })),
    };
  }
}
