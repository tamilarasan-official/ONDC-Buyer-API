import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFoodTypeToDish1761674961828 implements MigrationInterface {
  name = "AddFoodTypeToDish1761674961828";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // First add the column as nullable
    await queryRunner.query(
      `ALTER TABLE "dish" ADD "food_type" character varying(255)`,
    );

    // Update existing records with empty string
    await queryRunner.query(
      `UPDATE "dish" SET "food_type" = '' WHERE "food_type" IS NULL`,
    );

    // Now make the column NOT NULL
    await queryRunner.query(
      `ALTER TABLE "dish" ALTER COLUMN "food_type" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "dish" DROP COLUMN "food_type"`);
  }
}
