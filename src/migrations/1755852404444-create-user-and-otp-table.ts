import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserAndOtpTable1755852404444 implements MigrationInterface {
  name = "CreateUserAndOtpTable1755852404444";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_otp" ("id" SERIAL NOT NULL, "otp" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_494c022ed33e6ee19a2bbb11b22" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("id" SERIAL NOT NULL, "name" character varying(255), "email" character varying(255), "phone_number" integer NOT NULL, "status" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "user_otp_id" integer, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "REL_d864090ed6e27b03db1eee6eaf" UNIQUE ("user_otp_id"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_d864090ed6e27b03db1eee6eaff" FOREIGN KEY ("user_otp_id") REFERENCES "user_otp"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "FK_d864090ed6e27b03db1eee6eaff"`,
    );
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TABLE "user_otp"`);
  }
}
