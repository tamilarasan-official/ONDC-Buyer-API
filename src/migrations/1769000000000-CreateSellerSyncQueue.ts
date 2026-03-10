import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreateSellerSyncQueue1769000000000 implements MigrationInterface {
  name = "CreateSellerSyncQueue1769000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "seller_sync_queue",
        columns: [
          {
            name: "id",
            type: "bigint",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "reference_id",
            type: "varchar",
            length: "255",
            isNullable: false,
          },
          {
            name: "type",
            type: "varchar",
            length: "50",
            isNullable: false,
          },
          {
            name: "payload",
            type: "jsonb",
            isNullable: false,
          },
          {
            name: "status",
            type: "varchar",
            length: "20",
            isNullable: false,
            default: "'pending'",
          },
          {
            name: "attempts",
            type: "int",
            isNullable: false,
            default: 0,
          },
          {
            name: "last_error",
            type: "text",
            isNullable: true,
          },
          {
            name: "bullmq_job_id",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "sent_at",
            type: "timestamp with time zone",
            isNullable: true,
          },
          {
            name: "created_at",
            type: "timestamp with time zone",
            default: "now()",
          },
          {
            name: "updated_at",
            type: "timestamp with time zone",
            default: "now()",
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      "seller_sync_queue",
      new TableIndex({
        name: "IDX_seller_sync_queue_status_created",
        columnNames: ["status", "created_at"],
      }),
    );
    await queryRunner.createIndex(
      "seller_sync_queue",
      new TableIndex({
        name: "IDX_seller_sync_queue_reference_id",
        columnNames: ["reference_id"],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("seller_sync_queue", true);
  }
}
