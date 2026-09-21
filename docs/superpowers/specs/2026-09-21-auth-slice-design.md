# Digital Bilty Platform — Auth & HTTP Slice Design Spec

Created 21 September 2026. This spec covers OAuth authentication, session management, invitations, and HTTP controllers for the Bilty platform.

## Goal

Add Google OAuth authentication, stateful refresh sessions, employee invitations, and HTTP controllers for bilty CRUD. Self-serve company onboarding only (no admin-managed path in V1).

## Constraints

- NestJS + TypeORM + PostgreSQL; pnpm workspace; strict TypeScript.
- Follows patterns from doma-backend: guards, decorators, JWT with HS256.
- Never trust request-body role/companyId; JWT payload is authoritative.
- All tokens (refresh, invite) stored as SHA-256 hashes.

## Entities

### User

```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;                    // Normalized lowercase

  @Column()
  name: string;

  @Column({ nullable: true })
  avatarUrl: string | null;

  @Column({ unique: true })
  googleId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Membership, (m) => m.user)
  memberships: Membership[];

  @OneToMany(() => Session, (s) => s.user)
  sessions: Session[];
}
```

### Company

```typescript
@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  // Print profile fields matching CompanySnapshot
  @Column({ type: 'text', default: '' })
  address: string;

  @Column({ default: '' })
  gstin: string;

  @Column({ default: '' })
  pan: string;

  @Column({ default: '' })
  phone: string;

  @Column({ default: '' })
  email: string;

  @Column({ nullable: true })
  logoUrl: string | null;

  @Column({ default: '#1a73e8' })
  primaryColor: string;

  @Column({ default: '#4285f4' })
  accentColor: string;

  @Column({ type: 'text', default: '' })
  bankDetails: string;

  @Column({ default: '' })
  jurisdiction: string;

  @Column({ type: 'text', default: '' })
  carriageTerms: string;

  @Column({ type: 'text', default: '' })
  demurrageTerms: string;

  @Column({ default: 'BLT' })
  biltyNumberPrefix: string;

  @Column({ default: 1 })
  biltyNumberCounter: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### Membership

```typescript
@Entity('memberships')
@Unique(['userId', 'companyId'])
export class Membership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, (u) => u.memberships)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column({ type: 'enum', enum: ['admin', 'employee'] })
  role: 'admin' | 'employee';

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  joinedAt: Date;

  @Column({ nullable: true })
  revokedAt: Date | null;
}
```

### Session

```typescript
@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, (u) => u.sessions)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  tokenHash: string;              // SHA-256 of refresh token

  @Column({ nullable: true })
  deviceInfo: string | null;

  @Column()
  expiresAt: Date;

  @Column({ default: false })
  isRevoked: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
```

### Invite

```typescript
@Entity('invites')
export class Invite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column()
  email: string;                  // Normalized lowercase

  @Column({ type: 'enum', enum: ['admin', 'employee'] })
  role: 'admin' | 'employee';

  @Column()
  tokenHash: string;              // SHA-256 of invite token

  @Column({ type: 'enum', enum: ['pending', 'accepted', 'expired', 'revoked'] })
  status: 'pending' | 'accepted' | 'expired' | 'revoked';

  @Column()
  expiresAt: Date;                // 7 days from creation

  @Column('uuid')
  invitedById: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  acceptedAt: Date | null;
}
```

### Party (Consignor/Consignee)

```typescript
@Entity('parties')
export class Party {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column({ type: 'enum', enum: ['consignor', 'consignee'] })
  kind: 'consignor' | 'consignee';

  @Column()
  name: string;

  @Column({ type: 'text', default: '' })
  address: string;

  @Column({ default: '' })
  gstin: string;

  @Column({ default: '' })
  phone: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

## Auth Flow

### OAuth Flow

1. User clicks "Sign in with Google" → `GET /auth/google`
2. Backend redirects to Google OAuth consent
3. Google redirects to `GET /auth/google/callback?code=...`
4. Backend exchanges code for profile, then:
   - If user exists by googleId: lookup active membership
   - If invite token provided: verify email match, create user + membership
   - If no invite and new user: create user + company + membership (self-serve)
5. Create session, mint tokens, redirect to frontend

### Invite Flow

1. Admin: `POST /invites { email, role }` → returns invite link
2. Invitee opens link, clicks "Sign in with Google"
3. OAuth callback verifies `invite.email === oauth.email` (normalized)
4. On match: create user + membership, mark invite accepted
5. On mismatch: reject with error

### Token Strategy

**Access Token (JWT, HS256, 15 min):**
```typescript
interface JwtPayload {
  sub: string;        // userId
  cid: string;        // companyId
  role: 'admin' | 'employee';
  iat: number;
  exp: number;
}
```

**Refresh Token (opaque, 7 days):**
- 32 random bytes, base64url encoded
- Stored as SHA-256 hash in sessions table
- httpOnly cookie

## HTTP Endpoints

### Auth (`/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/google` | Public | Initiate OAuth |
| GET | `/auth/google/callback` | Public | Handle callback |
| POST | `/auth/refresh` | Public | Refresh access token |
| POST | `/auth/logout` | JWT | Revoke current session |
| POST | `/auth/logout-all` | JWT | Revoke all sessions |
| GET | `/auth/me` | JWT | Get current user |

### Invites (`/invites`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/invites` | Admin | Create invite |
| GET | `/invites` | Admin | List invites |
| DELETE | `/invites/:id` | Admin | Revoke invite |
| GET | `/invites/verify/:token` | Public | Verify token |

### Company (`/company`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/company` | JWT | Get company |
| PATCH | `/company` | Admin | Update company |
| GET | `/company/members` | Admin | List members |
| DELETE | `/company/members/:id` | Admin | Revoke member |

### Parties (`/parties`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/parties` | JWT | Create party |
| GET | `/parties` | JWT | List parties |
| GET | `/parties/:id` | JWT | Get party |
| PATCH | `/parties/:id` | JWT | Update party |
| DELETE | `/parties/:id` | JWT | Delete party |

### Biltys (`/biltys`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/biltys` | JWT | Create draft |
| GET | `/biltys` | JWT | List biltys |
| GET | `/biltys/:id` | JWT | Get bilty |
| PATCH | `/biltys/:id` | JWT | Edit bilty |
| POST | `/biltys/:id/issue` | JWT | Issue bilty |
| POST | `/biltys/:id/cancel` | JWT | Cancel bilty |
| GET | `/biltys/:id/print` | JWT | Print projection |

## Module Structure

```
apps/api/src/
├── main.ts
├── app.module.ts
├── common/
│   ├── filters/http-exception.filter.ts
│   └── interceptors/transform.interceptor.ts
├── config/config.module.ts
├── database/
│   └── migrations/
│       └── 1790000000001-AuthEntities.ts
└── modules/
    ├── auth/
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   ├── strategies/{google,jwt}.strategy.ts
    │   ├── guards/{jwt-auth,roles}.guard.ts
    │   └── decorators/{public,roles,current-user}.decorator.ts
    ├── user/
    │   ├── user.module.ts
    │   ├── user.service.ts
    │   └── entities/{user,membership,session,invite}.entity.ts
    ├── company/
    │   ├── company.module.ts
    │   ├── company.controller.ts
    │   ├── company.service.ts
    │   └── entities/company.entity.ts
    ├── party/
    │   ├── party.module.ts
    │   ├── party.controller.ts
    │   ├── party.service.ts
    │   └── entities/party.entity.ts
    └── bilty/
        ├── bilty.controller.ts     # NEW
        └── ... (existing files)
```

## Security Requirements

| Requirement | Implementation |
|-------------|----------------|
| No request-body companyId trust | JWT payload provides companyId |
| Active membership check | JwtAuthGuard verifies isActive |
| Email exact match on invite | Normalized comparison in callback |
| Hashed tokens | SHA-256 for refresh and invite tokens |
| Single-use invites | Atomic status update on accept |
| Revocable sessions | isRevoked flag checked on refresh |
| Scoped queries | All queries filter by companyId |
| Party ownership | Party queries include companyId |

## Environment Variables

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
JWT_SECRET=
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3001
DATABASE_URL=
```

## Testing

- Unit tests: existing domain tests remain unchanged
- Integration tests: OAuth flows, invite acceptance, token refresh, membership checks, CRUD operations
- Denial tests: wrong company, revoked membership, expired tokens, email mismatch
- Run via `pnpm test:docker`

## Out of Scope

- Email sending for invites (V1: manual link sharing)
- Multi-company membership (one company per user for V1)
- Platform admin role (separate from company admin)
- Password/magic-link auth (Google OAuth only)
