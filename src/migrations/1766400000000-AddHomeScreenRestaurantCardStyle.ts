import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHomeScreenRestaurantCardStyle1766400000000
  implements MigrationInterface
{
  name = "AddHomeScreenRestaurantCardStyle1766400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if setting already exists
    const existing = await queryRunner.query(
      `SELECT * FROM app_settings WHERE key = 'HOME_SCREEN_RESTAURANT_CARD_STYLE'`,
    );

    if (existing.length === 0) {
      // Insert new setting
      await queryRunner.query(`
        INSERT INTO app_settings (key, value, category, description, is_active, created_at, updated_at) VALUES
        ('HOME_SCREEN_RESTAURANT_CARD_STYLE', '1', 'ui_config', 'Home screen restaurant card style (1 = default)', true, NOW(), NOW())
      `);
      console.log("✅ Added HOME_SCREEN_RESTAURANT_CARD_STYLE setting");
    } else {
      // Update existing setting to ensure default value
      await queryRunner.query(`
        UPDATE app_settings 
        SET value = '1', 
            category = 'ui_config', 
            description = 'Home screen restaurant card style (1 = default)',
            updated_at = NOW()
        WHERE key = 'HOME_SCREEN_RESTAURANT_CARD_STYLE'
      `);
      console.log("✅ Updated HOME_SCREEN_RESTAURANT_CARD_STYLE setting");
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the setting
    await queryRunner.query(`
      DELETE FROM app_settings WHERE key = 'HOME_SCREEN_RESTAURANT_CARD_STYLE'
    `);
    console.log("✅ Removed HOME_SCREEN_RESTAURANT_CARD_STYLE setting");
  }
}

