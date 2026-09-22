import type { MigrationInterface, QueryRunner } from 'typeorm';
export class PdfShares1790000000002 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`CREATE TABLE bilty_shares (
    id uuid PRIMARY KEY, company_id uuid NOT NULL, bilty_id uuid NOT NULL,
    created_by uuid NOT NULL REFERENCES users(id), token_hash text NOT NULL UNIQUE,
    snapshot jsonb NOT NULL, version integer NOT NULL, format text NOT NULL CHECK(format IN ('a4','thermal')),
    copy text NOT NULL CHECK(copy IN ('consignor','consignee','driver','office')),
    expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY(company_id,bilty_id) REFERENCES biltys(company_id,id)
  ); CREATE INDEX bilty_shares_bilty_idx ON bilty_shares(company_id,bilty_id);`);
  }
  async down(q: QueryRunner) {
    await q.query('DROP TABLE bilty_shares');
  }
}
