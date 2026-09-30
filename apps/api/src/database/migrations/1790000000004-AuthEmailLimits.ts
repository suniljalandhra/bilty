import type { MigrationInterface, QueryRunner } from 'typeorm';
export class AuthEmailLimits1790000000004 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE auth_email_limits (
      key text PRIMARY KEY,
      attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 3),
      expires_at timestamptz NOT NULL
    ); CREATE INDEX auth_email_limits_expiry_idx ON auth_email_limits(expires_at)`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE auth_email_limits');
  }
}
