import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPreorderCouponType1765000000000 implements MigrationInterface {
  name = "AddPreorderCouponType1765000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add PREORDER to enum
    await queryRunner.query(`
      ALTER TYPE coupon_type_enum ADD VALUE IF NOT EXISTS 'preorder';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing enum values easily
    // This would require recreating the enum
    // Manual intervention required if rollback is needed
  }
}

