import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddPlatformFeeAndTotalTaxToOrder1768759598517 implements MigrationInterface {
  name = 'AddPlatformFeeAndTotalTaxToOrder1768759598517'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add platform_fee column to order table
    await queryRunner.addColumn(
      "order",
      new TableColumn({
        name: "platform_fee",
        type: "decimal",
        precision: 10,
        scale: 2,
        default: 0,
      }),
    );

    // Add total_tax_amount column to order table
    await queryRunner.addColumn(
      "order",
      new TableColumn({
        name: "total_tax_amount",
        type: "decimal",
        precision: 10,
        scale: 2,
        default: 0,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove total_tax_amount column from order table
    await queryRunner.dropColumn("order", "total_tax_amount");

    // Remove platform_fee column from order table
    await queryRunner.dropColumn("order", "platform_fee");
  }
}
