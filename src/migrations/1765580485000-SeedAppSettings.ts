import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedAppSettings1765580485000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if settings already exist to avoid duplicates
    const existingSettings = await queryRunner.query(
      `SELECT COUNT(*) as count FROM app_settings`
    );

    if (existingSettings[0].count > 0) {
      console.log("⚠️  App settings already exist. Updating values instead of inserting...");
      
      // Update existing settings
      await queryRunner.query(`
        INSERT INTO app_settings (key, value, category, description, is_active) VALUES
        ('PLATFORM_FEE', '50', 'app_config', 'Platform fee charged per order', true),
        ('INCLUDE_PLATFORM_FEE', 'false', 'app_config', 'Whether to include platform fee in orders', true),
        ('SUPPORT_PHONE', '+919952520699', 'support', 'Customer support phone number', true),
        ('SUPPORT_EMAIL', 'support@tazty.in', 'support', 'Customer support email address', true),
        ('APP_OPERATION_HOURS_ENABLED', 'true', 'app_config', 'Enable/disable app operational hours restriction', true),
        ('APP_OPERATION_HOURS', '0900-1700', 'app_config', 'App operational hours (HHMM-HHMM format)', true),
        ('RAZORPAY_KEY_ID', 'rzp_test_RYoAp8xLUKGiWa', 'payment', 'Razorpay API Key ID', true),
        ('RAZORPAY_KEY_SECRET', 'aZU636O8lC8j3qwIwHh9aUmw', 'payment', 'Razorpay API Key Secret', true)
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          category = EXCLUDED.category,
          description = EXCLUDED.description,
          is_active = EXCLUDED.is_active,
          updated_at = now()
      `);
      
      console.log("✅ App settings updated successfully");
    } else {
      // Insert new settings
      await queryRunner.query(`
        INSERT INTO app_settings (key, value, category, description, is_active) VALUES
        ('PLATFORM_FEE', '50', 'app_config', 'Platform fee charged per order', true),
        ('INCLUDE_PLATFORM_FEE', 'false', 'app_config', 'Whether to include platform fee in orders', true),
        ('SUPPORT_PHONE', '+919952520699', 'support', 'Customer support phone number', true),
        ('SUPPORT_EMAIL', 'support@tazty.in', 'support', 'Customer support email address', true),
        ('APP_OPERATION_HOURS_ENABLED', 'true', 'app_config', 'Enable/disable app operational hours restriction', true),
        ('APP_OPERATION_HOURS', '0900-1700', 'app_config', 'App operational hours (HHMM-HHMM format)', true),
        ('RAZORPAY_KEY_ID', 'rzp_test_RYoAp8xLUKGiWa', 'payment', 'Razorpay API Key ID', true),
        ('RAZORPAY_KEY_SECRET', 'aZU636O8lC8j3qwIwHh9aUmw', 'payment', 'Razorpay API Key Secret', true)
      `);
      
      console.log("✅ App settings seeded successfully");
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove seeded settings
    await queryRunner.query(`
      DELETE FROM app_settings WHERE key IN (
        'PLATFORM_FEE',
        'INCLUDE_PLATFORM_FEE',
        'SUPPORT_PHONE',
        'SUPPORT_EMAIL',
        'APP_OPERATION_HOURS_ENABLED',
        'APP_OPERATION_HOURS',
        'RAZORPAY_KEY_ID',
        'RAZORPAY_KEY_SECRET'
      )
    `);
    
    console.log("✅ App settings seed rolled back");
  }
}
