import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMaterialAnomalyIgnore1790200000000 implements MigrationInterface {
    name = 'AddMaterialAnomalyIgnore1790200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "base_materials" ADD "anomaly_ignore" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "base_materials" DROP COLUMN "anomaly_ignore"`);
    }
}
