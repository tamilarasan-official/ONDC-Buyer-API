import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveVersionNameFromUserDeviceTokens1766300000000
  implements MigrationInterface
{
  name = "RemoveVersionNameFromUserDeviceTokens1766300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("user_device_tokens");

    // Drop version_name column if it exists
    const versionNameColumn = table?.findColumnByName("version_name");
    if (versionNameColumn) {
      await queryRunner.query(
        `ALTER TABLE "user_device_tokens" DROP COLUMN "version_name"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("user_device_tokens");

    // Re-add version_name column if it doesn't exist
    const versionNameColumn = table?.findColumnByName("version_name");
    if (!versionNameColumn) {
      await queryRunner.query(
        `ALTER TABLE "user_device_tokens" ADD "version_name" character varying(50)`,
      );
    }
  }
}

