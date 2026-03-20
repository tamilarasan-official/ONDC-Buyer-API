import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedBuyerCancelTimingKeys1769300000000
  implements MigrationInterface
{
  name = "SeedBuyerCancelTimingKeys1769300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const settings = [
      {
        key: "BUYER_CANCEL_TIMING_VALUE",
        value: "10",
        category: "app_config",
        description: "Enter cancellation duration in seconds",
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
           SET value = $1, category = $2, description = $3, is_active = true, updated_at = NOW()
           WHERE key = $4`,
          [setting.value, setting.category, setting.description, setting.key],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM app_settings WHERE key = $1`,
      ["BUYER_CANCEL_TIMING_VALUE"],
    );
  }
}

