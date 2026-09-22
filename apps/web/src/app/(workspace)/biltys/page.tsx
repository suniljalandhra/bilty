'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Plus, SlidersHorizontal } from 'lucide-react';
import type { BiltyRecord } from '@bilty/shared-types';
import { api, errorMessage } from '@/lib/api';
import { dateOnly, money } from '@/lib/model';
import {
  Badge,
  Empty,
  ErrorNotice,
  Loading,
  PageHeader,
  Pagination,
  TextField,
} from '@/components/ui';
const LIMIT = 25;
export default function BiltyListPage() {
  const [rows, setRows] = useState<BiltyRecord[]>([]),
    [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [status, setStatus] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [offset, setOffset] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [reload, setReload] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setOffset(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
    if (query) params.set('q', query);
    if (status) params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    api<BiltyRecord[]>(`/biltys?${params}`)
      .then((result) => {
        if (active) setRows(result);
      })
      .catch((failure) => {
        if (active) setError(errorMessage(failure));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [offset, query, status, from, to, reload]);
  return (
    <>
      <PageHeader
        eyebrow="YOUR OPERATIONS, IN ORDER"
        title="Bilty book"
        description="Every consignment. Every detail. All in one place."
        actions={
          <Link href="/biltys/new" className="button primary">
            <Plus aria-hidden="true" data-icon="inline-start" />
            New bilty
          </Link>
        }
      />
      <div className="card">
        <div className="list-toolbar">
          <div className="search-field">
            <TextField
              label="Search biltys"
              type="search"
              placeholder="Bilty no., party, route or vehicle"
              className="search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="tabs" aria-label="Filter by status">
            {['', 'draft', 'issued', 'cancelled'].map((value) => (
              <button
                key={value}
                className={status === value ? 'selected' : ''}
                aria-pressed={status === value}
                onClick={() => {
                  setStatus(value);
                  setOffset(0);
                }}
              >
                {value || 'All biltys'}
              </button>
            ))}
          </div>
        </div>
        <div className="date-filters">
          <div className="filter-heading">
            <SlidersHorizontal aria-hidden="true" />
            <span>Refine results</span>
          </div>
          <TextField
            label="Created from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
              setOffset(0);
            }}
          />
          <TextField
            label="Created to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value);
              setOffset(0);
            }}
          />
          {(search || status || from || to) && (
            <button
              className="text-button"
              onClick={() => {
                setSearch('');
                setQuery('');
                setStatus('');
                setFrom('');
                setTo('');
                setOffset(0);
              }}
            >
              Clear filters
            </button>
          )}
          <span className="hint date-note">Newest first</span>
        </div>
        <ErrorNotice message={error} />
        {error && (
          <div className="section-body">
            <button onClick={() => setReload(reload + 1)}>Try again</button>
          </div>
        )}
        {loading ? (
          <Loading text="Loading your bilty book…" />
        ) : (
          !error &&
          (rows.length ? (
            <>
              <div className="table-scroll">
                <table className="bilty-table">
                  <thead>
                    <tr>
                      <th>Bilty / date</th>
                      <th>Consignor → consignee</th>
                      <th>Route</th>
                      <th>Vehicle</th>
                      <th>Status</th>
                      <th className="align-right">Freight</th>
                      <th>
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td data-label="Bilty / date">
                          <Link className="document-link" href={`/biltys/${row.id}`}>
                            {row.number || 'Untitled draft'}
                          </Link>
                          <span className="cell-secondary">{dateOnly(row.createdAt)}</span>
                        </td>
                        <td data-label="Parties">
                          <span className="cell-main">
                            {row.data.consignor.name || 'No consignor'}
                          </span>
                          <span className="cell-secondary">
                            → {row.data.consignee.name || 'No consignee'}
                          </span>
                        </td>
                        <td data-label="Route">
                          <span className="cell-main">{row.data.fromLocation || '—'}</span>
                          <span className="cell-secondary">→ {row.data.toLocation || '—'}</span>
                        </td>
                        <td data-label="Vehicle" className="mono">{row.data.vehicleNumber || '—'}</td>
                        <td data-label="Status">
                          <Badge status={row.status} />
                          {row.isEdited && (
                            <span className="cell-secondary">Edited · v{row.version}</span>
                          )}
                        </td>
                        <td data-label="Freight" className="align-right mono">{money(row.data.charges.freightPaise)}</td>
                        <td>
                          <Link
                            href={`/biltys/${row.id}`}
                            className="row-open"
                            aria-label={`Open ${row.number || 'draft bilty'}`}
                          >
                            <ArrowUpRight aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination offset={offset} count={rows.length} limit={LIMIT} onChange={setOffset} />
            </>
          ) : (
            <Empty
              title={
                search || status || from || to || offset
                  ? 'No biltys match these filters'
                  : 'Your first journey starts here'
              }
              action={
                !search && !status && !from && !to && !offset ? (
                  <Link className="button primary" href="/biltys/new">
                    Create your first bilty
                  </Link>
                ) : (
                  <button
                    onClick={() => {
                      setSearch('');
                      setQuery('');
                      setStatus('');
                      setFrom('');
                      setTo('');
                      setOffset(0);
                    }}
                  >
                    Reset filters
                  </button>
                )
              }
            >
              {search || status || from || to || offset
                ? 'Try a different search or clear your filters.'
                : 'Create a draft, add the consignment details, and issue it when you’re ready.'}
            </Empty>
          ))
        )}
      </div>
    </>
  );
}
