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

async function seedServiceableAreaSettings() {
  try {
    await AppDataSource.initialize();
    console.log("✅ Data source initialized");

    // Define serviceable area settings
    // Example: Center point in Madurai (9.92671,78.12486) with 5km radius
    const settings = [
      {
        key: "APP_SERVICEABLE_AREA_ENABLED",
        value: "true",
        category: "app_config",
        description: "Enable/disable app serviceable area restriction",
      },
      {
        key: "APP_SERVICEABLE_AREA_CENTER_LAT",
        value: "9.92671", // Example: Madurai center latitude
        category: "app_config",
        description: "Serviceable area center point latitude",
      },
      {
        key: "APP_SERVICEABLE_AREA_CENTER_LNG",
        value: "78.12486", // Example: Madurai center longitude
        category: "app_config",
        description: "Serviceable area center point longitude",
      },
      {
        key: "APP_SERVICEABLE_AREA_RADIUS_KM",
        value: "5", // 5 km radius
        category: "app_config",
        description: "Serviceable area radius in kilometers",
      },
    ];

    console.log(`🌱 Seeding ${settings.length} serviceable area settings...`);

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

    console.log("🎉 Serviceable area settings seeding completed successfully!");
    console.log("\n📝 Configuration:");
    console.log("   - Center: (9.92671,78.12486) - Madurai");
    console.log("   - Radius: 5 km");
    console.log("   - Status: Enabled");
    console.log("\n💡 To change the center point, update APP_SERVICEABLE_AREA_CENTER_LAT and APP_SERVICEABLE_AREA_CENTER_LNG");
    console.log("💡 To change the radius, update APP_SERVICEABLE_AREA_RADIUS_KM");
    console.log("💡 To disable, set APP_SERVICEABLE_AREA_ENABLED to false");
  } catch (error) {
    console.error("❌ Error seeding serviceable area settings:", error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
    process.exit(0);
  }
}

// Run the seeder
seedServiceableAreaSettings();

