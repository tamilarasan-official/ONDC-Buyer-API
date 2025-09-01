import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTaxFieldsToStoreAndItem1756718914550 implements MigrationInterface {
    name = 'AddTaxFieldsToStoreAndItem1756718914550'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "item" ADD "tax_rate" numeric(5,2)`);
        await queryRunner.query(`ALTER TABLE "item" ADD "tax_type" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "item" ADD "hsn_code" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "store" ADD "gst_number" character varying(15)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "store" DROP COLUMN "gst_number"`);
        await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "hsn_code"`);
        await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "tax_type"`);
        await queryRunner.query(`ALTER TABLE "item" DROP COLUMN "tax_rate"`);
    }

}
