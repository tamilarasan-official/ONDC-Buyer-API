import { AppDataSource } from "./data-source";

async function verifySetup() {

  try {
    await AppDataSource.initialize();
    console.log("✅ Database connected successfully");

    // Check app_settings table
    const settingsCount = await AppDataSource.query(
      "SELECT COUNT(*) as count FROM app_settings"
    );
    console.log(`\n📊 App Settings Count: ${settingsCount[0].count}`);

    // Display all settings
    const settings = await AppDataSource.query(
      "SELECT key, value, category, is_active FROM app_settings ORDER BY category, key"
    );
    
    console.log("\n📋 Current App Settings:");
    console.log("─".repeat(80));
    settings.forEach((s: any) => {
      const status = s.is_active ? "✅" : "❌";
      console.log(`${status} [${s.category}] ${s.key} = ${s.value}`);
    });
    console.log("─".repeat(80));

    // Check migration status
    const migrations = await AppDataSource.query(
      "SELECT COUNT(*) as count FROM migrations"
    );
    console.log(`\n✅ Total Migrations Executed: ${migrations[0].count}`);

    console.log("\n✨ All systems verified successfully!");
  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

verifySetup();
