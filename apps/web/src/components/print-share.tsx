'use client';
import { useEffect, useState } from 'react';
import type { BiltyRecord } from '@bilty/shared-types';
import { api, apiResponse, errorMessage, json } from '@/lib/api';
import { dateTime, label, type Share } from '@/lib/model';
import { Badge, ErrorNotice, Notice, Section, Select } from './ui';
export function PrintShare({ record }: { record: BiltyRecord }) {
  const format = 'a4';
  const [copy, setCopy] = useState('consignor'),
    [hours, setHours] = useState(24),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [shares, setShares] = useState<Share[]>([]),
    [created, setCreated] = useState<{
      id: string;
      url: string;
      expiresAt: string;
      version: number;
      copy: string;
    } | null>(null),
    [loadingShares, setLoadingShares] = useState(false);
  async function loadShares() {
    setLoadingShares(true);
    try {
      setShares(await api<Share[]>(`/biltys/${record.id}/shares`));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setLoadingShares(false);
    }
  }
  useEffect(() => {
    if (record.status !== 'draft') void loadShares();
  }, [record.id, record.version]);
  async function pdf(print: boolean) {
    setBusy(print ? 'print' : 'pdf');
    setError('');
    const preview = print ? window.open('', '_blank') : null;
    if (print && !preview) {
      setError('Allow pop-ups for Bilty to open the printable PDF, or use Download PDF.');
      setBusy('');
      return;
    }
    if (preview) {
      preview.opener = null;
      preview.document.title = 'Preparing bilty PDF';
      preview.document.body.textContent = 'Preparing your printable PDF…';
    }
    try {
      const response = await apiResponse(
        `/biltys/${record.id}/pdf?${new URLSearchParams({ format, copy })}`,
      );
      const url = URL.createObjectURL(await response.blob());
      if (preview) {
        preview.location.href = url;
        setMessage('The PDF is open in a new tab. Use the PDF viewer’s print button.');
      } else {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${(record.number || 'draft-bilty').replace(/[^a-zA-Z0-9_-]/g, '-')}-${copy}-${format}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (failure) {
      preview?.close();
      setError(errorMessage(failure));
    } finally {
      setBusy('');
    }
  }
  async function createShare() {
    setBusy('share');
    setError('');
    setMessage('');
    try {
      const result = await api<{ id: string; url: string; expiresAt: string; version: number }>(
        `/biltys/${record.id}/shares`,
        json('POST', { expiresInHours: hours, format, copy }),
      );
      setCreated({ ...result, copy });
      await loadShares();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy('');
    }
  }
  return (
    <Section
      title="Print & share"
      description="A4 landscape PDF. Choose the copy for your recipient."
    >
      <ErrorNotice message={error} />
      {message && <Notice>{message}</Notice>}
      <div className="form-grid">
        <Select label="Document copy" value={copy} onChange={(e) => setCopy(e.target.value)}>
          {['consignor', 'consignee', 'driver', 'office'].map((value) => (
            <option key={value} value={value}>
              {label(value)} copy
            </option>
          ))}
        </Select>
      </div>
      <div className="actions print-actions">
        <button disabled={!!busy} onClick={() => void pdf(false)}>
          {busy === 'pdf' ? 'Preparing…' : 'Download PDF'}
        </button>
        <button disabled={!!busy} onClick={() => void pdf(true)}>
          {busy === 'print' ? 'Preparing…' : 'Print PDF'}
        </button>
      </div>
      {record.status === 'issued' ? (
        <div className="share-controls">
          <h3>Share an expiring PDF link</h3>
          <p className="hint">
            Anyone with this private link can view the PDF until it expires or you revoke it. The
            link keeps version {record.version}; later edits need a new link.
          </p>
          <div className="share-create">
            <Select
              label="Link expires after"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
            >
              <option value="1">1 hour</option>
              <option value="24">24 hours</option>
              <option value="72">3 days</option>
              <option value="168">7 days</option>
            </Select>
            <button className="primary" disabled={!!busy} onClick={() => void createShare()}>
              {busy === 'share' ? 'Creating…' : 'Create share link'}
            </button>
          </div>
          {created && (
            <div className="created-link">
              <strong>Link ready · version {created.version}</strong>
              <p>Expires {dateTime(created.expiresAt)}</p>
              <input
                aria-label="Private PDF share link"
                readOnly
                value={created.url}
                onFocus={(e) => e.target.select()}
              />
              <div className="actions">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(created.url);
                      setMessage('Share link copied.');
                    } catch {
                      setError(
                        'Copy is unavailable in this browser. Select the link above and copy it.',
                      );
                    }
                  }}
                >
                  Copy link
                </button>
                <a
                  className="button"
                  href={`https://wa.me/?text=${encodeURIComponent(`Bilty ${record.number} (${label(created.copy)} copy). View the PDF: ${created.url}\nThis link expires ${dateTime(created.expiresAt)}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open WhatsApp ↗
                </a>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="hint print-actions">
          {record.status === 'draft'
            ? 'Issue this bilty to create a share link. Draft PDFs carry a draft watermark.'
            : 'Sharing is unavailable for cancelled biltys. Existing links no longer open.'}
        </p>
      )}
      {record.status !== 'draft' && (
        <div className="share-list">
          <h3>Share history</h3>
          {loadingShares ? (
            <p className="hint">Loading share history…</p>
          ) : !shares.length ? (
            <p className="hint">No share links created.</p>
          ) : (
            <ul>
              {shares.map((share) => {
                const active =
                  !share.revokedAt &&
                  new Date(share.expiresAt).getTime() > Date.now() &&
                  record.status === 'issued';
                return (
                  <li key={share.id}>
                    <div>
                      <strong>
                        Version {share.version} · A4 · {label(share.copy)} copy
                      </strong>
                      <span>Expires {dateTime(share.expiresAt)}</span>
                      <Badge
                        status={
                          share.revokedAt
                            ? 'revoked'
                            : active
                              ? 'active'
                              : record.status === 'cancelled'
                                ? 'cancelled'
                                : 'expired'
                        }
                      />
                    </div>
                    {active && (
                      <button
                        className="danger-text"
                        disabled={!!busy}
                        onClick={async () => {
                          setBusy(share.id);
                          setError('');
                          try {
                            await api(`/biltys/${record.id}/shares/${share.id}`, json('DELETE'));
                            if (created?.id === share.id) setCreated(null);
                            await loadShares();
                          } catch (failure) {
                            setError(errorMessage(failure));
                          } finally {
                            setBusy('');
                          }
                        }}
                      >
                        Revoke link
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Section>
  );
}
