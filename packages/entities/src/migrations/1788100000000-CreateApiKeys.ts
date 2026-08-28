import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateApiKeys1788100000000 implements MigrationInterface {
    name = 'CreateApiKeys1788100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "api_keys" ("key_hash" character varying NOT NULL, "label" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "last_used_at" TIMESTAMP WITH TIME ZONE, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_api_keys_key_hash" PRIMARY KEY ("key_hash"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "api_keys"`);
    }
}
