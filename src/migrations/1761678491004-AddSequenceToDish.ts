import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSequenceToDish1761678491004 implements MigrationInterface {
  name = "AddSequenceToDish1761678491004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "dish" ADD "sequence" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_65a646bd23fb4e58937c00a621" ON "dish" ("sequence") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_65a646bd23fb4e58937c00a621"`,
    );
    await queryRunner.query(`ALTER TABLE "dish" DROP COLUMN "sequence"`);
  }
}
