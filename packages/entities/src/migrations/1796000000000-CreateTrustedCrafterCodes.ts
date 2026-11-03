import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTrustedCrafterCodes1796000000000 implements MigrationInterface {
    name = 'CreateTrustedCrafterCodes1796000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "trusted_crafter_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(24) NOT NULL, "name" character varying(60) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_trusted_crafter_codes_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_trusted_crafter_codes_code" ON "trusted_crafter_codes" ("code")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_trusted_crafter_codes_code"`);
        await queryRunner.query(`DROP TABLE "trusted_crafter_codes"`);
    }
}
