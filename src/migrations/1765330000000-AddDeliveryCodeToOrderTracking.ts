import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddDeliveryCodeToOrderTracking1765330000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add delivery_code column to order_tracking table
    const table = await queryRunner.getTable("order_tracking");
    const column = table?.findColumnByName("delivery_code");

    if (!column) {
      await queryRunner.addColumn(
        "order_tracking",
        new TableColumn({
          name: "delivery_code",
          type: "varchar",
          length: "20",
          isNullable: true,
          comment: "Delivery code for order verification (typically sent when status is 'picked')",
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove delivery_code column from order_tracking table
    await queryRunner.dropColumn("order_tracking", "delivery_code");
  }
}

