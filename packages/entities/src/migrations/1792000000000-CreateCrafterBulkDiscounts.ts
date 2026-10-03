import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCrafterBulkDiscounts1792000000000 implements MigrationInterface {
    name = 'CreateCrafterBulkDiscounts1792000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "crafter_bulk_discounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "threshold" integer NOT NULL, "discount_percent" numeric(5,2) NOT NULL, CONSTRAINT "PK_crafter_bulk_discounts" PRIMARY KEY ("id"))`);

        // Seed default crafter bulk bonus tiers
        await queryRunner.query(`
            INSERT INTO "crafter_bulk_discounts" ("threshold", "discount_percent")
            VALUES (5000, 5.00), (10000, 7.00), (20000, 10.00)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "crafter_bulk_discounts"`);
    }
}
