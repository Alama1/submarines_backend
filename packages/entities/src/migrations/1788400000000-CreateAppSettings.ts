import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAppSettings1788400000000 implements MigrationInterface {
    name = 'CreateAppSettings1788400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "app_settings" ("key" character varying NOT NULL, "value" text, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_app_settings_key" PRIMARY KEY ("key"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "app_settings"`);
    }
}
