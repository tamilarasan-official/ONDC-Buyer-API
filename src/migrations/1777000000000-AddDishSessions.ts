import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDishSessions1777000000000 implements MigrationInterface {
  name = "AddDishSessions1777000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "dish" ADD COLUMN IF NOT EXISTS "schedule_enabled" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dish_session" (
        "id" SERIAL NOT NULL,
        "day_from" smallint NOT NULL DEFAULT 1,
        "day_to" smallint NOT NULL DEFAULT 7,
        "start_hhmm" smallint NOT NULL,
        "end_hhmm" smallint NOT NULL,
        "label" character varying(100),
        "status" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "dishId" integer,
        CONSTRAINT "PK_dish_session_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_dish_session_dish" FOREIGN KEY ("dishId") REFERENCES "dish"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dish_session_dish_status" ON "dish_session" ("dishId", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_dish_session_day_status" ON "dish_session" ("day_from", "day_to", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_dish_session_day_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_dish_session_dish_status"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "dish_session"`);
    await queryRunner.query(
      `ALTER TABLE "dish" DROP COLUMN IF EXISTS "schedule_enabled"`,
    );
  }
}
