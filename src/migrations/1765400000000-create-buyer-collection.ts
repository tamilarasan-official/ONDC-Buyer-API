import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBuyerCollection1765400000000 implements MigrationInterface {
  name = "CreateBuyerCollection1765400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "collections" (
        "id" SERIAL NOT NULL,
        "title" character varying(120) NOT NULL,
        "filters" jsonb,
        "status" boolean NOT NULL DEFAULT true,
        "sequence" integer NOT NULL DEFAULT 1,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_collections_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_collections_sequence" ON "collections" ("sequence")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_collections_status" ON "collections" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_collections_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_collections_sequence"`);
    await queryRunner.query(`DROP TABLE "collections"`);
  }
}

