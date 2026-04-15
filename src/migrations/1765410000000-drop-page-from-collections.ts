import { MigrationInterface, QueryRunner } from "typeorm";

export class DropPageFromCollections1765410000000 implements MigrationInterface {
  name = "DropPageFromCollections1765410000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasCollections = await queryRunner.hasTable("collections");
    if (!hasCollections) return;

    const table = await queryRunner.getTable("collections");
    const hasPage = table?.findColumnByName("page");
    if (hasPage) {
      await queryRunner.query(`ALTER TABLE "collections" DROP COLUMN "page"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasCollections = await queryRunner.hasTable("collections");
    if (!hasCollections) return;

    const table = await queryRunner.getTable("collections");
    const hasPage = table?.findColumnByName("page");
    if (!hasPage) {
      await queryRunner.query(
        `ALTER TABLE "collections" ADD COLUMN "page" character varying(80) NOT NULL DEFAULT 'home'`,
      );
    }
  }
}

