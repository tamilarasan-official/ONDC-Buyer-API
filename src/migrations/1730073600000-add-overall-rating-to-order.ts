import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOverallRatingToOrder1730073600000
  implements MigrationInterface
{
  name = "AddOverallRatingToOrder1730073600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add overall_rating column to order table
    await queryRunner.query(
      `ALTER TABLE "order" ADD "overall_rating" numeric(3,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove overall_rating column from order table
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "overall_rating"`);
  }
}
