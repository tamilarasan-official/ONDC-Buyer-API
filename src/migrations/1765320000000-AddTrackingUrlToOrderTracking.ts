import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddTrackingUrlToOrderTracking1765320000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if tracking_url column exists
    const table = await queryRunner.getTable("order_tracking");
    const column = table?.findColumnByName("tracking_url");

    if (!column) {
      // Add tracking_url column to order_tracking table
      await queryRunner.addColumn(
        "order_tracking",
        new TableColumn({
          name: "tracking_url",
          type: "varchar",
          length: "500",
          isNullable: true,
          comment: "Tracking URL from seller/logistics provider",
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove tracking_url column from order_tracking table
    await queryRunner.dropColumn("order_tracking", "tracking_url");
  }
}

