import { MigrationInterface, QueryRunner } from "typeorm";

export class AddParentItemId1700000000000 implements MigrationInterface {
  name = "AddParentItemId1700000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add parent_item_id column to item table
    await queryRunner.query(`ALTER TABLE "item" ADD "parent_item_id" integer`);

    // Add foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "item" ADD CONSTRAINT "FK_item_parent_item_id" FOREIGN KEY ("parent_item_id") REFERENCES "item"("id") ON DELETE CASCADE`,
    );

    // Add index for better performance
    await queryRunner.query(
      `CREATE INDEX "IDX_item_parent_item_id" ON "item" ("parent_item_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`DROP INDEX "IDX_item_parent_item_id"`);

    // Drop foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "item" DROP CONSTRAINT "FK_item_parent_item_id"`,
    );

    // Drop column
    await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "parent_item_id"`);
  }
}
