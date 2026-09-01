import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderIsAnonymous1788700000000 implements MigrationInterface {
    name = 'AddOrderIsAnonymous1788700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" ADD "is_anonymous" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "is_anonymous"`);
    }
}
