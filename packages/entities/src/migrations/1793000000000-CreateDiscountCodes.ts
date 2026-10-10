import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDiscountCodes1793000000000 implements MigrationInterface {
    name = 'CreateDiscountCodes1793000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "discount_codes" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "code" character varying(40) NOT NULL,
                "discount_type" character varying(10) NOT NULL,
                "discount_value" numeric(12,2) NOT NULL,
                "max_uses" integer NOT NULL,
                "used_count" integer NOT NULL DEFAULT 0,
                "active_from" timestamptz,
                "active_until" timestamptz,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "PK_discount_codes" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_discount_codes_code" ON "discount_codes" ("code")`);

        await queryRunner.query(`ALTER TABLE "orders" ADD "discount_source" character varying(10) NOT NULL DEFAULT 'bulk'`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "promo_code_id" uuid`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "promo_code" character varying(40)`);
        await queryRunner.query(`
            ALTER TABLE "orders"
            ADD CONSTRAINT "FK_orders_promo_code"
            FOREIGN KEY ("promo_code_id") REFERENCES "discount_codes"("id")
            ON DELETE SET NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_promo_code"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "promo_code"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "promo_code_id"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "discount_source"`);
        await queryRunner.query(`DROP INDEX "UQ_discount_codes_code"`);
        await queryRunner.query(`DROP TABLE "discount_codes"`);
    }
}
