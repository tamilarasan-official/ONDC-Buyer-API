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
        ('PLATFORM_FEE', '10', 'app_config', 'Platform fee charged per order', true),
        ('INCLUDE_PLATFORM_FEE', 'false', 'app_config', 'Whether to include platform fee in orders', true),
        ('SUPPORT_PHONE', '+919952520699, +919677735329, +919677735316', 'support', 'Customer support phone number', true),
        ('SUPPORT_EMAIL', 'support@tazty.in', 'support', 'Customer support email address', true),
        ('APP_OPERATION_HOURS_ENABLED', 'true', 'app_config', 'Enable/disable app operational hours restriction', true),
        ('APP_OPERATION_HOURS', '0700-2230', 'app_config', 'App operational hours (HHMM-HHMM format)', true),
        ('RAZORPAY_KEY_ID', 'rzp_test_RYoAp8xLUKGiWa', 'payment', 'Razorpay API Key ID', true),
        ('RAZORPAY_KEY_SECRET', 'aZU636O8lC8j3qwIwHh9aUmw', 'payment', 'Razorpay API Key Secret', true),
        ('APP_SERVICEABLE_AREA_ENABLED', 'true', 'app_config', 'Enable/disable app serviceable area restriction', true),
        ('APP_SERVICEABLE_AREA_CENTER_LAT', '9.92671', 'app_config', 'Serviceable area center point latitude', true),
        ('APP_SERVICEABLE_AREA_CENTER_LNG', '78.12486', 'app_config', 'Serviceable area center point longitude', true),
        ('APP_SERVICEABLE_AREA_RADIUS_KM', '5', 'app_config', 'Serviceable area radius in kilometers', true),
        ('DISTANCE_CALCULATION_METHOD', 'delivery_pricing_api', 'app_config', 'Distance calculation method: haversine, vincenty, euclidean, directions_api, or delivery_pricing_api', true),
        ('TAZTY_DELIVERY_PARTNER_API_BASE_URL', 'http://delivery.tazty.in/api/v1', 'app_config', 'Base URL for TAZTY Delivery Partner API', true),
        ('TAZTY_DELIVERY_PARTNER_API_KEY', 'c33becbd39da05dac5bf6515b35d784c65e4143cb301f0c7', 'app_config', 'API key for TAZTY Delivery Partner API', true),
        ('HOME_SCREEN_RESTAURANT_CARD_STYLE', '1', 'ui_config', 'Home screen restaurant card style (1 = default)', true),
        ('APP_CLOSURE_MESSAGE', '', 'app_config', 'Custom message to display when app is temporarily closed (if empty, default message will be used)', true)
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
        ('PLATFORM_FEE', '10', 'app_config', 'Platform fee charged per order', true),
        ('INCLUDE_PLATFORM_FEE', 'false', 'app_config', 'Whether to include platform fee in orders', true),
        ('SUPPORT_PHONE', '+919952520699, +919677735329, +919677735316', 'support', 'Customer support phone number', true),
        ('SUPPORT_EMAIL', 'support@tazty.in', 'support', 'Customer support email address', true),
        ('APP_OPERATION_HOURS_ENABLED', 'true', 'app_config', 'Enable/disable app operational hours restriction', true),
        ('APP_OPERATION_HOURS', '0700-2230', 'app_config', 'App operational hours (HHMM-HHMM format)', true),
        ('RAZORPAY_KEY_ID', 'rzp_test_RYoAp8xLUKGiWa', 'payment', 'Razorpay API Key ID', true),
        ('RAZORPAY_KEY_SECRET', 'aZU636O8lC8j3qwIwHh9aUmw', 'payment', 'Razorpay API Key Secret', true),
        ('APP_SERVICEABLE_AREA_ENABLED', 'true', 'app_config', 'Enable/disable app serviceable area restriction', true),
        ('APP_SERVICEABLE_AREA_CENTER_LAT', '9.92671', 'app_config', 'Serviceable area center point latitude', true),
        ('APP_SERVICEABLE_AREA_CENTER_LNG', '78.12486', 'app_config', 'Serviceable area center point longitude', true),
        ('APP_SERVICEABLE_AREA_RADIUS_KM', '5', 'app_config', 'Serviceable area radius in kilometers', true),
        ('DISTANCE_CALCULATION_METHOD', 'delivery_pricing_api', 'app_config', 'Distance calculation method: haversine, vincenty, euclidean, directions_api, or delivery_pricing_api', true),
        ('TAZTY_DELIVERY_PARTNER_API_BASE_URL', 'http://delivery.tazty.in/api/v1', 'app_config', 'Base URL for TAZTY Delivery Partner API', true),
        ('TAZTY_DELIVERY_PARTNER_API_KEY', 'c33becbd39da05dac5bf6515b35d784c65e4143cb301f0c7', 'app_config', 'API key for TAZTY Delivery Partner API', true),
        ('HOME_SCREEN_RESTAURANT_CARD_STYLE', '1', 'ui_config', 'Home screen restaurant card style (1 = default)', true),
        ('APP_CLOSURE_MESSAGE', '', 'app_config', 'Custom message to display when app is temporarily closed (if empty, default message will be used)', true)
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
        'RAZORPAY_KEY_SECRET',
        'APP_SERVICEABLE_AREA_ENABLED',
        'APP_SERVICEABLE_AREA_CENTER_LAT',
        'APP_SERVICEABLE_AREA_CENTER_LNG',
        'APP_SERVICEABLE_AREA_RADIUS_KM',
        'DISTANCE_CALCULATION_METHOD',
        'TAZTY_DELIVERY_PARTNER_API_BASE_URL',
        'TAZTY_DELIVERY_PARTNER_API_KEY',
        'HOME_SCREEN_RESTAURANT_CARD_STYLE',
        'APP_CLOSURE_MESSAGE'
      )
    `);
    
    console.log("✅ App settings seed rolled back");
  }
}
