import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserAddressTable1755928769659 implements MigrationInterface {
  name = "CreateUserAddressTable1755928769659";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "FK_d864090ed6e27b03db1eee6eaff"`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_address" ("id" SERIAL NOT NULL, "address1" text NOT NULL, "address2" text, "address3" text, "city" character varying(255) NOT NULL, "state" character varying(255) NOT NULL, "pincode" integer NOT NULL, "latitude" numeric(10,7) NOT NULL, "longitude" numeric(10,7) NOT NULL, "type" character varying(255) NOT NULL, "alternate_phone_number" bigint, "is_default" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" integer, CONSTRAINT "PK_302d96673413455481d5ff4022a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`ALTER TABLE "user_otp" DROP COLUMN "createdAt"`);
    await queryRunner.query(`ALTER TABLE "user_otp" DROP COLUMN "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "createdAt"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "REL_d864090ed6e27b03db1eee6eaf"`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "user_otp_id"`);
    await queryRunner.query(
      `ALTER TABLE "user_otp" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_otp" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "user" ADD "otp_id" integer`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "UQ_494c022ed33e6ee19a2bbb11b22" UNIQUE ("otp_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_494c022ed33e6ee19a2bbb11b22" FOREIGN KEY ("otp_id") REFERENCES "user_otp"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_address" ADD CONSTRAINT "FK_29d6df815a78e4c8291d3cf5e53" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_address" DROP CONSTRAINT "FK_29d6df815a78e4c8291d3cf5e53"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "FK_494c022ed33e6ee19a2bbb11b22"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "UQ_494c022ed33e6ee19a2bbb11b22"`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "otp_id"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "updated_at"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "created_at"`);
    await queryRunner.query(`ALTER TABLE "user_otp" DROP COLUMN "updated_at"`);
    await queryRunner.query(`ALTER TABLE "user_otp" DROP COLUMN "created_at"`);
    await queryRunner.query(`ALTER TABLE "user" ADD "user_otp_id" integer`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "REL_d864090ed6e27b03db1eee6eaf" UNIQUE ("user_otp_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_otp" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_otp" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`DROP TABLE "user_address"`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_d864090ed6e27b03db1eee6eaff" FOREIGN KEY ("user_otp_id") REFERENCES "user_otp"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
