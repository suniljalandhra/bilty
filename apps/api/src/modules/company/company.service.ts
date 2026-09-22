import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { z } from 'zod';
import type { AuthConfig } from '../auth/config';
import { membershipWork, type Principal } from '../auth/access';
import { hashToken, opaqueToken, tokenPattern } from '../auth/tokens';
import { numberPrefix } from '../auth/auth.service';
import { parseCompany } from '../bilty/validation';
const inviteSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  role: z.enum(['admin', 'employee']),
});
const settingsSchema = z
  .strictObject({
    profile: z.record(z.string(), z.unknown()).optional(),
    numberPrefix: numberPrefix.optional(),
  })
  .refine((v) => v.profile !== undefined || v.numberPrefix !== undefined);
const idSchema = z.uuid();
export class CompanyService {
  constructor(
    private readonly db: DataSource,
    private readonly config: AuthConfig,
  ) {}
  get(p: Principal) {
    return membershipWork(this.db, p, false, async (tx, a) => {
      const [row] = await tx.query(
        'SELECT id,profile,number_prefix AS "numberPrefix",next_number::text AS "nextNumber" FROM companies WHERE id=$1',
        [a.companyId],
      );
      return row;
    });
  }
  update(p: Principal, raw: unknown) {
    const input = settingsSchema.parse(raw);
    return membershipWork(this.db, p, true, async (tx, a) => {
      const [row] = await tx.query(
        'SELECT profile,number_prefix FROM companies WHERE id=$1 FOR UPDATE',
        [a.companyId],
      );
      const profile = input.profile
        ? parseCompany({ ...row.profile, ...input.profile })
        : row.profile;
      const prefix = input.numberPrefix ?? row.number_prefix;
      await tx.query('UPDATE companies SET profile=$2,number_prefix=$3 WHERE id=$1', [
        a.companyId,
        profile,
        prefix,
      ]);
      return { id: a.companyId, profile, numberPrefix: prefix };
    });
  }
  members(p: Principal) {
    return membershipWork(this.db, p, true, (tx, a) =>
      tx.query(
        `SELECT m.user_id AS "userId",u.email,u.name,m.role,m.active,m.joined_at AS "joinedAt",m.revoked_at AS "revokedAt" FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.company_id=$1 ORDER BY m.joined_at,m.user_id`,
        [a.companyId],
      ),
    );
  }
  revokeMember(p: Principal, id: string) {
    idSchema.parse(id);
    return membershipWork(this.db, p, true, async (tx, a) => {
      const [member] = await tx.query(
        'SELECT role,active FROM memberships WHERE company_id=$1 AND user_id=$2 FOR UPDATE',
        [a.companyId, id],
      );
      if (!member) throw new NotFoundException('Member not found');
      if (member.active && member.role === 'admin') {
        const admins = await tx.query(
          "SELECT user_id FROM memberships WHERE company_id=$1 AND active=true AND role='admin'",
          [a.companyId],
        );
        if (admins.length <= 1)
          throw new ConflictException('Cannot revoke the last active administrator');
      }
      await tx.query(
        'UPDATE memberships SET active=false,revoked_at=COALESCE(revoked_at,now()) WHERE company_id=$1 AND user_id=$2',
        [a.companyId, id],
      );
      await tx.query('UPDATE sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1', [
        id,
      ]);
      return { revoked: true };
    });
  }
  createInvite(p: Principal, raw: unknown) {
    const input = inviteSchema.parse(raw);
    return membershipWork(this.db, p, true, async (tx, a) => {
      const token = opaqueToken(),
        id = randomUUID();
      const rows = await tx.query(
        "INSERT INTO invites(id,company_id,email,role,token_hash,expires_at,invited_by) VALUES($1,$2,$3,$4,$5,now()+interval '7 days',$6) RETURNING expires_at",
        [id, a.companyId, input.email, input.role, hashToken(token), a.userId],
      );
      return {
        id,
        ...input,
        token,
        url: `${this.config.FRONTEND_URL}/invite?token=${token}`,
        expiresAt: rows[0].expires_at.toISOString(),
      };
    });
  }
  invites(p: Principal) {
    return membershipWork(this.db, p, true, (tx, a) =>
      tx.query(
        'SELECT id,email,role,expires_at AS "expiresAt",accepted_at AS "acceptedAt",revoked_at AS "revokedAt",created_at AS "createdAt" FROM invites WHERE company_id=$1 ORDER BY created_at DESC LIMIT 100',
        [a.companyId],
      ),
    );
  }
  revokeInvite(p: Principal, id: string) {
    idSchema.parse(id);
    return membershipWork(this.db, p, true, async (tx, a) => {
      const [rows] = await tx.query(
        'UPDATE invites SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1 AND company_id=$2 RETURNING id',
        [id, a.companyId],
      );
      if (!rows.length) throw new NotFoundException('Invitation not found');
      return { revoked: true };
    });
  }
  async verifyInvite(token: string) {
    if (!tokenPattern.test(token)) throw new NotFoundException('Invitation unavailable');
    const [row] = await this.db.query(
      'SELECT email,role FROM invites WHERE token_hash=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()',
      [hashToken(token)],
    );
    if (!row) throw new NotFoundException('Invitation unavailable');
    return row;
  }
}
