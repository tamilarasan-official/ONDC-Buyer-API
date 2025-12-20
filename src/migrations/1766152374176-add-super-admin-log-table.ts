import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSuperAdminLogTable1766152374176 implements MigrationInterface {
    name = 'AddSuperAdminLogTable1766152374176'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      CREATE TABLE "admin_access_logs" (
        "id" BIGSERIAL NOT NULL,
        "role" character varying(50) NOT NULL,
        "history" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_access_logs_id" PRIMARY KEY ("id")
      )
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      DROP TABLE "admin_access_logs"
    `);
    }

}
