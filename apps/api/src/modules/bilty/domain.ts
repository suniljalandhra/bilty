import { isDeepStrictEqual } from 'node:util';
import type {
  Actor,
  AuditEvent,
  BiltyRecord,
  CompanySnapshot,
  Transition,
} from '@bilty/shared-types';
import { BiltyError } from './errors';
import { parseCompany, parseData, validateIssue } from './validation';
import { amountInWords, totalPaise } from './money';

function guard(b: BiltyRecord, actor: Actor, version: number): void {
  if (b.companyId !== actor.companyId) throw new BiltyError('FORBIDDEN', 'Wrong company');
  if (b.status === 'cancelled') throw new BiltyError('CONFLICT', 'Cancelled bilty is immutable');
  if (b.version !== version) throw new BiltyError('CONFLICT', 'Stale version; reload the bilty');
}
function reasonText(reason: string): string {
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 2000)
    throw new BiltyError('VALIDATION', 'A reason of 1–2000 characters is required');
  return reason.trim();
}
function transition(
  before: BiltyRecord | null,
  after: BiltyRecord,
  action: AuditEvent['action'],
  actor: Actor,
  at: string,
  reason: string | null,
): Transition {
  return {
    bilty: structuredClone(after),
    event: {
      companyId: after.companyId,
      biltyId: after.id,
      actorId: actor.userId,
      action,
      at,
      reason,
      before: structuredClone(before),
      after: structuredClone(after),
    },
  };
}
export function createDraft(id: string, actor: Actor, raw: unknown, at: string): Transition {
  const b: BiltyRecord = {
    id,
    companyId: actor.companyId,
    number: null,
    status: 'draft',
    version: 1,
    data: parseData(raw),
    companySnapshot: null,
    isEdited: false,
    createdAt: at,
    updatedAt: at,
    issuedAt: null,
    editedAt: null,
    cancelledAt: null,
  };
  return transition(null, b, 'created', actor, at, null);
}
export function issueBilty(
  b: BiltyRecord,
  version: number,
  company: CompanySnapshot,
  number: string,
  actor: Actor,
  at: string,
): Transition {
  if (b.companyId !== actor.companyId) throw new BiltyError('FORBIDDEN', 'Wrong company');
  // A repeated issue request is idempotent, even when carrying its original draft version.
  if (b.status === 'issued') return { bilty: structuredClone(b), event: null };
  guard(b, actor, version);
  const data = parseData(b.data);
  validateIssue(data);
  if (!number.trim() || number.length > 100)
    throw new BiltyError('VALIDATION', 'Invalid bilty number');
  return transition(
    b,
    {
      ...b,
      data,
      number,
      status: 'issued',
      companySnapshot: parseCompany(company),
      issuedAt: at,
      updatedAt: at,
      version: b.version + 1,
    },
    'issued',
    actor,
    at,
    null,
  );
}
export function editBilty(
  b: BiltyRecord,
  version: number,
  raw: unknown,
  reason: string,
  actor: Actor,
  at: string,
): Transition {
  guard(b, actor, version);
  const data = parseData(raw);
  if (isDeepStrictEqual(data, b.data)) return { bilty: structuredClone(b), event: null };
  const issued = b.status === 'issued';
  if (issued) validateIssue(data);
  const why = issued ? reasonText(reason) : reason ? reasonText(reason) : null;
  return transition(
    b,
    {
      ...b,
      data,
      version: b.version + 1,
      updatedAt: at,
      isEdited: issued || b.isEdited,
      editedAt: issued ? at : b.editedAt,
    },
    'edited',
    actor,
    at,
    why,
  );
}
export function cancelBilty(
  b: BiltyRecord,
  version: number,
  reason: string,
  actor: Actor,
  at: string,
): Transition {
  guard(b, actor, version);
  return transition(
    b,
    { ...b, status: 'cancelled', cancelledAt: at, updatedAt: at, version: b.version + 1 },
    'cancelled',
    actor,
    at,
    reasonText(reason),
  );
}
/** Both future PDF templates must consume this projection, not recalculate charges. */
export function printData(b: BiltyRecord) {
  const total = totalPaise(b.data.charges);
  return {
    ...structuredClone(b),
    totalPaise: total,
    amountInWords: amountInWords(total),
    watermarks: [
      ...(b.status === 'draft' ? ['DRAFT — NOT VALID'] : []),
      ...(b.status === 'cancelled' ? ['CANCELLED'] : []),
      ...(b.isEdited ? ['EDITED'] : []),
    ],
  };
}
