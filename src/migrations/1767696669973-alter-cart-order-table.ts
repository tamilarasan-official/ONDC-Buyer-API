import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterCartOrderTable1767696669973 implements MigrationInterface {
    name = 'AlterCartOrderTable1767696669973'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order" ADD "delivery_fee_tax" numeric(10,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "order" ADD "platform_fee_tax" numeric(10,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "cart" ADD "delivery_fee_tax" numeric(10,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "cart" ADD "platform_fee_tax" numeric(10,2) NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cart" DROP COLUMN "platform_fee_tax"`);
        await queryRunner.query(`ALTER TABLE "cart" DROP COLUMN "delivery_fee_tax"`);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "platform_fee_tax"`);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "delivery_fee_tax"`);
    }

}
