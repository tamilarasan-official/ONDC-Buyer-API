import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCodThresholdAndDistanceSettings1775000000000
  implements MigrationInterface
{
  name = "AddCodThresholdAndDistanceSettings1775000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Keep compatibility with existing app_settings key/value architecture.
    // Keys represent domain fields:
    // - cod_daily_threshold
    // - cod_serviceable_distance_km
    const settings = [
      {
        key: "COD_DAILY_THRESHOLD",
        value: "5000",
        category: "app_config",
        description: "Maximum allowable Cash on Delivery amount per day",
      },
      {
        key: "COD_SERVICEABLE_DISTANCE_KM",
        value: "10",
        category: "app_config",
        description:
          "Maximum distance in kilometers within which COD is available",
      },
    ];

    for (const setting of settings) {
      const existing = await queryRunner.query(
        `SELECT id FROM app_settings WHERE key = $1`,
        [setting.key],
      );

      if (existing.length === 0) {
        await queryRunner.query(
          `INSERT INTO app_settings (key, value, category, description, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
          [setting.key, setting.value, setting.category, setting.description],
        );
      } else {
        await queryRunner.query(
          `UPDATE app_settings
           SET value = $1, category = $2, description = $3, updated_at = NOW()
           WHERE key = $4`,
          [setting.value, setting.category, setting.description, setting.key],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM app_settings WHERE key IN ($1, $2)`,
      ["COD_DAILY_THRESHOLD", "COD_SERVICEABLE_DISTANCE_KM"],
    );
  }
}

