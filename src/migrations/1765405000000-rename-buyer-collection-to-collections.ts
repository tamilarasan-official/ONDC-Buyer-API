import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameBuyerCollectionToCollections1765405000000
  implements MigrationInterface
{
  name = "RenameBuyerCollectionToCollections1765405000000";

  private async indexExists(
    queryRunner: QueryRunner,
    indexName: string,
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = $1
      LIMIT 1
      `,
      [indexName],
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasOldTable = await queryRunner.hasTable("buyer_collection");
    const hasNewTable = await queryRunner.hasTable("collections");

    if (hasOldTable && !hasNewTable) {
      await queryRunner.query(`ALTER TABLE "buyer_collection" RENAME TO "collections"`);
    }

    const hasOldSeqIndex = await this.indexExists(
      queryRunner,
      "IDX_buyer_collection_sequence",
    );
    if (hasOldSeqIndex) {
      await queryRunner.query(
        `ALTER INDEX "IDX_buyer_collection_sequence" RENAME TO "IDX_collections_sequence"`,
      );
    }

    const hasOldStatusIndex = await this.indexExists(
      queryRunner,
      "IDX_buyer_collection_status",
    );
    if (hasOldStatusIndex) {
      await queryRunner.query(
        `ALTER INDEX "IDX_buyer_collection_status" RENAME TO "IDX_collections_status"`,
      );
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'PK_buyer_collection_id'
            AND table_name = 'collections'
        ) THEN
          ALTER TABLE "collections" RENAME CONSTRAINT "PK_buyer_collection_id" TO "PK_collections_id";
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasNewTable = await queryRunner.hasTable("collections");
    const hasOldTable = await queryRunner.hasTable("buyer_collection");

    if (hasNewTable && !hasOldTable) {
      await queryRunner.query(`ALTER TABLE "collections" RENAME TO "buyer_collection"`);
    }

    const hasNewSeqIndex = await this.indexExists(
      queryRunner,
      "IDX_collections_sequence",
    );
    if (hasNewSeqIndex) {
      await queryRunner.query(
        `ALTER INDEX "IDX_collections_sequence" RENAME TO "IDX_buyer_collection_sequence"`,
      );
    }

    const hasNewStatusIndex = await this.indexExists(
      queryRunner,
      "IDX_collections_status",
    );
    if (hasNewStatusIndex) {
      await queryRunner.query(
        `ALTER INDEX "IDX_collections_status" RENAME TO "IDX_buyer_collection_status"`,
      );
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'PK_collections_id'
            AND table_name = 'buyer_collection'
        ) THEN
          ALTER TABLE "buyer_collection" RENAME CONSTRAINT "PK_collections_id" TO "PK_buyer_collection_id";
        END IF;
      END$$;
    `);
  }
}

