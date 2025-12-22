import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveAppVersionAndVersionCodeFromUser1766200000000
  implements MigrationInterface
{
  name = "RemoveAppVersionAndVersionCodeFromUser1766200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("user");

    // Drop version_code column if it exists
    const versionCodeColumn = table?.findColumnByName("version_code");
    if (versionCodeColumn) {
      await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "version_code"`);
    }

    // Drop app_version column if it exists
    const appVersionColumn = table?.findColumnByName("app_version");
    if (appVersionColumn) {
      await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "app_version"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("user");

    // Check if app_version column exists
    const appVersionColumn = table?.findColumnByName("app_version");
    if (!appVersionColumn) {
      await queryRunner.query(
        `ALTER TABLE "user" ADD "app_version" character varying(50) DEFAULT '1.0.0'`,
      );
      // Update existing rows to have the default value
      await queryRunner.query(
        `UPDATE "user" SET "app_version" = '1.0.0' WHERE "app_version" IS NULL`,
      );
    }

    // Check if version_code column exists
    const versionCodeColumn = table?.findColumnByName("version_code");
    if (!versionCodeColumn) {
      await queryRunner.query(
        `ALTER TABLE "user" ADD "version_code" integer DEFAULT 3`,
      );
      // Update existing rows to have the default value
      await queryRunner.query(
        `UPDATE "user" SET "version_code" = 3 WHERE "version_code" IS NULL`,
      );
    }
  }
}

