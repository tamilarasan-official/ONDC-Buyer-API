import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedLogoAppSetting1777100000000 implements MigrationInterface {
  name = "SeedLogoAppSetting1777100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const setting = {
      key: "LOGO",
      value: "https://tazty.in/lovable-uploads/tazty.png",
      category: "ui_config",
      description: "Brand logo URL used in email templates and invoice output",
    };

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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM app_settings WHERE key = $1`, ["LOGO"]);
  }
}

