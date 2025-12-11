import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFoodTypeAndTagsToStore1761680000000
  implements MigrationInterface
{
  name = "AddFoodTypeAndTagsToStore1761680000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "store" ADD "food_type" character varying(50)`,
    );
    await queryRunner.query(`ALTER TABLE "store" ADD "tags" text array`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "store" DROP COLUMN "tags"`);
    await queryRunner.query(`ALTER TABLE "store" DROP COLUMN "food_type"`);
  }
}
