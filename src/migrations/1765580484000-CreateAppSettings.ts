import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateAppSettings1765580484000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "app_settings",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "key",
            type: "varchar",
            length: "100",
            isUnique: true,
          },
          {
            name: "value",
            type: "text",
          },
          {
            name: "category",
            type: "varchar",
            length: "50",
            isNullable: true,
          },
          {
            name: "description",
            type: "text",
            isNullable: true,
          },
          {
            name: "is_active",
            type: "boolean",
            default: true,
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "now()",
          },
          {
            name: "updated_at",
            type: "timestamp",
            default: "now()",
          },
        ],
      }),
      true,
    );

    // Insert initial settings
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("app_settings");
  }
}
