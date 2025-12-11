import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPreorderFieldsToOrderItem1765000002000 implements MigrationInterface {
  name = "AddPreorderFieldsToOrderItem1765000002000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add is_preorder column
    await queryRunner.query(`
      ALTER TABLE "order_item" 
      ADD COLUMN "is_preorder" boolean NOT NULL DEFAULT false;
    `);

    // Add preorder_campaign_id column
    await queryRunner.query(`
      ALTER TABLE "order_item" 
      ADD COLUMN "preorder_campaign_id" bigint;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "order_item" DROP COLUMN "preorder_campaign_id";
    `);
    await queryRunner.query(`
      ALTER TABLE "order_item" DROP COLUMN "is_preorder";
    `);
  }
}

