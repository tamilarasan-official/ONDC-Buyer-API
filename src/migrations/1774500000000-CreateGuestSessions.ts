import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
} from "typeorm";

export class CreateGuestSessions1774500000000
  implements MigrationInterface
{
  name = "CreateGuestSessions1774500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "guest_sessions",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
          },
          {
            name: "session_token_id",
            type: "uuid",
            isNullable: false,
            isUnique: true,
          },
          {
            name: "platform",
            type: "varchar",
            length: "20",
            isNullable: false,
            default: "'ios'",
          },
          {
            name: "device_id_hash",
            type: "varchar",
            length: "128",
            isNullable: true,
          },
          {
            name: "app_version",
            type: "varchar",
            length: "32",
            isNullable: true,
          },
          {
            name: "is_active",
            type: "boolean",
            isNullable: false,
            default: "true",
          },
          {
            name: "expires_at",
            type: "timestamp with time zone",
            isNullable: false,
          },
          {
            name: "last_seen_at",
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
      "guest_sessions",
      new TableIndex({
        name: "IDX_guest_sessions_expires_at",
        columnNames: ["expires_at"],
      }),
    );
    await queryRunner.createIndex(
      "guest_sessions",
      new TableIndex({
        name: "IDX_guest_sessions_id_session_token",
        columnNames: ["id", "session_token_id"],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("guest_sessions", true);
  }
}

