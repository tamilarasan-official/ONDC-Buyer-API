import { MigrationInterface, QueryRunner } from "typeorm";

export class ExpandStoreLocationAddressState1776400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "store_location"
        ALTER COLUMN "address_state" TYPE VARCHAR(100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "store_location"
        ALTER COLUMN "address_state" TYPE VARCHAR(5)
    `);
  }
}
