import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1787911890467 implements MigrationInterface {
    name = 'InitialSchema1787911890467'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "submarine_parts" ("id" character varying NOT NULL, "name" character varying NOT NULL, "item_id" integer, "part_type" character varying NOT NULL, "class_name" character varying NOT NULL, "class_key" character varying NOT NULL, "is_modified" boolean NOT NULL DEFAULT false, "price" integer NOT NULL, "stock" integer NOT NULL DEFAULT '0', "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e21616204ac6a052c218b103604" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "part_materials" ("id" SERIAL NOT NULL, "quantity" integer NOT NULL, "part_id" character varying, "material_id" uuid, CONSTRAINT "PK_6e1f319ea3bd6e95da0d22cc529" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "base_materials" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "item_id" integer, "desired_quantity" integer NOT NULL DEFAULT '0', "current_stock" integer NOT NULL DEFAULT '0', "market_price" integer, "my_price" integer, "npc_price" integer, "where_to_buy" character varying NOT NULL DEFAULT 'Market', "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_19709b5f457f52c4cc600b30051" UNIQUE ("name"), CONSTRAINT "PK_16bc50a8811207e8c3c908b1582" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "order_items" ("id" SERIAL NOT NULL, "part_name" character varying NOT NULL, "part_type" text, "quantity" integer NOT NULL, "unit_price" integer NOT NULL, "line_total" integer NOT NULL, "build_name" text, "order_id" uuid, "part_id" character varying, CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_code" character varying(16) NOT NULL, "client_name" character varying NOT NULL, "contact_info" text, "raw_text" text, "subtotal" integer NOT NULL, "discount_pct" numeric(5,2) NOT NULL DEFAULT '0', "discount_amt" integer NOT NULL DEFAULT '0', "total" integer NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "notes" text, "fulfillment_dt" text, "confirmed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_e462c2f2237b3049aa6be3fce06" UNIQUE ("order_code"), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "bulk_discounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "threshold" integer NOT NULL, "discount_percent" numeric(5,2) NOT NULL, CONSTRAINT "PK_60f9eb578b01a884189c4a414fd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "part_materials" ADD CONSTRAINT "FK_41885dc394f8d97c505d27143f1" FOREIGN KEY ("part_id") REFERENCES "submarine_parts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "part_materials" ADD CONSTRAINT "FK_f4e4b84963d2bc7fc3ffd4c511e" FOREIGN KEY ("material_id") REFERENCES "base_materials"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_145532db85752b29c57d2b7b1f1" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_8a0845b87fe559cab687676eebc" FOREIGN KEY ("part_id") REFERENCES "submarine_parts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_8a0845b87fe559cab687676eebc"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_145532db85752b29c57d2b7b1f1"`);
        await queryRunner.query(`ALTER TABLE "part_materials" DROP CONSTRAINT "FK_f4e4b84963d2bc7fc3ffd4c511e"`);
        await queryRunner.query(`ALTER TABLE "part_materials" DROP CONSTRAINT "FK_41885dc394f8d97c505d27143f1"`);
        await queryRunner.query(`DROP TABLE "bulk_discounts"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TABLE "order_items"`);
        await queryRunner.query(`DROP TABLE "base_materials"`);
        await queryRunner.query(`DROP TABLE "part_materials"`);
        await queryRunner.query(`DROP TABLE "submarine_parts"`);
    }

}
