import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedCuisineTagOptionsAppSetting1777400000000
  implements MigrationInterface
{
  name = "SeedCuisineTagOptionsAppSetting1777400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const setting = {
      key: "CUISINE_TAG_OPTIONS",
      value: JSON.stringify([
        { id: "south_indian", label: "South Indian" },
        { id: "chettinad", label: "Chettinad" },
        { id: "biryani", label: "Biryani" },
        { id: "bbq", label: "BBQ" },
        { id: "grill", label: "Grill" },
        { id: "arabian", label: "Arabian" },
        { id: "tandoori", label: "Tandoori" },
        { id: "chinese", label: "Chinese" },
        { id: "north_indian", label: "North Indian" },
        { id: "fast_food", label: "Fast Food" },
        { id: "burger", label: "Burger" },
        { id: "cafe", label: "Cafe" },
        { id: "bakery", label: "Bakery" },
        { id: "beverages", label: "Beverages" },
        { id: "juices", label: "Juices" },
        { id: "ice_cream", label: "Ice Cream" },
        { id: "desserts", label: "Desserts" },
        { id: "sweets", label: "Sweets" },
        { id: "parotta", label: "Parotta" },
        { id: "meals", label: "Meals" },
        { id: "fried_chicken", label: "Fried Chicken" },
        { id: "italian", label: "Italian" },
        { id: "korean", label: "Korean" },
        { id: "pizza", label: "Pizza" },
      ]),
      category: "metadata",
      description: "Supported store cuisine tags for filters and dropdowns",
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
    await queryRunner.query(`DELETE FROM app_settings WHERE key = $1`, [
      "CUISINE_TAG_OPTIONS",
    ]);
  }
}

