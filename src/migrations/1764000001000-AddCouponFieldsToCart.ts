import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCouponFieldsToCart1764000001000 implements MigrationInterface {
  name = "AddCouponFieldsToCart1764000001000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cart" 
      ADD COLUMN "coupon_code" VARCHAR(64) NULL,
      ADD COLUMN "coupon_reservation_token" UUID NULL,
      ADD COLUMN "coupon_id" BIGINT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_cart_coupon_code" ON "cart"("coupon_code");
      CREATE INDEX "idx_cart_coupon_reservation_token" ON "cart"("coupon_reservation_token");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_cart_coupon_reservation_token";
      DROP INDEX IF EXISTS "idx_cart_coupon_code";
    `);

    await queryRunner.query(`
      ALTER TABLE "cart" 
      DROP COLUMN IF EXISTS "coupon_id",
      DROP COLUMN IF EXISTS "coupon_reservation_token",
      DROP COLUMN IF EXISTS "coupon_code";
    `);
  }
}


