import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Actor, UserRole } from '@bilty/shared-types';
import type { DataSource, EntityManager } from 'typeorm';
export interface Principal {
  userId: string;
  sessionId: string;
  companyId: string | null;
  role: UserRole | null;
}
export function actorOf(p: Principal): Actor {
  if (!p.companyId || !p.role) throw new ForbiddenException('Active company membership required');
  return { userId: p.userId, companyId: p.companyId };
}
export async function membershipWork<T>(
  db: DataSource,
  p: Principal,
  admin: boolean,
  work: (tx: EntityManager, actor: Actor) => Promise<T>,
): Promise<T> {
  const actor = actorOf(p);
  return db.transaction(async (tx) => {
    // Serialize member/admin mutations without locking the numbering row.
    if (admin)
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [actor.companyId]);
    const members = await tx.query(
      'SELECT role FROM memberships WHERE user_id=$1 AND company_id=$2 AND active=true FOR SHARE',
      [actor.userId, actor.companyId],
    );
    if (!members[0] || (admin && members[0].role !== 'admin'))
      throw new ForbiddenException('Active administrator membership required');
    const sessions = await tx.query(
      'SELECT id FROM sessions WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL AND expires_at>now() FOR SHARE',
      [p.sessionId, p.userId],
    );
    if (!sessions.length) throw new UnauthorizedException('Session expired or revoked');
    return work(tx, actor);
  });
}
