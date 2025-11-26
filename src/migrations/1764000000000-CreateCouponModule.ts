import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCouponModule1764000000000 implements MigrationInterface {
  name = "CreateCouponModule1764000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create coupon_type_enum
    await queryRunner.query(`
      CREATE TYPE coupon_type_enum AS ENUM (
        'flat',
        'percent',
        'free_delivery',
        'first_order',
        'nth_order',
        'referral'
      );
    `);

    // Create coupon_campaigns table
    await queryRunner.query(`
      CREATE TABLE coupon_campaigns (
        id BIGSERIAL PRIMARY KEY,
        campaign_key VARCHAR(80) UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        created_by VARCHAR(64),
        status VARCHAR(16) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'expired', 'revoked')),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // Create coupons table
    await queryRunner.query(`
      CREATE TABLE coupons (
        id BIGSERIAL PRIMARY KEY,
        campaign_id BIGINT NOT NULL REFERENCES coupon_campaigns(id) ON DELETE CASCADE,
        code VARCHAR(64) UNIQUE NOT NULL,
        type coupon_type_enum NOT NULL,
        type_meta JSONB DEFAULT '{}',
        value NUMERIC NULL,
        value_type VARCHAR(10) NOT NULL CHECK (value_type IN ('rupees', 'percent')),
        max_discount_amount NUMERIC NULL,
        min_cart_value NUMERIC DEFAULT 0,
        valid_pincodes TEXT[] NULL,
        valid_radius_center GEOMETRY(Point) NULL,
        valid_radius_km NUMERIC NULL,
        applicable_store_ids BIGINT[] NULL,
        user_usage_limit INT DEFAULT 1,
        global_usage_limit BIGINT NULL,
        per_store_limit BIGINT NULL,
        stackable BOOLEAN DEFAULT FALSE,
        priority INT NULL,
        exported BOOLEAN DEFAULT FALSE,
        exported_by VARCHAR(64) NULL,
        exported_at TIMESTAMPTZ NULL,
        start_at TIMESTAMPTZ NULL,
        end_at TIMESTAMPTZ NULL,
        status VARCHAR(16) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired', 'revoked')),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT percent_max_discount_check CHECK (
          (type != 'percent') OR (max_discount_amount IS NOT NULL)
        ),
        CONSTRAINT stackable_priority_check CHECK (
          (stackable = FALSE) OR (priority IS NOT NULL)
        )
      );
    `);

    // Create coupon_redemptions table
    await queryRunner.query(`
      CREATE TABLE coupon_redemptions (
        id BIGSERIAL PRIMARY KEY,
        coupon_id BIGINT NOT NULL REFERENCES coupons(id) ON DELETE RESTRICT,
        campaign_id BIGINT NOT NULL REFERENCES coupon_campaigns(id) ON DELETE RESTRICT,
        user_id BIGINT NULL,
        order_id BIGINT NULL,
        amount_applied NUMERIC NULL,
        delivery_waived BOOLEAN DEFAULT FALSE,
        status VARCHAR(20) NOT NULL CHECK (status IN ('reserved', 'redeemed', 'failed', 'rolled_back')),
        reserved_token UUID NULL,
        idempotency_key VARCHAR(128) UNIQUE NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // Create coupon_counters table (for fast reads)
    await queryRunner.query(`
      CREATE TABLE coupon_counters (
        coupon_id BIGINT PRIMARY KEY REFERENCES coupons(id) ON DELETE CASCADE,
        redeemed_count BIGINT DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX idx_coupons_campaign_id ON coupons(campaign_id);
      CREATE INDEX idx_coupons_code ON coupons(code);
      CREATE INDEX idx_coupons_status ON coupons(status);
      CREATE INDEX idx_coupons_type ON coupons(type);
      CREATE INDEX idx_coupons_start_end ON coupons(start_at, end_at);
      CREATE INDEX idx_coupon_redemptions_coupon_id ON coupon_redemptions(coupon_id);
      CREATE INDEX idx_coupon_redemptions_user_id ON coupon_redemptions(user_id);
      CREATE INDEX idx_coupon_redemptions_order_id ON coupon_redemptions(order_id);
      CREATE INDEX idx_coupon_redemptions_reserved_token ON coupon_redemptions(reserved_token);
      CREATE INDEX idx_coupon_redemptions_idempotency_key ON coupon_redemptions(idempotency_key);
      CREATE INDEX idx_coupon_redemptions_status ON coupon_redemptions(status);
    `);

    // Create GIST index for geometry (if PostGIS is available)
    await queryRunner.query(`
      CREATE INDEX idx_coupons_radius_center ON coupons USING GIST(valid_radius_center);
    `).catch(() => {
      // Ignore if PostGIS is not available
    });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS coupon_counters;`);
    await queryRunner.query(`DROP TABLE IF EXISTS coupon_redemptions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS coupons;`);
    await queryRunner.query(`DROP TABLE IF EXISTS coupon_campaigns;`);
    await queryRunner.query(`DROP TYPE IF EXISTS coupon_type_enum;`);
  }
}


