import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserAddressIndexes1762413000000
  implements MigrationInterface
{
  name = "AddUserAddressIndexes1762413000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add index on user_id for faster lookups by user
    await queryRunner.query(
      `CREATE INDEX "idx_user_address_user_id" ON "user_address" ("user_id")`,
    );

    // Add composite index for the exact query pattern used in getAllAddresses
    // This index supports: WHERE user_id = ? ORDER BY is_default DESC, created_at DESC
    await queryRunner.query(
      `CREATE INDEX "idx_user_address_lookup" ON "user_address" ("user_id", "is_default" DESC, "created_at" DESC)`,
    );

    // Add index on is_default for finding default addresses quickly
    await queryRunner.query(
      `CREATE INDEX "idx_user_address_is_default" ON "user_address" ("is_default") WHERE "is_default" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_user_address_is_default"`);
    await queryRunner.query(`DROP INDEX "idx_user_address_lookup"`);
    await queryRunner.query(`DROP INDEX "idx_user_address_user_id"`);
  }
}
