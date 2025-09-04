import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBuyerAppEntities1756971903728 implements MigrationInterface {
    name = 'CreateBuyerAppEntities1756971903728'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "order_item" ("id" SERIAL NOT NULL, "quantity" integer NOT NULL, "unit_price" numeric(10,2) NOT NULL, "total_price" numeric(10,2) NOT NULL, "customizations" json, "variants" json, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "orderId" integer, "itemId" integer, CONSTRAINT "PK_d01158fe15b1ead5c26fd7f4e90" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "order_tracking" ("id" SERIAL NOT NULL, "status" character varying(50) NOT NULL, "message" text, "timestamp" TIMESTAMP NOT NULL DEFAULT now(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "orderId" integer, CONSTRAINT "PK_9a32ecbe7d925bd403cae3e76e6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "order" ("id" SERIAL NOT NULL, "order_number" character varying(50) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "subtotal" numeric(10,2) NOT NULL, "delivery_fee" numeric(10,2) NOT NULL, "tax_amount" numeric(10,2) NOT NULL, "discount_amount" numeric(10,2) NOT NULL, "total_amount" numeric(10,2) NOT NULL, "payment_method" character varying(20) NOT NULL DEFAULT 'cod', "payment_status" character varying(20) NOT NULL DEFAULT 'pending', "notes" text, "estimated_delivery_time" TIMESTAMP, "delivered_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, "storeId" integer, "deliveryAddressId" integer, CONSTRAINT "UQ_f9180f384353c621e8d0c414c14" UNIQUE ("order_number"), CONSTRAINT "PK_1031171c13130102495201e3e20" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "item_review" ("id" SERIAL NOT NULL, "rating" integer NOT NULL, "comment" text, "images" json, "is_verified" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, "itemId" integer, "orderId" integer, CONSTRAINT "PK_98a1fd6f7a42522280392ae51a5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "restaurant_review" ("id" SERIAL NOT NULL, "rating" integer NOT NULL, "comment" text, "images" json, "is_verified" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, "storeId" integer, "orderId" integer, CONSTRAINT "PK_5fc542333f819b0a8858b9fa928" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "payment" ("id" SERIAL NOT NULL, "payment_id" character varying(100) NOT NULL, "payment_method" character varying(20) NOT NULL, "payment_status" character varying(20) NOT NULL, "amount" numeric(10,2) NOT NULL, "gateway" character varying(50), "gateway_response" json, "paid_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "orderId" integer, "userId" integer, CONSTRAINT "UQ_9fff60ac6ac1844ea4e0cfba67a" UNIQUE ("payment_id"), CONSTRAINT "PK_fcaec7df5adf9cac408c686b2ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "notification" ("id" SERIAL NOT NULL, "title" character varying(255) NOT NULL, "message" text NOT NULL, "type" character varying(50) NOT NULL, "status" character varying(50) NOT NULL, "data" json, "is_read" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, CONSTRAINT "PK_705b6c7cdf9b2c2ff7ac7872cb7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "cart_item" ("id" SERIAL NOT NULL, "quantity" integer NOT NULL DEFAULT '1', "unit_price" numeric(10,2) NOT NULL, "total_price" numeric(10,2) NOT NULL, "customizations" json, "variants" json, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "cartId" integer, "itemId" integer, CONSTRAINT "PK_bd94725aa84f8cf37632bcde997" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "cart" ("id" SERIAL NOT NULL, "total_amount" numeric(10,2) NOT NULL DEFAULT '0', "delivery_fee" numeric(10,2) NOT NULL DEFAULT '0', "tax_amount" numeric(10,2) NOT NULL DEFAULT '0', "discount_amount" numeric(10,2) NOT NULL DEFAULT '0', "final_amount" numeric(10,2) NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, "storeId" integer, CONSTRAINT "PK_c524ec48751b9b5bcfbf6e59be7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "search_history" ("id" SERIAL NOT NULL, "search_term" character varying(255) NOT NULL, "search_type" character varying(50) NOT NULL, "result_count" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, CONSTRAINT "PK_cb93c8f85dbdca85943ca494812" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "popular_item" ("id" SERIAL NOT NULL, "view_count" integer NOT NULL DEFAULT '0', "order_count" integer NOT NULL DEFAULT '0', "rating" numeric(5,2) NOT NULL DEFAULT '0', "review_count" integer NOT NULL DEFAULT '0', "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "itemId" integer, CONSTRAINT "PK_79f0f671b043ba374d82a9f9e6b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "order_item" ADD CONSTRAINT "FK_646bf9ece6f45dbe41c203e06e0" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_item" ADD CONSTRAINT "FK_e03f3ed4dab80a3bf3eca50babc" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_tracking" ADD CONSTRAINT "FK_85acfbdf5c1c33daca863f8118b" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order" ADD CONSTRAINT "FK_caabe91507b3379c7ba73637b84" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order" ADD CONSTRAINT "FK_1a79b2f719ecd9f307d62b81093" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order" ADD CONSTRAINT "FK_08fcc4e8c5af1570909f08f5029" FOREIGN KEY ("deliveryAddressId") REFERENCES "user_address"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_review" ADD CONSTRAINT "FK_fb65a1cd33970c70cdcb7837ebf" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_review" ADD CONSTRAINT "FK_1c2243499ad6a68788b85141310" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "item_review" ADD CONSTRAINT "FK_2629331cb33ee998fbfebc9b7e7" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "restaurant_review" ADD CONSTRAINT "FK_cf014c890780c0618277d0d1cb1" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "restaurant_review" ADD CONSTRAINT "FK_94abcbc21ea1c0247676ce050fa" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "restaurant_review" ADD CONSTRAINT "FK_e796bdb426e827b426b323b51ef" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payment" ADD CONSTRAINT "FK_d09d285fe1645cd2f0db811e293" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payment" ADD CONSTRAINT "FK_b046318e0b341a7f72110b75857" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notification" ADD CONSTRAINT "FK_1ced25315eb974b73391fb1c81b" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cart_item" ADD CONSTRAINT "FK_29e590514f9941296f3a2440d39" FOREIGN KEY ("cartId") REFERENCES "cart"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cart_item" ADD CONSTRAINT "FK_0b41349481bfe9247b97b40d874" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cart" ADD CONSTRAINT "FK_756f53ab9466eb52a52619ee019" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cart" ADD CONSTRAINT "FK_20e86d185ed6b2efa0d0add08eb" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "search_history" ADD CONSTRAINT "FK_11fdc5f9da08d75bbab5296bcd5" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "popular_item" ADD CONSTRAINT "FK_5a63dd8e099199c1a9a63d3374b" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "popular_item" DROP CONSTRAINT "FK_5a63dd8e099199c1a9a63d3374b"`);
        await queryRunner.query(`ALTER TABLE "search_history" DROP CONSTRAINT "FK_11fdc5f9da08d75bbab5296bcd5"`);
        await queryRunner.query(`ALTER TABLE "cart" DROP CONSTRAINT "FK_20e86d185ed6b2efa0d0add08eb"`);
        await queryRunner.query(`ALTER TABLE "cart" DROP CONSTRAINT "FK_756f53ab9466eb52a52619ee019"`);
        await queryRunner.query(`ALTER TABLE "cart_item" DROP CONSTRAINT "FK_0b41349481bfe9247b97b40d874"`);
        await queryRunner.query(`ALTER TABLE "cart_item" DROP CONSTRAINT "FK_29e590514f9941296f3a2440d39"`);
        await queryRunner.query(`ALTER TABLE "notification" DROP CONSTRAINT "FK_1ced25315eb974b73391fb1c81b"`);
        await queryRunner.query(`ALTER TABLE "payment" DROP CONSTRAINT "FK_b046318e0b341a7f72110b75857"`);
        await queryRunner.query(`ALTER TABLE "payment" DROP CONSTRAINT "FK_d09d285fe1645cd2f0db811e293"`);
        await queryRunner.query(`ALTER TABLE "restaurant_review" DROP CONSTRAINT "FK_e796bdb426e827b426b323b51ef"`);
        await queryRunner.query(`ALTER TABLE "restaurant_review" DROP CONSTRAINT "FK_94abcbc21ea1c0247676ce050fa"`);
        await queryRunner.query(`ALTER TABLE "restaurant_review" DROP CONSTRAINT "FK_cf014c890780c0618277d0d1cb1"`);
        await queryRunner.query(`ALTER TABLE "item_review" DROP CONSTRAINT "FK_2629331cb33ee998fbfebc9b7e7"`);
        await queryRunner.query(`ALTER TABLE "item_review" DROP CONSTRAINT "FK_1c2243499ad6a68788b85141310"`);
        await queryRunner.query(`ALTER TABLE "item_review" DROP CONSTRAINT "FK_fb65a1cd33970c70cdcb7837ebf"`);
        await queryRunner.query(`ALTER TABLE "order" DROP CONSTRAINT "FK_08fcc4e8c5af1570909f08f5029"`);
        await queryRunner.query(`ALTER TABLE "order" DROP CONSTRAINT "FK_1a79b2f719ecd9f307d62b81093"`);
        await queryRunner.query(`ALTER TABLE "order" DROP CONSTRAINT "FK_caabe91507b3379c7ba73637b84"`);
        await queryRunner.query(`ALTER TABLE "order_tracking" DROP CONSTRAINT "FK_85acfbdf5c1c33daca863f8118b"`);
        await queryRunner.query(`ALTER TABLE "order_item" DROP CONSTRAINT "FK_e03f3ed4dab80a3bf3eca50babc"`);
        await queryRunner.query(`ALTER TABLE "order_item" DROP CONSTRAINT "FK_646bf9ece6f45dbe41c203e06e0"`);
        await queryRunner.query(`DROP TABLE "popular_item"`);
        await queryRunner.query(`DROP TABLE "search_history"`);
        await queryRunner.query(`DROP TABLE "cart"`);
        await queryRunner.query(`DROP TABLE "cart_item"`);
        await queryRunner.query(`DROP TABLE "notification"`);
        await queryRunner.query(`DROP TABLE "payment"`);
        await queryRunner.query(`DROP TABLE "restaurant_review"`);
        await queryRunner.query(`DROP TABLE "item_review"`);
        await queryRunner.query(`DROP TABLE "order"`);
        await queryRunner.query(`DROP TABLE "order_tracking"`);
        await queryRunner.query(`DROP TABLE "order_item"`);
    }

}
