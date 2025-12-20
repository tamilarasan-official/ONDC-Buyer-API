import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVersionNameAndVersionCodeToUserDeviceTokens1766100000000
  implements MigrationInterface
{
  name = "AddVersionNameAndVersionCodeToUserDeviceTokens1766100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("user_device_tokens");

    // Check if version_name column exists
    const versionNameColumn = table?.findColumnByName("version_name");
    if (!versionNameColumn) {
      await queryRunner.query(
        `ALTER TABLE "user_device_tokens" ADD "version_name" character varying(50)`,
      );
    }

    // Check if version_code column exists
    const versionCodeColumn = table?.findColumnByName("version_code");
    if (!versionCodeColumn) {
      await queryRunner.query(
        `ALTER TABLE "user_device_tokens" ADD "version_code" integer`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("user_device_tokens");

    // Drop version_code column if it exists
    const versionCodeColumn = table?.findColumnByName("version_code");
    if (versionCodeColumn) {
      await queryRunner.query(
        `ALTER TABLE "user_device_tokens" DROP COLUMN "version_code"`,
      );
    }

    // Drop version_name column if it exists
    const versionNameColumn = table?.findColumnByName("version_name");
    if (versionNameColumn) {
      await queryRunner.query(
        `ALTER TABLE "user_device_tokens" DROP COLUMN "version_name"`,
      );
    }
  }
}

