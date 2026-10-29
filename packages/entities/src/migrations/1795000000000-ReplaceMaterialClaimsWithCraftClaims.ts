import { MigrationInterface, QueryRunner } from "typeorm";

export class ReplaceMaterialClaimsWithCraftClaims1795000000000 implements MigrationInterface {
    name = 'ReplaceMaterialClaimsWithCraftClaims1795000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "craft_claims" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "claim_code" character varying(24) NOT NULL, "nickname" character varying(60) NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "subtotal" integer NOT NULL, "bonus_pct" numeric(5,2) NOT NULL DEFAULT 0, "bonus_amount" integer NOT NULL DEFAULT 0, "total" integer NOT NULL, "confirmed_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_craft_claims_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_craft_claims_claim_code" ON "craft_claims" ("claim_code")`);
        await queryRunner.query(`CREATE INDEX "IDX_craft_claims_status" ON "craft_claims" ("status")`);
        await queryRunner.query(`CREATE TABLE "craft_claim_items" ("id" SERIAL NOT NULL, "material_id" uuid, "material_name" character varying NOT NULL, "quantity" integer NOT NULL, "unit_price" integer NOT NULL, "line_total" integer NOT NULL, "claim_id" uuid, CONSTRAINT "PK_craft_claim_items_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_craft_claim_items_material_id" ON "craft_claim_items" ("material_id")`);
        await queryRunner.query(`ALTER TABLE "craft_claim_items" ADD CONSTRAINT "FK_craft_claim_items_claim_id" FOREIGN KEY ("claim_id") REFERENCES "craft_claims"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "craft_claim_items" ADD CONSTRAINT "FK_craft_claim_items_material_id" FOREIGN KEY ("material_id") REFERENCES "base_materials"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "craft_claim_items" DROP CONSTRAINT "FK_craft_claim_items_material_id"`);
        await queryRunner.query(`ALTER TABLE "craft_claim_items" DROP CONSTRAINT "FK_craft_claim_items_claim_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_craft_claim_items_material_id"`);
        await queryRunner.query(`DROP TABLE "craft_claim_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_craft_claims_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_craft_claims_claim_code"`);
        await queryRunner.query(`DROP TABLE "craft_claims"`);
    }
}
