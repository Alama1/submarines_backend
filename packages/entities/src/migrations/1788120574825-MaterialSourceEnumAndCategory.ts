import { MigrationInterface, QueryRunner } from 'typeorm';

export class MaterialSourceEnumAndCategory1788120574825 implements MigrationInterface {
  name = 'MaterialSourceEnumAndCategory1788120574825'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "material_source" AS ENUM('Market', 'Craft', 'NPC')`);

    await queryRunner.query(`
      UPDATE "base_materials"
      SET "where_to_buy" = CASE
        WHEN lower("where_to_buy") IN ('npc', 'vendor') THEN 'NPC'
        WHEN lower("where_to_buy") IN ('craft', 'crafted', 'workshop') THEN 'Craft'
        ELSE 'Market'
      END
    `);

    await queryRunner.query(`ALTER TABLE "base_materials" ALTER COLUMN "where_to_buy" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "base_materials" ALTER COLUMN "where_to_buy" TYPE "material_source" USING "where_to_buy"::"material_source"`);
    await queryRunner.query(`ALTER TABLE "base_materials" ALTER COLUMN "where_to_buy" SET DEFAULT 'Market'`);

    await queryRunner.query(`CREATE TYPE "material_category" AS ENUM('crafting', 'repair')`);
    await queryRunner.query(`ALTER TABLE "base_materials" ADD "category" "material_category" NOT NULL DEFAULT 'crafting'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "base_materials" DROP COLUMN "category"`);
    await queryRunner.query(`DROP TYPE "material_category"`);

    await queryRunner.query(`ALTER TABLE "base_materials" ALTER COLUMN "where_to_buy" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "base_materials" ALTER COLUMN "where_to_buy" TYPE character varying USING "where_to_buy"::text`);
    await queryRunner.query(`ALTER TABLE "base_materials" ALTER COLUMN "where_to_buy" SET DEFAULT 'Market'`);
    await queryRunner.query(`DROP TYPE "material_source"`);
  }
}
