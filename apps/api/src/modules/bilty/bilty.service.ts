import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import { z } from 'zod';
import type { Actor, AuditEvent, BiltyData, BiltyRecord, Transition } from '@bilty/shared-types';
import { createDraft, editBilty, issueBilty, cancelBilty } from './domain';
import { BiltyError } from './errors';
import { parseCompany } from './validation';

const selectRecord = `SELECT id,company_id AS "companyId",number,status,version,data,
 company_snapshot AS "companySnapshot",is_edited AS "isEdited",created_at AS "createdAt",
 updated_at AS "updatedAt",issued_at AS "issuedAt",edited_at AS "editedAt",cancelled_at AS "cancelledAt" FROM biltys`;
const timestampKeys = ['createdAt', 'updatedAt', 'issuedAt', 'editedAt', 'cancelledAt'] as const;
type DbRecord = Omit<BiltyRecord, (typeof timestampKeys)[number]> &
  Record<(typeof timestampKeys)[number], Date | null>;
function hydrate(row: DbRecord): BiltyRecord {
  return {
    ...row,
    createdAt: row.createdAt!.toISOString(),
    updatedAt: row.updatedAt!.toISOString(),
    issuedAt: row.issuedAt?.toISOString() ?? null,
    editedAt: row.editedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
  };
}
const actorSchema = z.strictObject({ userId: z.uuid(), companyId: z.uuid() });

/** Trusted application boundary. The caller must authenticate identity before calling. */
export class BiltyService {
  constructor(private readonly db: DataSource) {}

  private async authorized<T>(actor: Actor, work: (tx: EntityManager) => Promise<T>): Promise<T> {
    if (!actorSchema.safeParse(actor).success)
      throw new BiltyError('FORBIDDEN', 'Invalid membership context');
    return this.db.transaction(async (tx) => {
      const members: unknown[] = await tx.query(
        'SELECT user_id FROM memberships WHERE user_id=$1 AND company_id=$2 AND active=true FOR SHARE',
        [actor.userId, actor.companyId],
      );
      if (!members.length) throw new BiltyError('FORBIDDEN', 'Active company membership required');
      return work(tx);
    });
  }
  private async load(
    tx: EntityManager,
    actor: Actor,
    id: string,
    lock = false,
  ): Promise<BiltyRecord> {
    if (!z.uuid().safeParse(id).success) throw new BiltyError('NOT_FOUND', 'Bilty not found');
    const rows: DbRecord[] = await tx.query(
      `${selectRecord} WHERE company_id=$1 AND id=$2${lock ? ' FOR UPDATE' : ''}`,
      [actor.companyId, id],
    );
    if (!rows[0]) throw new BiltyError('NOT_FOUND', 'Bilty not found');
    return hydrate(rows[0]);
  }
  private async checkParties(tx: EntityManager, actor: Actor, data: BiltyData): Promise<void> {
    for (const kind of ['consignor', 'consignee'] as const) {
      const id = data[kind].partyId;
      if (!id) continue;
      const rows: unknown[] = await tx.query(
        'SELECT id FROM parties WHERE id=$1 AND company_id=$2 AND kind=$3 FOR SHARE',
        [id, actor.companyId, kind],
      );
      if (!rows.length)
        throw new BiltyError('VALIDATION', `Invalid ${kind} party reference for company`);
    }
  }
  private async store(tx: EntityManager, t: Transition): Promise<BiltyRecord> {
    if (!t.event) return t.bilty;
    const b = t.bilty;
    const args = [
      b.id,
      b.companyId,
      b.number,
      b.status,
      b.version,
      b.data,
      b.companySnapshot,
      b.isEdited,
      b.createdAt,
      b.updatedAt,
      b.issuedAt,
      b.editedAt,
      b.cancelledAt,
    ];
    if (t.event.before === null) {
      await tx.query(
        `INSERT INTO biltys(id,company_id,number,status,version,data,company_snapshot,is_edited,created_at,updated_at,issued_at,edited_at,cancelled_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        args,
      );
    } else {
      const [, affected]: [Array<{ id: string }>, number] = await tx.query(
        `UPDATE biltys SET number=$3,status=$4,version=$5,data=$6,company_snapshot=$7,is_edited=$8,
        created_at=$9,updated_at=$10,issued_at=$11,edited_at=$12,cancelled_at=$13
        WHERE id=$1 AND company_id=$2 AND version=$14 RETURNING id`,
        [...args, t.event.before.version],
      );
      if (affected !== 1) throw new BiltyError('CONFLICT', 'Stale version; reload the bilty');
    }
    const e = t.event;
    await tx.query(
      `INSERT INTO bilty_audit(id,company_id,bilty_id,actor_id,version,action,at,reason,before_data,after_data)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        randomUUID(),
        e.companyId,
        e.biltyId,
        e.actorId,
        b.version,
        e.action,
        e.at,
        e.reason,
        e.before,
        e.after,
      ],
    );
    return b;
  }
  async createDraft(actor: Actor, raw: unknown): Promise<BiltyRecord> {
    return this.authorized(actor, async (tx) => {
      const t = createDraft(randomUUID(), actor, raw, new Date().toISOString());
      await this.checkParties(tx, actor, t.bilty.data);
      return this.store(tx, t);
    });
  }
  async get(actor: Actor, id: string): Promise<BiltyRecord> {
    return this.authorized(actor, (tx) => this.load(tx, actor, id));
  }
  /** Initial bounded list. Cursor pagination will be added with the HTTP slice. */
  async list(actor: Actor): Promise<BiltyRecord[]> {
    return this.authorized(actor, async (tx) => {
      const rows: DbRecord[] = await tx.query(
        `${selectRecord} WHERE company_id=$1 ORDER BY created_at DESC,id LIMIT 100`,
        [actor.companyId],
      );
      return rows.map(hydrate);
    });
  }
  async issue(actor: Actor, id: string, expectedVersion: number): Promise<BiltyRecord> {
    return this.authorized(actor, async (tx) => {
      const before = await this.load(tx, actor, id, true);
      if (before.status === 'issued') return before;
      if (before.status === 'cancelled')
        throw new BiltyError('CONFLICT', 'Cancelled bilty is immutable');
      await this.checkParties(tx, actor, before.data);
      const [companies]: [
        Array<{ number_prefix: string; allocated: string; profile: unknown }>,
        number,
      ] = await tx.query(
        `UPDATE companies SET next_number=next_number+1 WHERE id=$1 RETURNING number_prefix,next_number-1 AS allocated,profile`,
        [actor.companyId],
      );
      const company = companies[0];
      if (!company) throw new BiltyError('NOT_FOUND', 'Company not found');
      const number = company.number_prefix + company.allocated.padStart(4, '0');
      // Any validation or store failure rolls the counter update back with the transaction.
      const t = issueBilty(
        before,
        expectedVersion,
        parseCompany(company.profile),
        number,
        actor,
        new Date().toISOString(),
      );
      return this.store(tx, t);
    });
  }
  async edit(
    actor: Actor,
    id: string,
    expectedVersion: number,
    raw: unknown,
    reason: string,
  ): Promise<BiltyRecord> {
    return this.authorized(actor, async (tx) => {
      const before = await this.load(tx, actor, id, true);
      const t = editBilty(before, expectedVersion, raw, reason, actor, new Date().toISOString());
      await this.checkParties(tx, actor, t.bilty.data);
      return this.store(tx, t);
    });
  }
  async cancel(
    actor: Actor,
    id: string,
    expectedVersion: number,
    reason: string,
  ): Promise<BiltyRecord> {
    return this.authorized(actor, async (tx) => {
      const before = await this.load(tx, actor, id, true);
      return this.store(
        tx,
        cancelBilty(before, expectedVersion, reason, actor, new Date().toISOString()),
      );
    });
  }
  async history(actor: Actor, id: string): Promise<AuditEvent[]> {
    return this.authorized(actor, async (tx) => {
      await this.load(tx, actor, id);
      const rows: Array<Omit<AuditEvent, 'at'> & { at: Date }> = await tx.query(
        `SELECT company_id AS "companyId",bilty_id AS "biltyId",actor_id AS "actorId",action,at,reason,before_data AS before,after_data AS after
         FROM bilty_audit WHERE company_id=$1 AND bilty_id=$2 ORDER BY version`,
        [actor.companyId, id],
      );
      return rows.map((e) => ({ ...e, at: e.at.toISOString() }));
    });
  }
}
