import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAgentDetailsToOrderTracking1757000000000 implements MigrationInterface {
    name = 'AddAgentDetailsToOrderTracking1757000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add agent details columns to order_tracking table
        await queryRunner.query(`ALTER TABLE "order_tracking" ADD "agent_name" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "order_tracking" ADD "agent_phone" character varying(20)`);
        await queryRunner.query(`ALTER TABLE "order_tracking" ADD "agent_vehicle_number" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "order_tracking" ADD "agent_eta" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "order_tracking" ADD "agent_photo_url" character varying(500)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove agent details columns from order_tracking table
        await queryRunner.query(`ALTER TABLE "order_tracking" DROP COLUMN "agent_photo_url"`);
        await queryRunner.query(`ALTER TABLE "order_tracking" DROP COLUMN "agent_eta"`);
        await queryRunner.query(`ALTER TABLE "order_tracking" DROP COLUMN "agent_vehicle_number"`);
        await queryRunner.query(`ALTER TABLE "order_tracking" DROP COLUMN "agent_phone"`);
        await queryRunner.query(`ALTER TABLE "order_tracking" DROP COLUMN "agent_name"`);
    }
}
