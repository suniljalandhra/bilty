import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { z } from 'zod';
import { membershipWork, type Principal } from '../auth/access';
const text = z.string().trim().max(2000);
const fields = z.strictObject({
  name: text.min(1),
  address: text.default(''),
  gstin: text.default(''),
  phone: text.default(''),
});
const create = fields.extend({ kind: z.enum(['consignor', 'consignee']) });
const patch = z
  .strictObject({
    name: text.min(1).optional(),
    address: text.optional(),
    gstin: text.optional(),
    phone: text.optional(),
  })
  .refine((v) => Object.keys(v).length > 0);
export const pageSchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
});
export class PartyService {
  constructor(private readonly db: DataSource) {}
  create(p: Principal, raw: unknown) {
    const { kind, ...snapshot } = create.parse(raw);
    return membershipWork(this.db, p, false, async (tx, a) => {
      const id = randomUUID();
      await tx.query('INSERT INTO parties(id,company_id,kind,snapshot) VALUES($1,$2,$3,$4)', [
        id,
        a.companyId,
        kind,
        snapshot,
      ]);
      return { id, kind, ...snapshot, archivedAt: null };
    });
  }
  list(p: Principal, query: unknown) {
    const page = pageSchema.parse(query);
    return membershipWork(this.db, p, false, async (tx, a) => {
      const rows = await tx.query(
        'SELECT id,kind,snapshot FROM parties WHERE company_id=$1 AND archived_at IS NULL ORDER BY id LIMIT $2 OFFSET $3',
        [a.companyId, page.limit, page.offset],
      );
      return rows.map((r: any) => ({ id: r.id, kind: r.kind, ...r.snapshot, archivedAt: null }));
    });
  }
  get(p: Principal, id: string) {
    z.uuid().parse(id);
    return membershipWork(this.db, p, false, async (tx, a) => {
      const [r] = await tx.query(
        'SELECT id,kind,snapshot,archived_at FROM parties WHERE id=$1 AND company_id=$2',
        [id, a.companyId],
      );
      if (!r) throw new NotFoundException('Party not found');
      return { id: r.id, kind: r.kind, ...r.snapshot, archivedAt: r.archived_at };
    });
  }
  update(p: Principal, id: string, raw: unknown) {
    z.uuid().parse(id);
    const input = patch.parse(raw);
    return membershipWork(this.db, p, false, async (tx, a) => {
      const [r] = await tx.query(
        'SELECT kind,snapshot FROM parties WHERE id=$1 AND company_id=$2 AND archived_at IS NULL FOR UPDATE',
        [id, a.companyId],
      );
      if (!r) throw new NotFoundException('Active party not found');
      const snapshot = fields.parse({ ...r.snapshot, ...input });
      await tx.query('UPDATE parties SET snapshot=$3 WHERE id=$1 AND company_id=$2', [
        id,
        a.companyId,
        snapshot,
      ]);
      return { id, kind: r.kind, ...snapshot, archivedAt: null };
    });
  }
  archive(p: Principal, id: string) {
    z.uuid().parse(id);
    return membershipWork(this.db, p, false, async (tx, a) => {
      const [rows] = await tx.query(
        'UPDATE parties SET archived_at=COALESCE(archived_at,now()) WHERE id=$1 AND company_id=$2 RETURNING id',
        [id, a.companyId],
      );
      if (!rows.length) throw new NotFoundException('Party not found');
      return { archived: true };
    });
  }
}
