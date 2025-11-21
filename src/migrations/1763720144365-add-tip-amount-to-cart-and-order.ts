import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddTipAmountToCartAndOrder1763720144365
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add tip_amount to cart table
    await queryRunner.addColumn(
      "cart",
      new TableColumn({
        name: "tip_amount",
        type: "decimal",
        precision: 10,
        scale: 2,
        default: 0,
      }),
    );

    // Add tip_amount to order table
    await queryRunner.addColumn(
      "order",
      new TableColumn({
        name: "tip_amount",
        type: "decimal",
        precision: 10,
        scale: 2,
        default: 0,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove tip_amount from order table
    await queryRunner.dropColumn("order", "tip_amount");

    // Remove tip_amount from cart table
    await queryRunner.dropColumn("cart", "tip_amount");
  }
}

