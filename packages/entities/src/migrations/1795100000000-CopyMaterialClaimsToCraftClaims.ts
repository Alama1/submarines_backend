import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Preserves the legacy material_claims pledges: one craft claim per person
 * (status confirmed, code CLM-L####, no bonus), items merged per material with
 * a price snapshot from the current material prices. The legacy table itself
 * is kept untouched as an archive.
 */
export class CopyMaterialClaimsToCraftClaims1795100000000 implements MigrationInterface {
    name = 'CopyMaterialClaimsToCraftClaims1795100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                -- Local DBs may have already dropped the legacy table — nothing to copy.
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'material_claims'
                ) THEN
                    RETURN;
                END IF;

                -- One craft claim per person who had pledges.
                INSERT INTO "craft_claims" ("id", "claim_code", "nickname", "status", "subtotal", "bonus_pct", "bonus_amount", "total", "confirmed_at", "created_at", "updated_at")
                SELECT gen_random_uuid(),
                       'CLM-L' || lpad((row_number() OVER (ORDER BY MIN(mc."created_at"), mc."claimed_for"))::text, 4, '0'),
                       mc."claimed_for",
                       'confirmed',
                       0, 0, 0, 0,
                       MIN(mc."created_at"),
                       MIN(mc."created_at"),
                       now()
                FROM "material_claims" mc
                GROUP BY mc."claimed_for";

                -- Items merged per (person, material) with a current price snapshot.
                INSERT INTO "craft_claim_items" ("material_id", "material_name", "quantity", "unit_price", "line_total", "claim_id")
                SELECT mc."material_id",
                       COALESCE(bm."name", 'Unknown material'),
                       SUM(mc."quantity")::int,
                       COALESCE(bm."my_price", bm."market_price", bm."npc_price", 0),
                       SUM(mc."quantity")::int * COALESCE(bm."my_price", bm."market_price", bm."npc_price", 0),
                       cc."id"
                FROM "material_claims" mc
                LEFT JOIN "base_materials" bm ON bm."id" = mc."material_id"
                JOIN "craft_claims" cc
                  ON cc."nickname" = mc."claimed_for" AND cc."claim_code" LIKE 'CLM-L%'
                GROUP BY cc."id", mc."material_id", bm."name", bm."my_price", bm."market_price", bm."npc_price";

                -- Fill in the payout totals from the migrated items.
                UPDATE "craft_claims" cc
                SET "subtotal" = s."total", "total" = s."total"
                FROM (
                    SELECT ci."claim_id", SUM(ci."line_total")::int AS "total"
                    FROM "craft_claim_items" ci
                    GROUP BY ci."claim_id"
                ) s
                WHERE s."claim_id" = cc."id" AND cc."claim_code" LIKE 'CLM-L%';
            END
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "craft_claim_items" WHERE "claim_id" IN (SELECT "id" FROM "craft_claims" WHERE "claim_code" LIKE 'CLM-L%')`);
        await queryRunner.query(`DELETE FROM "craft_claims" WHERE "claim_code" LIKE 'CLM-L%'`);
    }
}
