import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePartSets1788339901618 implements MigrationInterface {
    name = 'CreatePartSets1788339901618'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "material_claims" DROP CONSTRAINT "FK_material_claims_material_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_material_claims_material_id"`);
        await queryRunner.query(`CREATE TABLE "part_set_items" ("id" SERIAL NOT NULL, "part_name" character varying NOT NULL, "quantity" integer NOT NULL, "set_id" uuid, "part_id" character varying, CONSTRAINT "PK_1e48ed28966cdd14cf0faf7cc13" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "part_sets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_085f354979a7ab32709c97d678e" UNIQUE ("name"), CONSTRAINT "PK_649014eede0efa9ccb770bed0f8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "material_claims" ADD CONSTRAINT "FK_45c970240605d5849d028e367ec" FOREIGN KEY ("material_id") REFERENCES "base_materials"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "part_set_items" ADD CONSTRAINT "FK_1ed5d0eda2897097b7ccd48606e" FOREIGN KEY ("set_id") REFERENCES "part_sets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "part_set_items" ADD CONSTRAINT "FK_9b1becb2104d650a9d2e8700c5e" FOREIGN KEY ("part_id") REFERENCES "submarine_parts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "part_set_items" DROP CONSTRAINT "FK_9b1becb2104d650a9d2e8700c5e"`);
        await queryRunner.query(`ALTER TABLE "part_set_items" DROP CONSTRAINT "FK_1ed5d0eda2897097b7ccd48606e"`);
        await queryRunner.query(`ALTER TABLE "material_claims" DROP CONSTRAINT "FK_45c970240605d5849d028e367ec"`);
        await queryRunner.query(`DROP TABLE "part_sets"`);
        await queryRunner.query(`DROP TABLE "part_set_items"`);
        await queryRunner.query(`CREATE INDEX "IDX_material_claims_material_id" ON "material_claims" ("material_id") `);
        await queryRunner.query(`ALTER TABLE "material_claims" ADD CONSTRAINT "FK_material_claims_material_id" FOREIGN KEY ("material_id") REFERENCES "base_materials"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
