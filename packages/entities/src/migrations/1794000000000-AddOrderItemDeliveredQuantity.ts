import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderItemDeliveredQuantity1794000000000 implements MigrationInterface {
    name = 'AddOrderItemDeliveredQuantity1794000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order_items" ADD "delivered_quantity" integer NOT NULL DEFAULT 0`);
        // Orders already handed over count as fully delivered.
        await queryRunner.query(`
            UPDATE "order_items" oi
            SET "delivered_quantity" = oi."quantity"
            FROM "orders" o
            WHERE oi."order_id" = o."id" AND o."status" = 'fulfilled'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "delivered_quantity"`);
    }
}
