import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class GuestIdentityAndSessionPkUpdate1774600000000
  implements MigrationInterface
{
  name = "GuestIdentityAndSessionPkUpdate1774600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Create guest_identities only if it doesn't exist yet.
    const hasIdentityTable = await queryRunner.hasTable("guest_identities");
    if (!hasIdentityTable) {
      await queryRunner.createTable(
        new Table({
          name: "guest_identities",
          columns: [
            {
              name: "identity_id",
              type: "uuid",
              isPrimary: true,
            },
            {
              name: "identity_token_hash",
              type: "varchar",
              length: "64",
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
    }

    // 2) Ensure guest_sessions allows multiple sessions per identity.
    //    We switch the primary key from `id` to `session_token_id` (jti).
    const guestSessionsTable = await queryRunner.getTable("guest_sessions");
    const pkColumnNames = (guestSessionsTable?.primaryColumns ?? []).map(
      (c) => c.name,
    );

    const hasSessionTokenAsPk =
      pkColumnNames.length === 1 && pkColumnNames[0] === "session_token_id";

    if (!hasSessionTokenAsPk) {
      const pk = await queryRunner.query(
        `SELECT tc.constraint_name
         FROM information_schema.table_constraints tc
         WHERE tc.table_name = 'guest_sessions'
           AND tc.constraint_type = 'PRIMARY KEY';`,
      );

      const constraintName = pk?.[0]?.constraint_name;
      if (constraintName) {
        await queryRunner.query(
          `ALTER TABLE guest_sessions DROP CONSTRAINT "${constraintName}";`,
        );
      }

      await queryRunner.query(
        `ALTER TABLE guest_sessions ADD CONSTRAINT guest_sessions_pkey PRIMARY KEY (session_token_id);`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // NOTE: We do not revert guest_sessions primary key because it may fail
    // once multiple sessions exist per identity.
    await queryRunner.dropTable("guest_identities", true);
  }
}

