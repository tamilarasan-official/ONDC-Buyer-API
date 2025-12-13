import { DataSource } from "typeorm";
import "dotenv/config";

// Initialize data source
const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

async function seedAppSettings() {
  try {
    await AppDataSource.initialize();
    console.log("✅ Data source initialized");

    // Define settings to seed
    const settings = [
      {
        key: "PLATFORM_FEE",
        value: "50",
        category: "app_config",
        description: "Platform fee charged per order",
      },
      {
        key: "INCLUDE_PLATFORM_FEE",
        value: "false",
        category: "app_config",
        description: "Whether to include platform fee in orders",
      },
      {
        key: "SUPPORT_PHONE",
        value: "+919952520699",
        category: "support",
        description: "Customer support phone number",
      },
      {
        key: "SUPPORT_EMAIL",
        value: "support@tazty.in",
        category: "support",
        description: "Customer support email address",
      },
      {
        key: "APP_OPERATION_HOURS_ENABLED",
        value: "true",
        category: "app_config",
        description: "Enable/disable app operational hours restriction",
      },
      {
        key: "APP_OPERATION_HOURS",
        value: "0900-1700",
        category: "app_config",
        description: "App operational hours (HHMM-HHMM format)",
      },
      {
        key: "RAZORPAY_KEY_ID",
        value: "rzp_test_RYoAp8xLUKGiWa",
        category: "payment",
        description: "Razorpay API Key ID",
      },
      {
        key: "RAZORPAY_KEY_SECRET",
        value: "aZU636O8lC8j3qwIwHh9aUmw",
        category: "payment",
        description: "Razorpay API Key Secret",
      },
    ];

    console.log(`🌱 Seeding ${settings.length} app settings...`);

    for (const setting of settings) {
      // Check if setting already exists
      const existing = await AppDataSource.query(
        `SELECT * FROM app_settings WHERE key = $1`,
        [setting.key],
      );

      if (existing.length > 0) {
        // Update existing setting
        await AppDataSource.query(
          `UPDATE app_settings 
           SET value = $1, category = $2, description = $3, updated_at = NOW()
           WHERE key = $4`,
          [setting.value, setting.category, setting.description, setting.key],
        );
        console.log(`✅ Updated: ${setting.key} = ${setting.value}`);
      } else {
        // Insert new setting
        await AppDataSource.query(
          `INSERT INTO app_settings (key, value, category, description, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
          [setting.key, setting.value, setting.category, setting.description],
        );
        console.log(`✅ Inserted: ${setting.key} = ${setting.value}`);
      }
    }

    console.log("🎉 Seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding app settings:", error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
    process.exit(0);
  }
}

// Run the seeder
seedAppSettings();
