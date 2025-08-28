import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDishTable1756358773073 implements MigrationInterface {
    name = 'CreateDishTable1756358773073'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "dish" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "description" text, "icon" text NOT NULL, "status" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_59ac7b35af39b231276bfc4c00c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_07626606a3b574903a702fd6ae" ON "dish" ("name") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_07626606a3b574903a702fd6ae"`);
        await queryRunner.query(`DROP TABLE "dish"`);
    }

}
