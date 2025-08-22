import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterUserTable1755854911701 implements MigrationInterface {
    name = 'AlterUserTable1755854911701'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "phone_number"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "phone_number" bigint NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "phone_number"`);
        await queryRunner.query(`ALTER TABLE "user" ADD "phone_number" integer NOT NULL`);
    }

}
