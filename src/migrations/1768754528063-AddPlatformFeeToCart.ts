import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddPlatformFeeToCart1768754528063 implements MigrationInterface {
  name = 'AddPlatformFeeToCart1768754528063'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add platform_fee column to cart table
    await queryRunner.addColumn(
      "cart",
      new TableColumn({
        name: "platform_fee",
        type: "decimal",
        precision: 10,
        scale: 2,
        default: 0,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove platform_fee column from cart table
    await queryRunner.dropColumn("cart", "platform_fee");
  }
}
