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
        value: "10",
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
        value: "+919952520699, +919677735329, +919677735316",
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
        value: "0700-2230",
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
      {
        key: "RAZORPAY_WEBHOOK_SECRET",
        value: "",
        category: "payment",
        description: "Razorpay Webhook Secret for webhook signature verification (optional but recommended for security)",
      },
      {
        key: "APP_SERVICEABLE_AREA_ENABLED",
        value: "true",
        category: "app_config",
        description: "Enable/disable app serviceable area restriction",
      },
      {
        key: "APP_SERVICEABLE_AREA_CENTER_LAT",
        value: "9.92671",
        category: "app_config",
        description: "Serviceable area center point latitude",
      },
      {
        key: "APP_SERVICEABLE_AREA_CENTER_LNG",
        value: "78.12486",
        category: "app_config",
        description: "Serviceable area center point longitude",
      },
      {
        key: "APP_SERVICEABLE_AREA_RADIUS_KM",
        value: "5",
        category: "app_config",
        description: "Serviceable area radius in kilometers",
      },
      {
        key: "DISTANCE_CALCULATION_METHOD",
        value: "delivery_pricing_api",
        category: "app_config",
        description: "Distance calculation method: haversine, vincenty, euclidean, directions_api, or delivery_pricing_api",
      },
      {
        key: "TAZTY_DELIVERY_PARTNER_API_BASE_URL",
        value: "http://delivery.tazty.in/api/v1",
        category: "app_config",
        description: "Base URL for TAZTY Delivery Partner API",
      },
      {
        key: "TAZTY_DELIVERY_PARTNER_API_KEY",
        value: "c33becbd39da05dac5bf6515b35d784c65e4143cb301f0c7",
        category: "app_config",
        description: "API key for TAZTY Delivery Partner API",
      },
      {
        key: "HOME_SCREEN_RESTAURANT_CARD_STYLE",
        value: "1",
        category: "ui_config",
        description: "Home screen restaurant card style (1 = default)",
      },
      {
        key: "APP_CLOSURE_MESSAGE",
        value: "",
        category: "app_config",
        description: "Custom message to display when app is temporarily closed (if empty, default message will be used)",
      },
      {
        key: "BUYER_APP_ANDROID_MINIMAL_FORCE_UPDATE_VERSION_CODE",
        value: "1",
        category: "app_config",
        description: "Minimum Android app version code required - users with lower versions will be forced to update",
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
