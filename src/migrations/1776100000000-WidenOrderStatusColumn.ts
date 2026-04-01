import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Seller webhook persists seller status strings on order.status (e.g. agent-arrived-restaurant).
 * Original schema used varchar(20), which rejects longer enum values and caused 500s on UPDATE.
 */
export class WidenOrderStatusColumn1776100000000 implements MigrationInterface {
  name = "WidenOrderStatusColumn1776100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ALTER COLUMN "status" TYPE character varying(50)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ALTER COLUMN "status" TYPE character varying(20) USING LEFT("status", 20)`,
    );
  }
}
