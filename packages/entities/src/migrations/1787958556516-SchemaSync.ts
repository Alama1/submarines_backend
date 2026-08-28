import { MigrationInterface, QueryRunner } from "typeorm";

export class SchemaSync1787958556516 implements MigrationInterface {
    name = 'SchemaSync1787958556516'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "submarine_parts" ADD "desired_stock" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "submarine_parts" DROP COLUMN "desired_stock"`);
    }

}
