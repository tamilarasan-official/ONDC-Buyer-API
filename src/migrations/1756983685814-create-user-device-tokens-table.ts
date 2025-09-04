import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserDeviceTokensTable1756983685814 implements MigrationInterface {
    name = 'CreateUserDeviceTokensTable1756983685814'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_device_tokens" ("id" SERIAL NOT NULL, "token" character varying(500) NOT NULL, "platform" character varying(20) NOT NULL, "device_id" character varying(100), "app_version" character varying(100), "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, CONSTRAINT "PK_089ca63b045947b89c77b06a79d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "order_item" ADD "special_instructions" text`);
        await queryRunner.query(`ALTER TABLE "item_review" ADD "title" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "item_review" ADD "taste" integer`);
        await queryRunner.query(`ALTER TABLE "item_review" ADD "portion_size" integer`);
        await queryRunner.query(`ALTER TABLE "item_review" ADD "value_for_money" integer`);
        await queryRunner.query(`ALTER TABLE "restaurant_review" ADD "title" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "restaurant_review" ADD "food_quality" integer`);
        await queryRunner.query(`ALTER TABLE "restaurant_review" ADD "delivery_time" integer`);
        await queryRunner.query(`ALTER TABLE "restaurant_review" ADD "packaging" integer`);
        await queryRunner.query(`ALTER TABLE "restaurant_review" ADD "value_for_money" integer`);
        await queryRunner.query(`ALTER TABLE "cart_item" ADD "special_instructions" text`);
        await queryRunner.query(`ALTER TABLE "user_device_tokens" ADD CONSTRAINT "FK_a11372c2ee3197be5691d0d8ed0" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_device_tokens" DROP CONSTRAINT "FK_a11372c2ee3197be5691d0d8ed0"`);
        await queryRunner.query(`ALTER TABLE "cart_item" DROP COLUMN "special_instructions"`);
        await queryRunner.query(`ALTER TABLE "restaurant_review" DROP COLUMN "value_for_money"`);
        await queryRunner.query(`ALTER TABLE "restaurant_review" DROP COLUMN "packaging"`);
        await queryRunner.query(`ALTER TABLE "restaurant_review" DROP COLUMN "delivery_time"`);
        await queryRunner.query(`ALTER TABLE "restaurant_review" DROP COLUMN "food_quality"`);
        await queryRunner.query(`ALTER TABLE "restaurant_review" DROP COLUMN "title"`);
        await queryRunner.query(`ALTER TABLE "item_review" DROP COLUMN "value_for_money"`);
        await queryRunner.query(`ALTER TABLE "item_review" DROP COLUMN "portion_size"`);
        await queryRunner.query(`ALTER TABLE "item_review" DROP COLUMN "taste"`);
        await queryRunner.query(`ALTER TABLE "item_review" DROP COLUMN "title"`);
        await queryRunner.query(`ALTER TABLE "order_item" DROP COLUMN "special_instructions"`);
        await queryRunner.query(`DROP TABLE "user_device_tokens"`);
    }

}
