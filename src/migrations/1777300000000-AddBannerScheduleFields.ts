import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBannerScheduleFields1777300000000
  implements MigrationInterface
{
  name = "AddBannerScheduleFields1777300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "banner"
      ADD COLUMN IF NOT EXISTS "schedule_enabled" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "banner"
      ADD COLUMN IF NOT EXISTS "sessions" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "banner"
      DROP COLUMN IF EXISTS "sessions"
    `);
    await queryRunner.query(`
      ALTER TABLE "banner"
      DROP COLUMN IF EXISTS "schedule_enabled"
    `);
  }
}

