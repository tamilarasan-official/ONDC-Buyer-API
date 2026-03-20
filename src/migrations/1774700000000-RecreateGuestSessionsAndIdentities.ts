import { MigrationInterface, QueryRunner } from "typeorm";

export class RecreateGuestSessionsAndIdentities1774700000000
  implements MigrationInterface
{
  name = "RecreateGuestSessionsAndIdentities1774700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasGuestSessions = await queryRunner.hasTable("guest_sessions");
    if (!hasGuestSessions) {
      await queryRunner.query(`
        CREATE TABLE "guest_sessions" (
          "id" uuid NOT NULL,
          "session_token_id" uuid NOT NULL,
          "platform" varchar(20) NOT NULL DEFAULT 'ios',
          "device_id_hash" varchar(128),
          "app_version" varchar(32),
          "is_active" boolean NOT NULL DEFAULT true,
          "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
          "last_seen_at" TIMESTAMP WITH TIME ZONE,
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "guest_sessions_pkey" PRIMARY KEY ("session_token_id")
        );
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_guest_sessions_expires_at"
        ON "guest_sessions" ("expires_at");
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_guest_sessions_id_session_token"
        ON "guest_sessions" ("id", "session_token_id");
      `);
    }

    const hasGuestIdentities = await queryRunner.hasTable("guest_identities");
    if (!hasGuestIdentities) {
      await queryRunner.query(`
        CREATE TABLE "guest_identities" (
          "identity_id" uuid NOT NULL,
          "identity_token_hash" varchar(64) NOT NULL,
          "platform" varchar(20) NOT NULL DEFAULT 'ios',
          "device_id_hash" varchar(128),
          "app_version" varchar(32),
          "last_seen_at" TIMESTAMP WITH TIME ZONE,
          "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
          CONSTRAINT "guest_identities_pkey" PRIMARY KEY ("identity_id"),
          CONSTRAINT "UQ_guest_identities_identity_token_hash" UNIQUE ("identity_token_hash")
        );
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_guest_identities_identity_token_hash"
        ON "guest_identities" ("identity_token_hash");
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Intentionally no-op for safety.
  }
}

