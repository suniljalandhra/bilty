import type { MigrationInterface, QueryRunner } from 'typeorm';
export class AuthTables1790000000001 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY, email text UNIQUE CHECK(email=lower(trim(email))), google_sub text UNIQUE,
        name text NOT NULL DEFAULT '', avatar_url text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      INSERT INTO users(id) SELECT user_id FROM memberships;
      ALTER TABLE memberships ADD CONSTRAINT memberships_user_fk FOREIGN KEY(user_id) REFERENCES users(id);
      ALTER TABLE memberships ADD COLUMN joined_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN revoked_at timestamptz;
      ALTER TABLE parties ADD COLUMN archived_at timestamptz;
      CREATE TABLE sessions (
        id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL,
        revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX sessions_user_idx ON sessions(user_id);
      CREATE TABLE refresh_tokens (
        token_hash text PRIMARY KEY, session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX refresh_session_idx ON refresh_tokens(session_id);
      CREATE TABLE invites (
        id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), email text NOT NULL CHECK(email=lower(trim(email))),
        role text NOT NULL CHECK(role IN ('admin','employee')), token_hash text NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL, accepted_at timestamptz, revoked_at timestamptz,
        invited_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX invites_company_idx ON invites(company_id);
      CREATE TABLE oauth_states (
        state_hash text PRIMARY KEY, browser_hash text NOT NULL, nonce_hash text NOT NULL,
        code_verifier text NOT NULL, invite_hash text, expires_at timestamptz NOT NULL
      );
    `);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE oauth_states, invites, refresh_tokens, sessions;
      ALTER TABLE parties DROP COLUMN archived_at;
      ALTER TABLE memberships DROP CONSTRAINT memberships_user_fk, DROP COLUMN joined_at, DROP COLUMN revoked_at;
      DROP TABLE users;`);
  }
}
