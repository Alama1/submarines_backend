import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAllowedEmails1788900000000 implements MigrationInterface {
    name = 'CreateAllowedEmails1788900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "allowed_emails" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "label" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_7a8b9c0d1e2f3a4b5c6d7e8f9a0" UNIQUE ("email"), CONSTRAINT "PK_8b9c0d1e2f3a4b5c6d7e8f9a0b1" PRIMARY KEY ("id"))`);

        // Seed entries from the ALLOWED_EMAILS env var so existing logins keep working
        const raw = process.env.ALLOWED_EMAILS ?? '';
        const emails = raw
            .split(',')
            .map((e) => e.trim().toLowerCase())
            .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
        if (emails.length) {
            const values = emails
                .map((e) => `('${e.replace(/'/g, "''")}', 'imported from ALLOWED_EMAILS')`)
                .join(', ');
            await queryRunner.query(`
                INSERT INTO "allowed_emails" ("email", "label")
                VALUES ${values}
                ON CONFLICT ("email") DO NOTHING
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "allowed_emails"`);
    }
}
