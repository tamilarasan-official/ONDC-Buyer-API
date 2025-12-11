import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCategoryAndSubcategoryTable1756373066492
  implements MigrationInterface
{
  name = "CreateCategoryAndSubcategoryTable1756373066492";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "category" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "description" text, "icon" text NOT NULL, "reference_id" integer NOT NULL, CONSTRAINT "PK_9c4e4a89e3674fc9f382d733f03" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "sub_category" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "description" text, "icon" text NOT NULL, "status" boolean NOT NULL DEFAULT true, "reference_id" integer NOT NULL, "categoryId" integer, "parentId" integer, CONSTRAINT "PK_59f4461923255f1ce7fc5e7423c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "sub_category" ADD CONSTRAINT "FK_51b8c0b349725210c4bd8b9b7a7" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sub_category" ADD CONSTRAINT "FK_74c474aef43de1e82a46a6e16a6" FOREIGN KEY ("parentId") REFERENCES "sub_category"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sub_category" DROP CONSTRAINT "FK_74c474aef43de1e82a46a6e16a6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sub_category" DROP CONSTRAINT "FK_51b8c0b349725210c4bd8b9b7a7"`,
    );
    await queryRunner.query(`DROP TABLE "sub_category"`);
    await queryRunner.query(`DROP TABLE "category"`);
  }
}
