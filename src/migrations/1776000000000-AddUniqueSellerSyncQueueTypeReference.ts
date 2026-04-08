import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUniqueSellerSyncQueueTypeReference1776000000000
  implements MigrationInterface
{
  name = "AddUniqueSellerSyncQueueTypeReference1776000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) If duplicates already exist, keep the latest row and delete older duplicates
    // so we can safely add a unique index.
    await queryRunner.query(`
      DELETE FROM seller_sync_queue a
      USING seller_sync_queue b
      WHERE a.type = b.type
        AND a.reference_id = b.reference_id
        AND a.id < b.id
    `);

    // 2) Enforce one row per (type, reference_id)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_seller_sync_queue_type_reference_id"
      ON seller_sync_queue ("type", "reference_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_seller_sync_queue_type_reference_id"
    `);
  }
}

