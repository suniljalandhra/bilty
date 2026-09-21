import type { MigrationInterface, QueryRunner } from 'typeorm';

export class BiltyFoundation1790000000000 implements MigrationInterface {
  name = 'BiltyFoundation1790000000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE companies (
        id uuid PRIMARY KEY,
        profile jsonb NOT NULL CHECK (jsonb_typeof(profile) = 'object'),
        number_prefix varchar(40) NOT NULL CHECK (length(trim(number_prefix)) > 0),
        next_number bigint NOT NULL DEFAULT 1 CHECK (next_number BETWEEN 1 AND 999999999999)
      );
      CREATE TABLE memberships (
        user_id uuid PRIMARY KEY,
        company_id uuid NOT NULL REFERENCES companies(id),
        role text NOT NULL CHECK (role IN ('admin','employee')),
        active boolean NOT NULL DEFAULT true
      );
      CREATE INDEX memberships_company_idx ON memberships(company_id);
      CREATE TABLE parties (
        id uuid PRIMARY KEY,
        company_id uuid NOT NULL REFERENCES companies(id),
        kind text NOT NULL CHECK (kind IN ('consignor','consignee')),
        snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object')
      );
      CREATE INDEX parties_company_idx ON parties(company_id,kind);
      CREATE TABLE biltys (
        id uuid PRIMARY KEY,
        company_id uuid NOT NULL REFERENCES companies(id),
        number varchar(100),
        status text NOT NULL CHECK (status IN ('draft','issued','cancelled')),
        version integer NOT NULL CHECK (version > 0),
        data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
        company_snapshot jsonb,
        is_edited boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        issued_at timestamptz,
        edited_at timestamptz,
        cancelled_at timestamptz,
        UNIQUE (company_id,id),
        UNIQUE (company_id,number),
        CHECK (status <> 'draft' OR (number IS NULL AND issued_at IS NULL)),
        CHECK (status <> 'issued' OR (number IS NOT NULL AND issued_at IS NOT NULL AND company_snapshot IS NOT NULL)),
        CHECK ((number IS NULL) = (issued_at IS NULL)),
        CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),
        CHECK (NOT is_edited OR (edited_at IS NOT NULL AND issued_at IS NOT NULL))
      );
      CREATE INDEX biltys_company_created_idx ON biltys(company_id,created_at DESC,id);
      CREATE TABLE bilty_audit (
        id uuid PRIMARY KEY,
        company_id uuid NOT NULL,
        bilty_id uuid NOT NULL,
        actor_id uuid NOT NULL,
        version integer NOT NULL CHECK (version > 0),
        action text NOT NULL CHECK (action IN ('created','edited','issued','cancelled')),
        at timestamptz NOT NULL,
        reason text,
        before_data jsonb,
        after_data jsonb NOT NULL,
        FOREIGN KEY (company_id,bilty_id) REFERENCES biltys(company_id,id),
        UNIQUE (bilty_id,version)
      );
      CREATE INDEX bilty_audit_company_idx ON bilty_audit(company_id,bilty_id,version);
    `);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      'DROP TABLE bilty_audit; DROP TABLE biltys; DROP TABLE parties; DROP TABLE memberships; DROP TABLE companies;',
    );
  }
}
