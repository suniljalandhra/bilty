'use client';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import type { AuditEvent } from '@bilty/shared-types';
import { api, ApiError, errorMessage, json } from '@/lib/api';
import { dateTime, label, type PrintRecord } from '@/lib/model';
import { BiltyDocument } from '@/components/bilty-document';
import { PrintShare } from '@/components/print-share';
import {
  Badge,
  Dialog,
  ErrorNotice,
  Loading,
  Notice,
  PageHeader,
  Section,
  TextArea,
} from '@/components/ui';
export default function BiltyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params),
    [record, setRecord] = useState<PrintRecord | null>(null),
    [history, setHistory] = useState<AuditEvent[]>([]),
    [error, setError] = useState(''),
    [historyError, setHistoryError] = useState(''),
    [busy, setBusy] = useState(false),
    [dialog, setDialog] = useState<'issue' | 'cancel' | null>(null),
    [reason, setReason] = useState(''),
    [dialogError, setDialogError] = useState(''),
    [tab, setTab] = useState<'document' | 'history'>('document');
  async function load() {
    try {
      const value = await api<PrintRecord>(`/biltys/${id}/print`);
      setRecord(value);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }
  async function loadHistory() {
    setHistoryError('');
    try {
      setHistory(await api<AuditEvent[]>(`/biltys/${id}/history`));
    } catch (failure) {
      setHistoryError(errorMessage(failure));
    }
  }
  useEffect(() => {
    void load();
  }, [id]);
  useEffect(() => {
    if (tab === 'history') void loadHistory();
  }, [tab, id, record?.version]);
  async function transition() {
    if (!record || !dialog) return;
    setBusy(true);
    setDialogError('');
    try {
      await api(
        `/biltys/${id}/${dialog}`,
        json('POST', {
          expectedVersion: record.version,
          ...(dialog === 'cancel' ? { reason } : {}),
        }),
      );
      setDialog(null);
      setReason('');
      setError('');
      await load();
    } catch (failure) {
      setDialogError(errorMessage(failure));
      if (failure instanceof ApiError && failure.status === 409) {
        await load();
        setDialog(null);
        setError(
          'This bilty changed while you were viewing it. The latest version is now shown. Review it before trying again.',
        );
      }
    } finally {
      setBusy(false);
    }
  }
  if (!record)
    return error ? (
      <>
        <ErrorNotice message={error} />
        <button
          onClick={() => {
            setError('');
            void load();
          }}
        >
          Try again
        </button>
        <Link href="/biltys">Back to bilty book</Link>
      </>
    ) : (
      <Loading text="Opening your bilty…" />
    );
  return (
    <>
      <Link href="/biltys" className="back-link">
        ← Bilty book
      </Link>
      <PageHeader
        eyebrow={`CONSIGNMENT NOTE · VERSION ${record.version}`}
        title={record.number || 'Untitled draft'}
        description={`Created ${dateTime(record.createdAt)}${record.editedAt ? ` · Edited ${dateTime(record.editedAt)}` : ''}`}
        actions={
          <>
            <Badge status={record.status} />
            {record.status !== 'cancelled' && (
              <Link href={`/biltys/${id}/edit`} className="button">
                Edit bilty
              </Link>
            )}
            {record.status === 'draft' && (
              <button
                className="primary"
                onClick={() => {
                  setDialog('issue');
                  setDialogError('');
                }}
              >
                Issue bilty
              </button>
            )}
            {record.status !== 'cancelled' && (
              <button
                className="danger-text"
                onClick={() => {
                  setDialog('cancel');
                  setDialogError('');
                  setReason('');
                }}
              >
                Cancel bilty
              </button>
            )}
          </>
        }
      />
      <ErrorNotice message={error} />
      {record.status === 'cancelled' && (
        <Notice>
          This bilty was cancelled {dateTime(record.cancelledAt)} and is read-only. Any shared links
          are unavailable.
        </Notice>
      )}
      <div className="document-tabs" role="tablist" aria-label="Bilty views">
        <button
          role="tab"
          aria-selected={tab === 'document'}
          className={tab === 'document' ? 'active' : ''}
          onClick={() => setTab('document')}
        >
          Document
        </button>
        <button
          role="tab"
          aria-selected={tab === 'history'}
          className={tab === 'history' ? 'active' : ''}
          onClick={() => setTab('history')}
        >
          Audit history
        </button>
      </div>
      {tab === 'document' ? (
        <div className="detail-layout document-viewer">
          <BiltyDocument record={record} />
          <aside className="detail-aside">
            <PrintShare record={record} />
            <div className="document-meta">
              <strong>A record you can follow</strong>
              <p>Every edit, issue, and cancellation is preserved in the audit history.</p>
              <p>Updated {dateTime(record.updatedAt)}</p>
            </div>
          </aside>
        </div>
      ) : (
        <Section
          title="Audit history"
          description="A permanent history of this document, including full before and after records."
        >
          <ErrorNotice message={historyError} />
          {historyError && <button onClick={() => void loadHistory()}>Try again</button>}
          {!history.length && !historyError ? (
            <Loading text="Loading audit history…" />
          ) : (
            <ol className="audit-list">
              {history
                .slice()
                .reverse()
                .map((event) => {
                  const changed = event.before
                    ? Object.keys(event.after.data).filter(
                        (key) =>
                          JSON.stringify(
                            event.before!.data[key as keyof typeof event.after.data],
                          ) !==
                          JSON.stringify(event.after.data[key as keyof typeof event.after.data]),
                      )
                    : [];
                  return (
                    <li key={`${event.after.version}-${event.action}`}>
                      <span className={`audit-dot ${event.action}`} />
                      <div>
                        <div className="audit-heading">
                          <strong>{label(event.action)}</strong>
                          <span>Version {event.after.version}</span>
                          <time>{dateTime(event.at)}</time>
                        </div>
                        <p className="hint">
                          By user <span className="mono">{event.actorId}</span>
                        </p>
                        {event.reason && <p className="audit-reason">{event.reason}</p>}
                        {changed.length > 0 && <p>Changed: {changed.map(label).join(', ')}</p>}
                        <details>
                          <summary>View full audit record</summary>
                          <div className="audit-snapshots">
                            <div>
                              <h4>Before</h4>
                              <pre>{JSON.stringify(event.before, null, 2)}</pre>
                            </div>
                            <div>
                              <h4>After</h4>
                              <pre>{JSON.stringify(event.after, null, 2)}</pre>
                            </div>
                          </div>
                        </details>
                      </div>
                    </li>
                  );
                })}
            </ol>
          )}
        </Section>
      )}
      {dialog && (
        <Dialog
          title={dialog === 'issue' ? 'Issue this bilty?' : 'Cancel this bilty?'}
          onClose={() => {
            if (!busy) setDialog(null);
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void transition();
            }}
          >
            <ErrorNotice message={dialogError} />
            {dialog === 'issue' ? (
              <p>
                Issuing assigns a permanent bilty number and saves your company details with this
                document. Check that the parties, route, goods, actual weight, vehicle, and freight
                are complete.
              </p>
            ) : (
              <>
                <p>
                  Cancellation is permanent. The document remains in your records, becomes
                  read-only, and shared links stop working.
                </p>
                <TextArea
                  label="Reason for cancellation"
                  required
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </>
            )}
            <div className="dialog-actions">
              <button type="button" disabled={busy} onClick={() => setDialog(null)}>
                Keep reviewing
              </button>
              <button
                type="submit"
                className={dialog === 'issue' ? 'primary' : 'danger'}
                disabled={busy}
              >
                {busy ? 'Saving…' : dialog === 'issue' ? 'Confirm & issue' : 'Confirm cancellation'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
