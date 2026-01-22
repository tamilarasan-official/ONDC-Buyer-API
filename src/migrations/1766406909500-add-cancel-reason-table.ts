import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCancelReasonTable1766406909500 implements MigrationInterface {
    name = 'AddCancelReasonTable1766406909500'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "cancel_reasons" ("id" SERIAL NOT NULL, "code" character varying(10) NOT NULL, "reason" text NOT NULL, "is_rto" boolean NOT NULL DEFAULT false, "is_part_cancel" boolean NOT NULL DEFAULT false, "cancelled_by" character varying(255), "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a5fed0302cd28b1bdd4fe3ef062" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_3d69663f9e050a4907e36ff16e" ON "cancel_reasons" ("code") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_3d69663f9e050a4907e36ff16e"`);
        await queryRunner.query(`DROP TABLE "cancel_reasons"`);
    }

}
