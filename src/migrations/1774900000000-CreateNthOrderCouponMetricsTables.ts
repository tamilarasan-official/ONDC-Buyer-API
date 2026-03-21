import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNthOrderCouponMetricsTables1774900000000
  implements MigrationInterface
{
  name = "CreateNthOrderCouponMetricsTables1774900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_order_metrics (
        user_id bigint PRIMARY KEY,
        paid_order_count integer NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS order_paid_events_dedupe (
        order_id bigint PRIMARY KEY,
        user_id bigint NOT NULL,
        processed_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_order_paid_events_dedupe_user_id
      ON order_paid_events_dedupe(user_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_order_paid_events_dedupe_user_id
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS order_paid_events_dedupe
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS user_order_metrics
    `);
  }
}
