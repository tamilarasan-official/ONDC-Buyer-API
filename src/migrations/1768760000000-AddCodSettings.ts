import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCodSettings1768760000000 implements MigrationInterface {
  name = "AddCodSettings1768760000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const codSettings = [
      {
        key: "COD_ENABLED",
        value: "false",
        category: "app_config",
        description: "Enable or disable Cash on Delivery payment option",
      },
      {
        key: "COD_MIN_AMOUNT",
        value: "0",
        category: "app_config",
        description: "Minimum order amount (₹) for Cash on Delivery",
      },
      {
        key: "COD_MAX_AMOUNT",
        value: "5000",
        category: "app_config",
        description: "Maximum order amount (₹) for Cash on Delivery",
      },
    ];

    for (const setting of codSettings) {
      const existing = await queryRunner.query(
        `SELECT * FROM app_settings WHERE key = $1`,
        [setting.key],
      );

      if (existing.length === 0) {
        await queryRunner.query(
          `INSERT INTO app_settings (key, value, category, description, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
          [setting.key, setting.value, setting.category, setting.description],
        );
        console.log(`✅ Added ${setting.key} setting`);
      } else {
        await queryRunner.query(
          `UPDATE app_settings SET value = $1, category = $2, description = $3, updated_at = NOW() WHERE key = $4`,
          [setting.value, setting.category, setting.description, setting.key],
        );
        console.log(`✅ Updated ${setting.key} setting`);
      }
    }

    // Remove legacy COD_AMOUNT only if it exists (replaced by COD_MIN_AMOUNT / COD_MAX_AMOUNT)
    const codAmountExisting = await queryRunner.query(
      `SELECT * FROM app_settings WHERE key = 'COD_AMOUNT'`,
    );
    if (codAmountExisting.length > 0) {
      await queryRunner.query(
        `DELETE FROM app_settings WHERE key = 'COD_AMOUNT'`,
      );
      console.log("✅ Removed legacy COD_AMOUNT setting");
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove COD settings only if they exist
    const codKeysToRemove = ["COD_ENABLED", "COD_MIN_AMOUNT", "COD_MAX_AMOUNT"];
    for (const key of codKeysToRemove) {
      const existing = await queryRunner.query(
        `SELECT * FROM app_settings WHERE key = $1`,
        [key],
      );
      if (existing.length > 0) {
        await queryRunner.query(`DELETE FROM app_settings WHERE key = $1`, [
          key,
        ]);
        console.log(`✅ Removed ${key} setting`);
      }
    }
  }
}