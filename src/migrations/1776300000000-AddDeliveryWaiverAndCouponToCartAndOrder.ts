import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDeliveryWaiverAndCouponToCartAndOrder1776300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Cart: delivery_waived + original_delivery_fee
    await queryRunner.query(
      `ALTER TABLE "cart" ADD COLUMN IF NOT EXISTS "delivery_waived" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart" ADD COLUMN IF NOT EXISTS "original_delivery_fee" decimal(10,2)`,
    );

    // Order: delivery_waived + original_delivery_fee + coupon_id + coupon_code
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "delivery_waived" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "original_delivery_fee" decimal(10,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "coupon_id" bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "coupon_code" varchar(64)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "coupon_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "coupon_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "original_delivery_fee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "delivery_waived"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart" DROP COLUMN IF EXISTS "original_delivery_fee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart" DROP COLUMN IF EXISTS "delivery_waived"`,
    );
  }
}
