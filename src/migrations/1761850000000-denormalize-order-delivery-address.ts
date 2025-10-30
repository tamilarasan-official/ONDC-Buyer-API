import { MigrationInterface, QueryRunner } from "typeorm";

export class DenormalizeOrderDeliveryAddress1761850000000
  implements MigrationInterface
{
  name = "DenormalizeOrderDeliveryAddress1761850000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Add new address columns to order table
    await queryRunner.query(
      `ALTER TABLE "order" ADD "delivery_address_line1" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "delivery_address_line2" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "delivery_address_line3" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "delivery_city" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "delivery_state" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "delivery_pincode" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "delivery_latitude" numeric(10,7)`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "delivery_longitude" numeric(10,7)`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "delivery_address_type" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "delivery_alternate_phone" bigint`,
    );

    // Step 2: Copy existing address data from user_address table to order table
    await queryRunner.query(`
            UPDATE "order" o
            SET
                delivery_address_line1 = ua.address1,
                delivery_address_line2 = ua.address2,
                delivery_address_line3 = ua.address3,
                delivery_city = ua.city,
                delivery_state = ua.state,
                delivery_pincode = ua.pincode,
                delivery_latitude = ua.latitude,
                delivery_longitude = ua.longitude,
                delivery_address_type = ua.type,
                delivery_alternate_phone = ua.alternate_phone_number
            FROM user_address ua
            WHERE o."deliveryAddressId" = ua.id
        `);

    // Step 3: Drop foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "order" DROP CONSTRAINT IF EXISTS "FK_order_delivery_address"`,
    );

    // Step 4: Drop the old deliveryAddressId column
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "deliveryAddressId"`,
    );

    // Step 5: Make the new columns NOT NULL (except nullable ones)
    await queryRunner.query(
      `ALTER TABLE "order" ALTER COLUMN "delivery_address_line1" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ALTER COLUMN "delivery_city" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ALTER COLUMN "delivery_state" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ALTER COLUMN "delivery_pincode" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ALTER COLUMN "delivery_latitude" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ALTER COLUMN "delivery_longitude" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ALTER COLUMN "delivery_address_type" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // This migration is not easily reversible as we lose the foreign key relationship
    // However, we'll provide a down migration for development purposes

    // Add back the deliveryAddressId column
    await queryRunner.query(
      `ALTER TABLE "order" ADD "deliveryAddressId" integer`,
    );

    // Add back the foreign key constraint
    await queryRunner.query(`
            ALTER TABLE "order"
            ADD CONSTRAINT "FK_order_delivery_address"
            FOREIGN KEY ("deliveryAddressId")
            REFERENCES "user_address"("id")
            ON DELETE CASCADE
        `);

    // Drop the denormalized columns
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "delivery_alternate_phone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "delivery_address_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "delivery_longitude"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "delivery_latitude"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "delivery_pincode"`,
    );
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "delivery_state"`);
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "delivery_city"`);
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "delivery_address_line3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "delivery_address_line2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "delivery_address_line1"`,
    );
  }
}
