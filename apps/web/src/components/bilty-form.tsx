'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import type { BiltyData, BiltyRecord, Measurement, PartySnapshot } from '@bilty/shared-types';
import { api, ApiError, errorMessage, json } from '@/lib/api';
import { blankBilty, label, money, reconcileData, type Party } from '@/lib/model';
import {
  ErrorNotice,
  MoneyInput,
  Notice,
  PageHeader,
  Section,
  Select,
  TextArea,
  TextField,
  useDirtyForm,
} from './ui';
function PartyFields({
  kind,
  value,
  onChange,
  parties,
}: {
  kind: 'consignor' | 'consignee';
  value: PartySnapshot;
  onChange: (value: PartySnapshot) => void;
  parties: Party[];
}) {
  const title = label(kind),
    choices = parties.filter((party) => party.kind === kind);
  return (
    <div className="party-fields">
      <div className="party-label">
        <span>{kind === 'consignor' ? '01' : '02'}</span>
        <h3>{title}</h3>
        <small>{kind === 'consignor' ? 'Sender' : 'Receiver'}</small>
      </div>
      <Select
        label={`${title} from address book`}
        value={value.partyId || ''}
        onChange={(e) => {
          const party = choices.find((item) => item.id === e.target.value);
          onChange(
            party
              ? {
                  partyId: party.id,
                  name: party.name,
                  address: party.address,
                  gstin: party.gstin,
                  phone: party.phone,
                }
              : { ...value, partyId: null },
          );
        }}
      >
        <option value="">Manual entry</option>
        {value.partyId && !choices.some((p) => p.id === value.partyId) && (
          <option value={value.partyId}>{value.name} (saved snapshot)</option>
        )}
        {choices.map((party) => (
          <option key={party.id} value={party.id}>
            {party.name}
          </option>
        ))}
      </Select>
      <TextField
        label={`${title} name`}
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
      />
      <TextArea
        label={`${title} address`}
        maxLength={2000}
        value={value.address}
        onChange={(e) => onChange({ ...value, address: e.target.value })}
      />
      <div className="form-grid">
        <TextField
          label={`${title} GSTIN`}
          value={value.gstin}
          onChange={(e) => onChange({ ...value, gstin: e.target.value })}
        />
        <TextField
          label={`${title} phone`}
          type="tel"
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
        />
      </div>
    </div>
  );
}
function WeightInput({
  title,
  value,
  onChange,
}: {
  title: string;
  value: Measurement | null;
  onChange: (value: Measurement | null) => void;
}) {
  const [unit, setUnit] = useState<Measurement['unit']>(value?.unit || 'kg');
  return (
    <div className="measurement">
      <TextField
        label={title}
        inputMode="decimal"
        pattern="[0-9]{1,9}([.][0-9]{1,3})?"
        title="Positive weight, up to 3 decimal places"
        value={value?.value || ''}
        onChange={(e) =>
          onChange(e.target.value ? { value: e.target.value, unit: value?.unit || unit } : null)
        }
      />
      <Select
        label={`${title} unit`}
        value={value?.unit || unit}
        onChange={(e) => {
          const selected = e.target.value as Measurement['unit'];
          setUnit(selected);
          if (value) onChange({ ...value, unit: selected });
        }}
      >
        <option value="kg">kg</option>
        <option value="quintal">quintal</option>
        <option value="tonne">tonne</option>
      </Select>
    </div>
  );
}
export function BiltyForm({ record }: { record?: BiltyRecord }) {
  const router = useRouter(),
    [baseline, setBaseline] = useState(record),
    [data, setData] = useState<BiltyData>(() => structuredClone(record?.data || blankBilty())),
    [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [parties, setParties] = useState<Party[]>([]),
    [partyError, setPartyError] = useState(''),
    [moreParties, setMoreParties] = useState(false),
    [loadingParties, setLoadingParties] = useState(false);
  const [conflict, setConflict] = useState<{
    latest: BiltyRecord;
    merged: BiltyData;
    keys: (keyof BiltyData)[];
    choices: Partial<Record<keyof BiltyData, 'mine' | 'latest'>>;
  } | null>(null);
  const dirty = JSON.stringify(data) !== JSON.stringify(baseline?.data || blankBilty()) || !!reason;
  useDirtyForm(dirty && !busy);
  async function loadParties(offset = 0) {
    setLoadingParties(true);
    setPartyError('');
    try {
      const items = await api<Party[]>(`/parties?limit=100&offset=${offset}`);
      setParties((old) => (offset ? [...old, ...items] : items));
      setMoreParties(items.length === 100 && offset < 100000);
    } catch (failure) {
      setPartyError(errorMessage(failure));
    } finally {
      setLoadingParties(false);
    }
  }
  useEffect(() => {
    void loadParties();
  }, []);
  const update = <K extends keyof BiltyData>(key: K, value: BiltyData[K]) =>
    setData((old) => ({ ...old, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (conflict) return;
    setError('');
    setBusy(true);
    try {
      const saved = await api<BiltyRecord>(
        baseline ? `/biltys/${baseline.id}` : '/biltys',
        json(
          baseline ? 'PUT' : 'POST',
          baseline ? { expectedVersion: baseline.version, data, reason } : { data },
        ),
      );
      setBaseline(saved);
      setData(saved.data);
      setReason('');
      router.replace(`/biltys/${saved.id}`);
    } catch (failure) {
      setError(errorMessage(failure));
      if (failure instanceof ApiError && failure.status === 409 && baseline) {
        try {
          const latest = await api<BiltyRecord>(`/biltys/${baseline.id}`);
          const result = reconcileData(baseline.data, data, latest.data);
          setConflict({ latest, merged: result.data, keys: result.conflicts, choices: {} });
        } catch (loadError) {
          setError(
            `${errorMessage(failure)} Latest version could not be loaded: ${errorMessage(loadError)}`,
          );
        }
      }
    } finally {
      setBusy(false);
    }
  }
  if (record?.status === 'cancelled')
    return (
      <>
        <PageHeader title="This bilty is cancelled" />
        <Notice>Cancelled biltys are read-only.</Notice>
        <Link href={`/biltys/${record.id}`}>View bilty</Link>
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow={
          baseline
            ? `${baseline.number || 'DRAFT'} · VERSION ${baseline.version}`
            : 'NEW CONSIGNMENT'
        }
        title={baseline ? 'Edit bilty' : 'Create a bilty'}
        description={
          baseline?.status === 'issued'
            ? 'Update the complete document and record a reason for the audit history.'
            : 'Start with what you know. Complete the required details before issuing.'
        }
        actions={
          <Link className="button" href={baseline ? `/biltys/${baseline.id}` : '/biltys'}>
            Back
          </Link>
        }
      />
      <form onSubmit={submit} className="form-stack">
        <ErrorNotice message={error} />
        {conflict && (
          <Section
            title="Review the latest version"
            description={`Another update changed this bilty to version ${conflict.latest.version}. Your unsaved changes are still here.`}
          >
            {conflict.latest.status === 'cancelled' ? (
              <Notice>
                This bilty has been cancelled and can no longer be edited.{' '}
                <Link href={`/biltys/${conflict.latest.id}`}>View the cancelled bilty</Link>
              </Notice>
            ) : (
              <>
                <p>
                  Changes to different sections have been combined. Review any overlapping edits
                  below, then apply the reviewed data and save again.
                </p>
                {conflict.keys.map((key) => (
                  <div className="conflict-field" key={key}>
                    <h3>{label(key)}</h3>
                    <div className="form-grid">
                      <div>
                        <small>Your change</small>
                        <pre>{JSON.stringify(data[key], null, 2)}</pre>
                      </div>
                      <div>
                        <small>Latest saved value</small>
                        <pre>{JSON.stringify(conflict.latest.data[key], null, 2)}</pre>
                      </div>
                    </div>
                    <Select
                      label={`Use values for ${label(key)}`}
                      value={conflict.choices[key] || ''}
                      onChange={(e) =>
                        setConflict({
                          ...conflict,
                          choices: {
                            ...conflict.choices,
                            [key]: e.target.value as 'mine' | 'latest',
                          },
                        })
                      }
                    >
                      <option value="">Choose which value to keep</option>
                      <option value="mine">Keep my change</option>
                      <option value="latest">Keep latest saved value</option>
                    </Select>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={conflict.keys.some((key) => !conflict.choices[key])}
                  onClick={() => {
                    const merged = structuredClone(conflict.merged);
                    for (const key of conflict.keys)
                      if (conflict.choices[key] === 'latest')
                        Object.assign(merged, {
                          [key]: structuredClone(conflict.latest.data[key]),
                        });
                    setData(merged);
                    setBaseline(conflict.latest);
                    setConflict(null);
                    setError('');
                  }}
                >
                  Apply reviewed changes
                </button>
              </>
            )}
          </Section>
        )}
        <fieldset disabled={busy || !!conflict} className="plain-fieldset">
          <Section
            title="Parties"
            description="Select a saved contact or enter the details for this consignment."
          >
            <ErrorNotice message={partyError} />
            <div className="party-grid">
              <PartyFields
                kind="consignor"
                value={data.consignor}
                onChange={(value) => update('consignor', value)}
                parties={parties}
              />
              <PartyFields
                kind="consignee"
                value={data.consignee}
                onChange={(value) => update('consignee', value)}
                parties={parties}
              />
            </div>
            {(moreParties || partyError) && (
              <button
                className="text-button"
                type="button"
                disabled={loadingParties}
                onClick={() => void loadParties(partyError ? 0 : parties.length)}
              >
                {loadingParties
                  ? 'Loading contacts…'
                  : partyError
                    ? 'Reload address book'
                    : 'Load more address book contacts'}
              </button>
            )}
          </Section>
          <Section
            title="Journey & vehicle"
            description="The route and people moving your consignment."
          >
            <div className="form-grid">
              <TextField
                label="From location"
                value={data.fromLocation}
                onChange={(e) => update('fromLocation', e.target.value)}
              />
              <TextField
                label="To location"
                value={data.toLocation}
                onChange={(e) => update('toLocation', e.target.value)}
              />
              <TextField
                label="Vehicle number"
                value={data.vehicleNumber}
                onChange={(e) => update('vehicleNumber', e.target.value)}
              />
              <Select
                label="Delivery mode"
                value={data.deliveryMode || ''}
                onChange={(e) =>
                  update('deliveryMode', (e.target.value as BiltyData['deliveryMode']) || null)
                }
              >
                <option value="">Not specified</option>
                <option value="door">Door delivery</option>
                <option value="godown">Godown delivery</option>
              </Select>
              <TextField
                label="Driver name"
                value={data.driverName}
                onChange={(e) => update('driverName', e.target.value)}
              />
              <TextField
                label="Driver phone"
                type="tel"
                value={data.driverPhone}
                onChange={(e) => update('driverPhone', e.target.value)}
              />
            </div>
          </Section>
          <Section
            title="Goods & measurements"
            description="Actual and chargeable weights are recorded independently."
          >
            <div className="form-grid">
              <div className="span-2">
                <TextArea
                  label="Goods description"
                  value={data.goodsDescription}
                  onChange={(e) => update('goodsDescription', e.target.value)}
                />
              </div>
              <WeightInput
                title="Actual weight"
                value={data.actualWeight}
                onChange={(value) => update('actualWeight', value)}
              />
              <WeightInput
                title="Chargeable weight"
                value={data.chargeableWeight}
                onChange={(value) => update('chargeableWeight', value)}
              />
              <TextField
                label="Volume (CBM)"
                inputMode="decimal"
                pattern="[0-9]{1,9}([.][0-9]{1,3})?"
                value={data.volumeCbm || ''}
                onChange={(e) => update('volumeCbm', e.target.value || null)}
              />
              <TextField
                label="Package count"
                type="number"
                min="1"
                step="1"
                value={data.packageCount ?? ''}
                onChange={(e) =>
                  update('packageCount', e.target.value ? Number(e.target.value) : null)
                }
              />
              <TextField
                label="Packing type"
                placeholder="e.g. Cartons, bags, pallets"
                value={data.packingType}
                onChange={(e) => update('packingType', e.target.value)}
              />
            </div>
          </Section>
          <Section
            title="Invoice references"
            description="Keep every invoice attached to this consignment. Up to 200 references."
            action={
              <button
                type="button"
                disabled={data.invoices.length >= 200}
                onClick={() =>
                  update('invoices', [
                    ...data.invoices,
                    { number: '', date: null, declaredValuePaise: null },
                  ])
                }
              >
                ＋ Add invoice
              </button>
            }
          >
            {!data.invoices.length && <p className="hint">No invoice references added.</p>}
            {data.invoices.map((invoice, index) => (
              <div className="reference-row" key={index}>
                <span className="reference-index">{String(index + 1).padStart(2, '0')}</span>
                <TextField
                  label={`Invoice ${index + 1} number`}
                  maxLength={100}
                  required
                  value={invoice.number}
                  onChange={(e) =>
                    update(
                      'invoices',
                      data.invoices.map((item, i) =>
                        i === index ? { ...item, number: e.target.value } : item,
                      ),
                    )
                  }
                />
                <TextField
                  label={`Invoice ${index + 1} date`}
                  type="date"
                  value={invoice.date || ''}
                  onChange={(e) =>
                    update(
                      'invoices',
                      data.invoices.map((item, i) =>
                        i === index ? { ...item, date: e.target.value || null } : item,
                      ),
                    )
                  }
                />
                <MoneyInput
                  label={`Invoice ${index + 1} declared value`}
                  value={invoice.declaredValuePaise}
                  onChange={(value) =>
                    update(
                      'invoices',
                      data.invoices.map((item, i) =>
                        i === index ? { ...item, declaredValuePaise: value } : item,
                      ),
                    )
                  }
                />
                <button
                  className="icon-button danger-text"
                  type="button"
                  aria-label={`Remove invoice ${index + 1}`}
                  onClick={() =>
                    update(
                      'invoices',
                      data.invoices.filter((_, i) => i !== index),
                    )
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </Section>
          <Section
            title="E-way bill references"
            description="Enter each 12-digit reference exactly, including leading zeroes."
            action={
              <button
                type="button"
                disabled={data.ewayBills.length >= 200}
                onClick={() => update('ewayBills', [...data.ewayBills, ''])}
              >
                ＋ Add e-way bill
              </button>
            }
          >
            {!data.ewayBills.length && <p className="hint">No e-way bill references added.</p>}
            <div className="form-grid">
              {data.ewayBills.map((value, index) => (
                <div className="inline-field" key={index}>
                  <TextField
                    label={`E-way bill ${index + 1}`}
                    required
                    inputMode="numeric"
                    pattern="[0-9]{12}"
                    maxLength={12}
                    minLength={12}
                    value={value}
                    onChange={(e) =>
                      update(
                        'ewayBills',
                        data.ewayBills.map((item, i) => (i === index ? e.target.value : item)),
                      )
                    }
                  />
                  <button
                    className="icon-button danger-text"
                    type="button"
                    aria-label={`Remove e-way bill ${index + 1}`}
                    onClick={() =>
                      update(
                        'ewayBills',
                        data.ewayBills.filter((_, i) => i !== index),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </Section>
          <Section
            title="Freight & charges"
            description="Enter amounts in rupees. The final total is calculated by the server."
          >
            <div className="form-grid">
              <Select
                label="Freight type"
                value={data.freightType || ''}
                onChange={(e) =>
                  update('freightType', (e.target.value as BiltyData['freightType']) || null)
                }
              >
                <option value="">Select freight type</option>
                <option value="paid">Paid</option>
                <option value="to-pay">To pay</option>
                <option value="billed">Billed</option>
              </Select>
              <Select
                label="GST payable by"
                value={data.gstPayableBy || ''}
                onChange={(e) =>
                  update('gstPayableBy', (e.target.value as BiltyData['gstPayableBy']) || null)
                }
              >
                <option value="">Not specified</option>
                <option value="consignor">Consignor</option>
                <option value="consignee">Consignee</option>
                <option value="agency">Agency</option>
              </Select>
              {(Object.keys(data.charges) as (keyof BiltyData['charges'])[]).map((key) => (
                <MoneyInput
                  key={key}
                  label={label(key)}
                  value={data.charges[key]}
                  nullable={key === 'freightPaise'}
                  onChange={(value) => update('charges', { ...data.charges, [key]: value })}
                />
              ))}
            </div>
            <div className="total-row">
              <span>
                Charge preview <small>GST declaration only; no tax added</small>
              </span>
              <strong>
                {money(
                  Object.values(data.charges).reduce<number>((sum, value) => sum + (value || 0), 0),
                )}
              </strong>
            </div>
          </Section>
          <Section
            title="Insurance"
            description="Record the insurance declaration for this consignment."
          >
            <div className="form-grid">
              <Select
                label="Insurance status"
                value={data.insurance.status}
                onChange={(e) =>
                  update('insurance', {
                    ...data.insurance,
                    status: e.target.value as BiltyData['insurance']['status'],
                  })
                }
              >
                <option value="unspecified">Not specified</option>
                <option value="not-insured">Not insured</option>
                <option value="insured">Insured</option>
              </Select>
              <TextField
                label="Insurance company"
                value={data.insurance.company}
                onChange={(e) =>
                  update('insurance', { ...data.insurance, company: e.target.value })
                }
              />
              <TextField
                label="Policy number"
                value={data.insurance.policyNumber}
                onChange={(e) =>
                  update('insurance', { ...data.insurance, policyNumber: e.target.value })
                }
              />
              <TextField
                label="Insurance date"
                type="date"
                value={data.insurance.date || ''}
                onChange={(e) =>
                  update('insurance', { ...data.insurance, date: e.target.value || null })
                }
              />
              <MoneyInput
                label="Insured amount"
                value={data.insurance.amountPaise}
                onChange={(amountPaise) => update('insurance', { ...data.insurance, amountPaise })}
              />
              <TextField
                label="Risk"
                value={data.insurance.risk}
                onChange={(e) => update('insurance', { ...data.insurance, risk: e.target.value })}
              />
            </div>
          </Section>
          <Section title="Additional notes">
            <TextArea
              label="Remarks"
              value={data.remarks}
              onChange={(e) => update('remarks', e.target.value)}
            />
            {baseline && (
              <TextArea
                label={
                  baseline.status === 'issued'
                    ? 'Reason for editing (required)'
                    : 'Reason for editing (optional)'
                }
                maxLength={2000}
                required={baseline.status === 'issued'}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                hint="Recorded in the bilty’s audit history."
              />
            )}
          </Section>
        </fieldset>
        <ErrorNotice message={error} />
        <div className="form-footer">
          <span>{dirty ? 'You have unsaved changes' : 'Ready when you are'}</span>
          <div className="actions">
            <Link href={baseline ? `/biltys/${baseline.id}` : '/biltys'} className="button">
              Cancel
            </Link>
            <button type="submit" disabled={busy || !!conflict} className="primary">
              {busy ? 'Saving…' : baseline ? 'Save changes' : 'Save draft'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
