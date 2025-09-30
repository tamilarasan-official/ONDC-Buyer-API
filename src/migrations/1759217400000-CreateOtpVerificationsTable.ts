import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOtpVerificationsTable1759217400000 implements MigrationInterface {
    name = 'CreateOtpVerificationsTable1759217400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "otp_verifications" (
                "id" SERIAL NOT NULL,
                "phone_number" character varying(15),
                "otp" character varying(4) NOT NULL,
                "purpose" character varying NOT NULL DEFAULT 'registration',
                "is_verified" boolean NOT NULL DEFAULT false,
                "attempts" integer NOT NULL DEFAULT '0',
                "max_attempts" integer NOT NULL DEFAULT '3',
                "expires_at" TIMESTAMP NOT NULL,
                "verified_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_otp_verifications" PRIMARY KEY ("id")
            )
        `);
        
        await queryRunner.query(`
            CREATE INDEX "IDX_otp_verifications_purpose" ON "otp_verifications" ("purpose")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_otp_verifications_purpose"`);
        await queryRunner.query(`DROP TABLE "otp_verifications"`);
    }
}
