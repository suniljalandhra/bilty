'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage, json } from '@/lib/api';
import { dateTime, label, type Invite, type Member } from '@/lib/model';
import { useSession } from '@/components/session';
import {
  Badge,
  Empty,
  ErrorNotice,
  Loading,
  Notice,
  PageHeader,
  Section,
  Select,
  TextField,
  useDirtyForm,
} from '@/components/ui';
export default function TeamPage() {
  const { user, logout } = useSession(),
    [members, setMembers] = useState<Member[]>([]),
    [invites, setInvites] = useState<Invite[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [email, setEmail] = useState(''),
    [role, setRole] = useState<'employee' | 'admin'>('employee'),
    [created, setCreated] = useState<{
      email: string;
      url: string;
      expiresAt: string;
      id: string;
    } | null>(null);
  useDirtyForm(!!email && !busy);
  async function load() {
    setLoading(true);
    setError('');
    try {
      const values = await Promise.all([
        api<Member[]>('/company/members'),
        api<Invite[]>('/invites'),
      ]);
      setMembers(values[0]);
      setInvites(values[1]);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (user?.role === 'admin') void load();
    else setLoading(false);
  }, [user?.role]);
  async function invite(event: FormEvent) {
    event.preventDefault();
    setBusy('invite');
    setError('');
    setMessage('');
    try {
      setCreated(await api('/invites', json('POST', { email, role })));
      setEmail('');
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy('');
    }
  }
  if (user?.role !== 'admin')
    return (
      <>
        <PageHeader title="Team & access" />
        <Notice>Only your company administrators can manage team access.</Notice>
      </>
    );
  const adminCount = members.filter((member) => member.active && member.role === 'admin').length;
  return (
    <>
      <PageHeader
        eyebrow="WORK BETTER TOGETHER"
        title="Team & access"
        description="Invite your team and manage who can access the workspace."
      />
      <ErrorNotice message={error} />
      {message && <Notice>{message}</Notice>}
      <Section
        title="Invite a team member"
        description="Create a private invitation link and share it directly with your teammate."
      >
        <form onSubmit={invite}>
          <div className="invite-form">
            <TextField
              label="Invite email address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Select
              label="Invite role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'employee' | 'admin')}
            >
              <option value="employee">Employee</option>
              <option value="admin">Administrator</option>
            </Select>
            <button className="primary" type="submit" disabled={!!busy}>
              {busy === 'invite' ? 'Creating…' : 'Create invitation'}
            </button>
          </div>
          <p className="hint">
            Employees manage biltys and contacts. Administrators also manage company settings and
            team access.
          </p>
        </form>
        {created && (
          <div className="created-link">
            <strong>Invitation for {created.email}</strong>
            <p>
              Expires {dateTime(created.expiresAt)}. This link is shown only now; copy it before
              leaving.
            </p>
            <input
              aria-label="Private invitation link"
              readOnly
              value={created.url}
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(created.url);
                  setMessage('Invitation link copied. Share it privately with your teammate.');
                } catch {
                  setError('Copy is unavailable. Select the invitation link above and copy it.');
                }
              }}
            >
              Copy invitation link
            </button>
          </div>
        )}
      </Section>
      <Section
        title="Company members"
        description="The last active administrator cannot be removed."
      >
        {loading ? (
          <Loading />
        ) : members.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.userId}>
                    <td>
                      <strong>
                        {member.name || member.email}
                        {member.userId === user?.id && ' (you)'}
                      </strong>
                      <span className="cell-secondary">{member.email}</span>
                    </td>
                    <td>{label(member.role)}</td>
                    <td>
                      <Badge status={member.active ? 'active' : 'revoked'} />
                    </td>
                    <td>{dateTime(member.joinedAt)}</td>
                    <td>
                      {member.active && (
                        <button
                          className="danger-text"
                          disabled={!!busy || (member.role === 'admin' && adminCount <= 1)}
                          title={
                            member.role === 'admin' && adminCount <= 1
                              ? 'The last active administrator cannot be revoked'
                              : undefined
                          }
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Revoke workspace access for ${member.email}? Their current sessions will end.`,
                              )
                            )
                              return;
                            setBusy(member.userId);
                            setError('');
                            try {
                              await api(`/company/members/${member.userId}`, json('DELETE'));
                              if (member.userId === user?.id) {
                                await logout().catch(() => {});
                                window.location.assign('/login');
                                return;
                              }
                              setMessage('Member access revoked.');
                              await load();
                            } catch (failure) {
                              setError(errorMessage(failure));
                            } finally {
                              setBusy('');
                            }
                          }}
                        >
                          Revoke access
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No members available">Try refreshing the workspace.</Empty>
        )}
      </Section>
      <Section
        title="Invitation history"
        description="The latest 100 invitations. Invitation links can only be copied when created."
      >
        {loading ? (
          <Loading />
        ) : invites.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((item) => {
                  const status = item.acceptedAt
                    ? 'accepted'
                    : item.revokedAt
                      ? 'revoked'
                      : new Date(item.expiresAt).getTime() < Date.now()
                        ? 'expired'
                        : 'pending';
                  return (
                    <tr key={item.id}>
                      <td>{item.email}</td>
                      <td>{label(item.role)}</td>
                      <td>
                        <Badge status={status} />
                      </td>
                      <td>{dateTime(item.expiresAt)}</td>
                      <td>
                        {status === 'pending' && (
                          <button
                            disabled={!!busy}
                            className="danger-text"
                            onClick={async () => {
                              setBusy(item.id);
                              setError('');
                              try {
                                await api(`/invites/${item.id}`, json('DELETE'));
                                if (created?.id === item.id) setCreated(null);
                                setMessage('Invitation revoked.');
                                await load();
                              } catch (failure) {
                                setError(errorMessage(failure));
                              } finally {
                                setBusy('');
                              }
                            }}
                          >
                            Revoke invitation
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">
            No invitations yet. Create one above to bring your team into the workspace.
          </p>
        )}
      </Section>
    </>
  );
}
