'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage, json } from '@/lib/api';
import { label, type Party } from '@/lib/model';
import {
  Badge,
  Dialog,
  Empty,
  ErrorNotice,
  Loading,
  Notice,
  PageHeader,
  Pagination,
  Select,
  TextArea,
  TextField,
  useDirtyForm,
} from '@/components/ui';
const LIMIT = 25;
type PartyInput = Pick<Party, 'name' | 'address' | 'gstin' | 'phone' | 'kind'>;
const blank = (): PartyInput => ({
  kind: 'consignor',
  name: '',
  address: '',
  gstin: '',
  phone: '',
});
export default function PartiesPage() {
  const [parties, setParties] = useState<Party[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [offset, setOffset] = useState(0),
    [search, setSearch] = useState(''),
    [kind, setKind] = useState(''),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<Party | null>(null),
    [input, setInput] = useState<PartyInput>(blank),
    [dialogError, setDialogError] = useState(''),
    [busy, setBusy] = useState(false);
  const original = editing
    ? {
        kind: editing.kind,
        name: editing.name,
        address: editing.address,
        gstin: editing.gstin,
        phone: editing.phone,
      }
    : blank();
  const dirty = open && JSON.stringify(input) !== JSON.stringify(original);
  useDirtyForm(dirty && !busy);
  async function load() {
    setLoading(true);
    setError('');
    try {
      setParties(await api<Party[]>(`/parties?limit=${LIMIT}&offset=${offset}`));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [offset]);
  function edit(party: Party | null) {
    setEditing(party);
    setInput(
      party
        ? {
            kind: party.kind,
            name: party.name,
            address: party.address,
            gstin: party.gstin,
            phone: party.phone,
          }
        : blank(),
    );
    setDialogError('');
    setOpen(true);
  }
  function close() {
    if (busy) return;
    if (!dirty || window.confirm('Discard your unsaved contact changes?')) setOpen(false);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setDialogError('');
    try {
      const { kind: partyKind, ...fields } = input;
      await api(
        editing ? `/parties/${editing.id}` : '/parties',
        json(editing ? 'PATCH' : 'POST', editing ? fields : { ...fields, kind: partyKind }),
      );
      setOpen(false);
      setMessage(
        editing
          ? 'Contact updated. Existing biltys keep their saved contact details.'
          : 'Contact added to the address book.',
      );
      await load();
    } catch (failure) {
      setDialogError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  const visible = parties.filter(
    (party) =>
      (!kind || party.kind === kind) &&
      (!search ||
        [party.name, party.address, party.gstin, party.phone].some((value) =>
          value.toLowerCase().includes(search.toLowerCase()),
        )),
  );
  return (
    <>
      <PageHeader
        eyebrow="YOUR PEOPLE"
        title="Address book"
        description="Save consignors and consignees for quicker, more consistent biltys."
        actions={
          <button className="primary" onClick={() => edit(null)}>
            ＋ Add contact
          </button>
        }
      />
      <ErrorNotice message={error} />
      {message && <Notice>{message}</Notice>}
      <div className="card">
        <div className="list-toolbar">
          <div className="search-field">
            <TextField
              label="Find contacts on this page"
              type="search"
              placeholder="Name, address, GSTIN or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select label="Contact type" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All contacts</option>
            <option value="consignor">Consignors</option>
            <option value="consignee">Consignees</option>
          </Select>
        </div>
        {loading ? (
          <Loading text="Loading your address book…" />
        ) : error ? (
          <div className="section-body">
            <button onClick={() => void load()}>Try again</button>
          </div>
        ) : visible.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Type</th>
                  <th>Address / GSTIN</th>
                  <th>Phone</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((party) => (
                  <tr key={party.id}>
                    <td>
                      <strong>{party.name}</strong>
                    </td>
                    <td>
                      <Badge status={party.kind} />
                    </td>
                    <td>
                      <span className="cell-main contact-address">{party.address || '—'}</span>
                      <span className="cell-secondary mono">{party.gstin || 'No GSTIN'}</span>
                    </td>
                    <td>{party.phone || '—'}</td>
                    <td>
                      <div className="actions">
                        <button onClick={() => edit(party)} aria-label={`Edit ${party.name}`}>
                          Edit
                        </button>
                        <button
                          className="text-button danger-text"
                          disabled={busy}
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Archive ${party.name}? Saved biltys keep their existing details.`,
                              )
                            )
                              return;
                            setBusy(true);
                            setError('');
                            try {
                              await api(`/parties/${party.id}`, json('DELETE'));
                              setMessage('Contact archived. Existing biltys are unchanged.');
                              await load();
                            } catch (failure) {
                              setError(errorMessage(failure));
                            } finally {
                              setBusy(false);
                            }
                          }}
                          aria-label={`Archive ${party.name}`}
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={
              search || kind ? 'No matching contacts on this page' : 'Keep your contacts close'
            }
            action={
              search || kind ? (
                <button
                  onClick={() => {
                    setSearch('');
                    setKind('');
                  }}
                >
                  Clear filters
                </button>
              ) : (
                <button className="primary" onClick={() => edit(null)}>
                  Add your first contact
                </button>
              )
            }
          >
            {search || kind
              ? 'Clear the filters or check another page.'
              : 'Add a sender or receiver, then select them when creating a bilty.'}
          </Empty>
        )}
        <Pagination
          offset={offset}
          count={parties.length}
          limit={LIMIT}
          onChange={setOffset}
          busy={loading}
        />
      </div>
      {open && (
        <Dialog title={editing ? 'Edit contact' : 'Add contact'} onClose={close}>
          <form onSubmit={save}>
            <ErrorNotice message={dialogError} />
            <fieldset className="plain-fieldset" disabled={busy}>
              <Select
                label="Contact type"
                disabled={!!editing}
                value={input.kind}
                onChange={(e) => setInput({ ...input, kind: e.target.value as PartyInput['kind'] })}
              >
                {['consignor', 'consignee'].map((value) => (
                  <option key={value} value={value}>
                    {label(value)}
                  </option>
                ))}
              </Select>
              <TextField
                label="Contact name"
                required
                value={input.name}
                onChange={(e) => setInput({ ...input, name: e.target.value })}
              />
              <TextArea
                label="Address"
                maxLength={2000}
                value={input.address}
                onChange={(e) => setInput({ ...input, address: e.target.value })}
              />
              <div className="form-grid">
                <TextField
                  label="GSTIN"
                  value={input.gstin}
                  onChange={(e) => setInput({ ...input, gstin: e.target.value })}
                />
                <TextField
                  label="Phone"
                  type="tel"
                  value={input.phone}
                  onChange={(e) => setInput({ ...input, phone: e.target.value })}
                />
              </div>
            </fieldset>
            <div className="dialog-actions">
              <button type="button" disabled={busy} onClick={close}>
                Cancel
              </button>
              <button className="primary" disabled={busy} type="submit">
                {busy ? 'Saving…' : editing ? 'Save contact' : 'Add contact'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
