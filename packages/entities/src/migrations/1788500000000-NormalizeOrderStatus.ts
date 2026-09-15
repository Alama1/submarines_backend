import { MigrationInterface, QueryRunner } from "typeorm";

export class NormalizeOrderStatus1788500000000 implements MigrationInterface {
    name = 'NormalizeOrderStatus1788500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "orders" SET "status" = 'in_progress' WHERE "status" = 'processing'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }
}
