import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PasswordAuth1790000000003 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE users ADD COLUMN password_hash text;
      ALTER TABLE users ADD COLUMN email_verified_at timestamptz;

      CREATE TABLE email_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        token_hash text NOT NULL UNIQUE,
        type text NOT NULL CHECK(type IN ('verification', 'reset')),
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX email_tokens_user_idx ON email_tokens(user_id);
      CREATE INDEX email_tokens_type_idx ON email_tokens(user_id, type) WHERE used_at IS NULL;
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP TABLE email_tokens;
      ALTER TABLE users DROP COLUMN email_verified_at;
      ALTER TABLE users DROP COLUMN password_hash;
    `);
  }
}
