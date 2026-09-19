import { MigrationInterface, QueryRunner } from "typeorm";

const CRYSTAL_SEEDS: Array<{ name: string; itemId: number }> = [
    { name: 'Fire Shard', itemId: 2 },
    { name: 'Ice Shard', itemId: 3 },
    { name: 'Wind Shard', itemId: 4 },
    { name: 'Earth Shard', itemId: 5 },
    { name: 'Lightning Shard', itemId: 6 },
    { name: 'Water Shard', itemId: 7 },
    { name: 'Fire Crystal', itemId: 8 },
    { name: 'Ice Crystal', itemId: 9 },
    { name: 'Wind Crystal', itemId: 10 },
    { name: 'Earth Crystal', itemId: 11 },
    { name: 'Lightning Crystal', itemId: 12 },
    { name: 'Water Crystal', itemId: 13 },
    { name: 'Fire Cluster', itemId: 14 },
    { name: 'Ice Cluster', itemId: 15 },
    { name: 'Wind Cluster', itemId: 16 },
    { name: 'Earth Cluster', itemId: 17 },
    { name: 'Lightning Cluster', itemId: 18 },
    { name: 'Water Cluster', itemId: 19 },
];

export class CreateMaterialIngredients1788800000000 implements MigrationInterface {
    name = 'CreateMaterialIngredients1788800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "material_ingredients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "material_id" uuid NOT NULL, "ingredient_material_id" uuid NOT NULL, "quantity" integer NOT NULL, CONSTRAINT "PK_9f8c2b1a4d3e5f6a7b8c9d0e1f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1a2b3c4d5e6f7a8b9c0d1e2f3a" ON "material_ingredients" ("material_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_2b3c4d5e6f7a8b9c0d1e2f3a4b" ON "material_ingredients" ("ingredient_material_id") `);
        await queryRunner.query(`ALTER TABLE "material_ingredients" ADD CONSTRAINT "UQ_3c4d5e6f7a8b9c0d1e2f3a4b5c" UNIQUE ("material_id", "ingredient_material_id")`);
        await queryRunner.query(`ALTER TABLE "material_ingredients" ADD CONSTRAINT "FK_4d5e6f7a8b9c0d1e2f3a4b5c6d" FOREIGN KEY ("material_id") REFERENCES "base_materials"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "material_ingredients" ADD CONSTRAINT "FK_5e6f7a8b9c0d1e2f3a4b5c6d7e" FOREIGN KEY ("ingredient_material_id") REFERENCES "base_materials"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        const values = CRYSTAL_SEEDS.map(
            (c) => `(${c.itemId}, '${c.name.replace(/'/g, "''")}')`,
        ).join(', ');
        await queryRunner.query(`
            INSERT INTO "base_materials" ("name", "item_id", "where_to_buy", "category")
            SELECT v.name, v.item_id, 'Market', 'crafting'
            FROM (VALUES ${values}) AS v(item_id, name)
            WHERE NOT EXISTS (
                SELECT 1 FROM "base_materials" b
                WHERE b.name = v.name OR b.item_id = v.item_id
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "base_materials" WHERE "item_id" IN (${CRYSTAL_SEEDS.map((c) => c.itemId).join(', ')}) AND "name" IN (${CRYSTAL_SEEDS.map((c) => `'${c.name}'`).join(', ')})`);
        await queryRunner.query(`ALTER TABLE "material_ingredients" DROP CONSTRAINT "FK_5e6f7a8b9c0d1e2f3a4b5c6d7e"`);
        await queryRunner.query(`ALTER TABLE "material_ingredients" DROP CONSTRAINT "FK_4d5e6f7a8b9c0d1e2f3a4b5c6d"`);
        await queryRunner.query(`ALTER TABLE "material_ingredients" DROP CONSTRAINT "UQ_3c4d5e6f7a8b9c0d1e2f3a4b5c"`);
        await queryRunner.query(`DROP INDEX "IDX_2b3c4d5e6f7a8b9c0d1e2f3a4b"`);
        await queryRunner.query(`DROP INDEX "IDX_1a2b3c4d5e6f7a8b9c0d1e2f3a"`);
        await queryRunner.query(`DROP TABLE "material_ingredients"`);
    }
}
