import * as crypto from 'crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O, 1/I

function randomGroup(): string {
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

function randomOrderCode(): string {
  return `SUB-${randomGroup()}-${randomGroup()}-${randomGroup()}`;
}

export class RandomizeOrderCodes1788600000000 implements MigrationInterface {
    name = 'RandomizeOrderCodes1788600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Widen the column for the new SUB-XXXX-XXXX-XXXX format (18 chars)
        await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "order_code" TYPE varchar(24)`);

        // 2. Randomize every existing code — the old short ones were guessable
        const orders: Array<{ id: string }> = await queryRunner.query(`SELECT "id" FROM "orders"`);
        const used = new Set<string>();
        for (const { id } of orders) {
            let code: string;
            do {
                code = randomOrderCode();
            } while (used.has(code));
            used.add(code);
            await queryRunner.query(`UPDATE "orders" SET "order_code" = $1 WHERE "id" = $2`, [code, id]);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No-op: the original short codes cannot be restored (randomized on purpose)
    }
}
