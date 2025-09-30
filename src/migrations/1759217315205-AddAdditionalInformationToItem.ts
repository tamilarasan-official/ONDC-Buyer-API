import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdditionalInformationToItem1759217315205 implements MigrationInterface {
    name = 'AddAdditionalInformationToItem1759217315205'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item" ADD "additional_information" json`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "additional_information"`);
    }
}
