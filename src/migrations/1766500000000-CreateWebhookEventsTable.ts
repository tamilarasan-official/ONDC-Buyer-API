import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreateWebhookEventsTable1766500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "webhook_event",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "event_id",
            type: "varchar",
            length: "255",
          },
          {
            name: "event_type",
            type: "varchar",
            length: "100",
          },
          {
            name: "payment_id",
            type: "varchar",
            length: "100",
            isNullable: true,
          },
          {
            name: "order_id",
            type: "varchar",
            length: "100",
            isNullable: true,
          },
          {
            name: "internal_order_id",
            type: "int",
            isNullable: true,
          },
          {
            name: "processing_status",
            type: "varchar",
            length: "50",
            default: "'pending'",
          },
          {
            name: "error_message",
            type: "text",
            isNullable: true,
          },
          {
            name: "event_payload",
            type: "json",
            isNullable: true,
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

    // Create unique index on event_id and event_type to prevent duplicates
    await queryRunner.createIndex(
      "webhook_event",
      new TableIndex({
        name: "IDX_webhook_event_id_type",
        columnNames: ["event_id", "event_type"],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("webhook_event");
  }
}

