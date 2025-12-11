import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAgentDetailsJson1764936600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add agent_details_json column to order_tracking table
    await queryRunner.query(
      `ALTER TABLE "order_tracking" ADD COLUMN "agent_details_json" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove agent_details_json column from order_tracking table
    await queryRunner.query(
      `ALTER TABLE "order_tracking" DROP COLUMN "agent_details_json"`,
    );
  }
}

