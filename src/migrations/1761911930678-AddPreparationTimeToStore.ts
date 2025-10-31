import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPreparationTimeToStore1761911930678 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "store" ADD "preparation_time" character varying(20)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "store" DROP COLUMN "preparation_time"`);
    }

}
