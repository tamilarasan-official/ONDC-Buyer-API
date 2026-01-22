import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterCartOrderTable1767957650107 implements MigrationInterface {
    name = 'AlterCartOrderTable1767957650107'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order" ADD "delivery_percent" numeric(5,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "order" ADD "platform_percent" numeric(5,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "cart" ADD "delivery_percent" numeric(5,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "cart" ADD "platform_percent" numeric(5,2) NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cart" DROP COLUMN "platform_percent"`);
        await queryRunner.query(`ALTER TABLE "cart" DROP COLUMN "delivery_percent"`);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "platform_percent"`);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "delivery_percent"`);
    }

}
