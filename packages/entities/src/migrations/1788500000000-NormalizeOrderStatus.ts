import { MigrationInterface, QueryRunner } from "typeorm";

export class NormalizeOrderStatus1788500000000 implements MigrationInterface {
    name = 'NormalizeOrderStatus1788500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 'processing' was unified with 'in_progress' (the value used by the UI)
        await queryRunner.query(`UPDATE "orders" SET "status" = 'in_progress' WHERE "status" = 'processing'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No-op: 'in_progress' orders intentionally stay as-is on rollback
    }
}
