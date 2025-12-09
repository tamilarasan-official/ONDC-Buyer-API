import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCancelReasonToOrderTracking1765282200000
  implements MigrationInterface
{
  name = "AddCancelReasonToOrderTracking1765282200000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add cancel_reason column to order_tracking table
    await queryRunner.query(
      `ALTER TABLE "order_tracking" ADD "cancel_reason" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove cancel_reason column from order_tracking table
    await queryRunner.query(
      `ALTER TABLE "order_tracking" DROP COLUMN "cancel_reason"`,
    );
  }
}

