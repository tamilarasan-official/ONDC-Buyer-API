import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueActivePreorderPerItem1776200000000
  implements MigrationInterface
{
  name = "AddUniqueActivePreorderPerItem1776200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Unique partial index: only one ACTIVE PREORDER coupon is allowed per internal_item_id.
    // This is the database-level enforcement for the application-level guard in coupon.service.ts.
    // The partial WHERE clause ensures the constraint only applies to active preorder coupons,
    // so expired/revoked coupons for the same item do not block new campaign creation.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_preorder_active_item"
      ON "coupons" ((type_meta->>'internal_item_id'))
      WHERE type = 'preorder' AND status = 'active'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_preorder_active_item"`);
  }
}
