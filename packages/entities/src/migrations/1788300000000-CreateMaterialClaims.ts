import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMaterialClaims1788300000000 implements MigrationInterface {
    name = 'CreateMaterialClaims1788300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "material_claims" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "material_id" uuid NOT NULL, "claimed_for" character varying NOT NULL, "quantity" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_material_claims_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_material_claims_material_id" ON "material_claims" ("material_id")`);
        await queryRunner.query(`ALTER TABLE "material_claims" ADD CONSTRAINT "FK_material_claims_material_id" FOREIGN KEY ("material_id") REFERENCES "base_materials"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "material_claims" DROP CONSTRAINT "FK_material_claims_material_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_material_claims_material_id"`);
        await queryRunner.query(`DROP TABLE "material_claims"`);
    }
}
