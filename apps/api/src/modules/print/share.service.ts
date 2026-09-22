import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { BiltyRecord } from '@bilty/shared-types';
import { z } from 'zod';
import { membershipWork, type Principal } from '../auth/access';
import type { AuthConfig } from '../auth/config';
import { hashToken, opaqueToken, tokenPattern } from '../auth/tokens';
import { hydrate, selectRecord } from '../bilty/bilty.service';
import { printOptions, type PrintOptions } from './pdf';
const shareInput = printOptions.extend({ expiresInHours: z.number().int().min(1).max(168) });
export class ShareService {
  constructor(
    private readonly db: DataSource,
    private readonly config: AuthConfig,
  ) {}
  create(p: Principal, id: string, raw: unknown) {
    z.uuid().parse(id);
    const input = shareInput.parse(raw);
    return membershipWork(this.db, p, false, async (tx, a) => {
      const [row] = await tx.query(`${selectRecord} WHERE id=$1 AND company_id=$2 FOR SHARE`, [
        id,
        a.companyId,
      ]);
      if (!row) throw new NotFoundException('Bilty not found');
      const snapshot = hydrate(row);
      if (snapshot.status !== 'issued')
        throw new ConflictException('Only issued biltys can be shared');
      const token = opaqueToken(),
        shareId = randomUUID();
      const rows = await tx.query(
        `INSERT INTO bilty_shares(id,company_id,bilty_id,created_by,token_hash,snapshot,version,format,copy,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now()+$10*interval '1 hour') RETURNING expires_at`,
        [
          shareId,
          a.companyId,
          id,
          a.userId,
          hashToken(token),
          snapshot,
          snapshot.version,
          input.format,
          input.copy,
          input.expiresInHours,
        ],
      );
      const origin = this.config.PUBLIC_API_URL ?? new URL(this.config.GOOGLE_CALLBACK_URL).origin;
      return {
        id: shareId,
        url: `${origin}/shared/${token}`,
        expiresAt: rows[0].expires_at.toISOString(),
        version: snapshot.version,
      };
    });
  }
  list(p: Principal, id: string) {
    z.uuid().parse(id);
    return membershipWork(this.db, p, false, async (tx, a) => {
      if (
        !(await tx.query('SELECT id FROM biltys WHERE id=$1 AND company_id=$2', [id, a.companyId]))
          .length
      )
        throw new NotFoundException('Bilty not found');
      return tx.query(
        'SELECT id,version,format,copy,expires_at AS "expiresAt",revoked_at AS "revokedAt",created_at AS "createdAt" FROM bilty_shares WHERE bilty_id=$1 AND company_id=$2 ORDER BY created_at DESC LIMIT 100',
        [id, a.companyId],
      );
    });
  }
  revoke(p: Principal, id: string, shareId: string) {
    z.uuid().parse(id);
    z.uuid().parse(shareId);
    return membershipWork(this.db, p, false, async (tx, a) => {
      const [rows] = await tx.query(
        'UPDATE bilty_shares SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1 AND bilty_id=$2 AND company_id=$3 RETURNING id',
        [shareId, id, a.companyId],
      );
      if (!rows.length) throw new NotFoundException('Share not found');
      return { revoked: true };
    });
  }
  async resolve(token: string): Promise<{ record: BiltyRecord; options: PrintOptions }> {
    if (!tokenPattern.test(token)) throw new NotFoundException('Link unavailable');
    const [row] = await this.db.query(
      `SELECT s.snapshot,s.format,s.copy FROM bilty_shares s JOIN biltys b ON b.id=s.bilty_id AND b.company_id=s.company_id
      WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND b.status='issued'`,
      [hashToken(token)],
    );
    if (!row) throw new NotFoundException('Link unavailable');
    return { record: row.snapshot, options: { format: row.format, copy: row.copy } };
  }
}
