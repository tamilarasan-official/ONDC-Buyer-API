import { MigrationInterface, QueryRunner } from "typeorm";

export class RevampCollectionsToCuratedEntries1777200000000
  implements MigrationInterface
{
  name = "RevampCollectionsToCuratedEntries1777200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'collections_type_enum') THEN
          CREATE TYPE "collections_type_enum" AS ENUM ('store', 'item');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'collections_page_enum') THEN
          CREATE TYPE "collections_page_enum" AS ENUM ('home', 'banner');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE "collections"
      ADD COLUMN IF NOT EXISTS "description" text,
      ADD COLUMN IF NOT EXISTS "image_url" text,
      ADD COLUMN IF NOT EXISTS "type" "collections_type_enum" NOT NULL DEFAULT 'item',
      ADD COLUMN IF NOT EXISTS "page" "collections_page_enum" NOT NULL DEFAULT 'home'
    `);

    await queryRunner.query(`
      ALTER TABLE "collections"
      DROP COLUMN IF EXISTS "filters"
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "collection_entries" (
        "id" SERIAL NOT NULL,
        "collection_id" integer NOT NULL,
        "entity_id" integer NOT NULL,
        "sequence" integer NOT NULL DEFAULT 1,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_collection_entries_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_collection_entries_collection_id"
          FOREIGN KEY ("collection_id")
          REFERENCES "collections"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UQ_collection_entries_collection_entity"
          UNIQUE ("collection_id", "entity_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_collection_entries_collection_id"
      ON "collection_entries" ("collection_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_collection_entries_sequence"
      ON "collection_entries" ("sequence")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_collections_page_type_status"
      ON "collections" ("page", "type", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_collections_page_type_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_collection_entries_sequence"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_collection_entries_collection_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "collection_entries"`);

    await queryRunner.query(`
      ALTER TABLE "collections"
      ADD COLUMN IF NOT EXISTS "filters" jsonb
    `);

    await queryRunner.query(`
      ALTER TABLE "collections"
      DROP COLUMN IF EXISTS "page",
      DROP COLUMN IF EXISTS "type",
      DROP COLUMN IF EXISTS "image_url",
      DROP COLUMN IF EXISTS "description"
    `);

    await queryRunner.query(`DROP TYPE IF EXISTS "collections_page_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "collections_type_enum"`);
  }
}
