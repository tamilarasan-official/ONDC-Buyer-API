import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterSuperAdminTable1766151478504 implements MigrationInterface {
    name = 'AlterSuperAdminTable1766151478504'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "super_admin_access" ("id" BIGSERIAL NOT NULL, "name" character varying(255) NOT NULL, "slug" character varying(255) NOT NULL, "api_key" character varying(255) NOT NULL, "active" boolean NOT NULL DEFAULT true, "metadata" jsonb, "last_push_at" TIMESTAMP, "push_count" bigint NOT NULL DEFAULT '0', "created_at" TIMESTAMP DEFAULT now(), "updated_at" TIMESTAMP DEFAULT now(), CONSTRAINT "UQ_09eb67d482caf9f07b0bc447bbc" UNIQUE ("slug"), CONSTRAINT "UQ_2816613487674605e9b5afa4722" UNIQUE ("api_key"), CONSTRAINT "PK_2c8a12ded189e9369a67ad53191" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "super_admin_access"`);
    }

}
