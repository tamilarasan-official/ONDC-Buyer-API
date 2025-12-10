import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPreorderFieldsToCartItem1765000001000 implements MigrationInterface {
  name = "AddPreorderFieldsToCartItem1765000001000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add is_preorder column
    await queryRunner.query(`
      ALTER TABLE "cart_item" 
      ADD COLUMN "is_preorder" boolean NOT NULL DEFAULT false;
    `);

    // Add preorder_campaign_id column
    await queryRunner.query(`
      ALTER TABLE "cart_item" 
      ADD COLUMN "preorder_campaign_id" bigint;
    `);

    // Add preorder_reservation_token column
    await queryRunner.query(`
      ALTER TABLE "cart_item" 
      ADD COLUMN "preorder_reservation_token" uuid;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cart_item" DROP COLUMN "preorder_reservation_token";
    `);
    await queryRunner.query(`
      ALTER TABLE "cart_item" DROP COLUMN "preorder_campaign_id";
    `);
    await queryRunner.query(`
      ALTER TABLE "cart_item" DROP COLUMN "is_preorder";
    `);
  }
}

