import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateInventoryCaches1791000000000 implements MigrationInterface {
    name = 'CreateInventoryCaches1791000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "character_inventories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "character_key" character varying NOT NULL, "character_name" character varying NOT NULL, "home_world" character varying, "bags" jsonb NOT NULL DEFAULT '[]', "last_reported_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_character_inventories_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_character_inventories_character_key" ON "character_inventories" ("character_key")`);
        await queryRunner.query(`CREATE TABLE "retainer_inventories" ("retainer_id" bigint NOT NULL, "retainer_name" character varying NOT NULL, "owner_key" character varying, "bags" jsonb NOT NULL DEFAULT '[]', "last_reported_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_retainer_inventories_retainer_id" PRIMARY KEY ("retainer_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_retainer_inventories_owner_key" ON "retainer_inventories" ("owner_key")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_retainer_inventories_owner_key"`);
        await queryRunner.query(`DROP TABLE "retainer_inventories"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_character_inventories_character_key"`);
        await queryRunner.query(`DROP TABLE "character_inventories"`);
    }
}
