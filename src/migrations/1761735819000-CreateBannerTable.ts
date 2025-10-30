import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBannerTable1761735819000 implements MigrationInterface {
  name = "CreateBannerTable1761735819000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "banner" (
                "id" SERIAL NOT NULL,
                "title" character varying(255) NOT NULL,
                "subtitle" text,
                "cta_button" character varying(100),
                "image_url" text NOT NULL,
                "background_color" character varying(20),
                "promotion_type" character varying(50),
                "promotion_link" text,
                "sequence" integer NOT NULL DEFAULT '0',
                "status" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PK_banner_id" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_banner_sequence" ON "banner" ("sequence") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_banner_status" ON "banner" ("status") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_banner_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_banner_sequence"`);
    await queryRunner.query(`DROP TABLE "banner"`);
  }
}
