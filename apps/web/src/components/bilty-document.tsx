'use client';
import type { BiltyRecord, PartySnapshot } from '@bilty/shared-types';
import type { PrintRecord } from '@/lib/model';
import { dateOnly, label, money } from '@/lib/model';
import { Badge } from './ui';
function Detail({ name, value }: { name: string; value: React.ReactNode }) {
  return (
    <div>
      <dt>{name}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}
function PartyBlock({ title, party }: { title: string; party: PartySnapshot }) {
  return (
    <section className="document-party">
      <div className="document-label">{title}</div>
      <h3>{party.name || 'Not entered'}</h3>
      <p className="preserve-lines">{party.address || 'Address not entered'}</p>
      <dl>
        <Detail name="GSTIN" value={party.gstin} />
        <Detail name="Phone" value={party.phone} />
      </dl>
    </section>
  );
}
export function BiltyDocument({ record }: { record: BiltyRecord | PrintRecord }) {
  const { data, companySnapshot: company } = record;
  return (
    <article className="document-sheet">
      <div className="document-header">
        <div>
          {company?.logoUrl && (
            <img src={company.logoUrl} className="document-logo" alt={`${company.name} logo`} />
          )}
          <h2>{company?.name || 'Consignment note'}</h2>
          {company && (
            <>
              <p className="preserve-lines">{company.address}</p>
              <p>{[company.phone, company.email].filter(Boolean).join(' · ')}</p>
              <p>
                {company.gstin && `GSTIN ${company.gstin}`}
                {company.pan && ` · PAN ${company.pan}`}
              </p>
            </>
          )}
        </div>
        <div className="document-identity">
          <div className="document-label">BILTY / CONSIGNMENT NOTE</div>
          <strong className="mono">{record.number || 'DRAFT'}</strong>
          <span>{dateOnly(record.issuedAt || record.createdAt)}</span>
          <div>
            <Badge status={record.status} />
            {record.isEdited && <span className="edited-mark">Edited · v{record.version}</span>}
          </div>
        </div>
      </div>
      {record.status !== 'issued' && (
        <div className={`document-watermark ${record.status}`}>
          {record.status === 'draft' ? 'DRAFT — NOT VALID FOR TRANSPORT' : 'CANCELLED'}
        </div>
      )}
      <div className="document-route">
        <div>
          <span>FROM</span>
          <strong>{data.fromLocation || 'Not entered'}</strong>
        </div>
        <span aria-hidden>⟶</span>
        <div>
          <span>TO</span>
          <strong>{data.toLocation || 'Not entered'}</strong>
        </div>
      </div>
      <div className="document-parties">
        <PartyBlock title="CONSIGNOR / SENDER" party={data.consignor} />
        <PartyBlock title="CONSIGNEE / RECEIVER" party={data.consignee} />
      </div>
      <section className="document-section">
        <h3>Consignment details</h3>
        <p className="goods-description preserve-lines">
          {data.goodsDescription || 'No goods description entered.'}
        </p>
        <dl className="detail-grid">
          <Detail
            name="Actual weight"
            value={data.actualWeight && `${data.actualWeight.value} ${data.actualWeight.unit}`}
          />
          <Detail
            name="Chargeable weight"
            value={
              data.chargeableWeight &&
              `${data.chargeableWeight.value} ${data.chargeableWeight.unit}`
            }
          />
          <Detail name="Volume" value={data.volumeCbm && `${data.volumeCbm} CBM`} />
          <Detail name="Packages" value={data.packageCount} />
          <Detail name="Packing" value={data.packingType} />
          <Detail name="Delivery" value={data.deliveryMode && label(data.deliveryMode)} />
          <Detail name="Vehicle" value={data.vehicleNumber} />
          <Detail name="Driver" value={data.driverName} />
          <Detail name="Driver phone" value={data.driverPhone} />
        </dl>
      </section>
      <section className="document-section">
        <h3>Invoice & e-way references</h3>
        {data.invoices.length ? (
          <div className="table-scroll">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>Invoice number</th>
                  <th>Date</th>
                  <th className="align-right">Declared value</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((invoice, index) => (
                  <tr key={index}>
                    <td className="mono">{invoice.number}</td>
                    <td>{dateOnly(invoice.date)}</td>
                    <td className="align-right mono">{money(invoice.declaredValuePaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">No invoice references.</p>
        )}
        <div className="eway-list">
          <span className="document-label">E-WAY BILLS</span>
          {data.ewayBills.length ? (
            data.ewayBills.map((value, index) => (
              <span className="reference-chip mono" key={index}>
                {value}
              </span>
            ))
          ) : (
            <span className="hint">None recorded</span>
          )}
        </div>
      </section>
      <div className="document-bottom">
        <section className="document-section">
          <h3>Insurance & declarations</h3>
          <dl className="detail-grid">
            <Detail name="Insurance" value={label(data.insurance.status)} />
            <Detail name="Insurance company" value={data.insurance.company} />
            <Detail name="Policy number" value={data.insurance.policyNumber} />
            <Detail name="Insurance date" value={dateOnly(data.insurance.date)} />
            <Detail name="Insured amount" value={money(data.insurance.amountPaise)} />
            <Detail name="Risk" value={data.insurance.risk} />
            <Detail name="Freight type" value={data.freightType && label(data.freightType)} />
            <Detail name="GST payable by" value={data.gstPayableBy && label(data.gstPayableBy)} />
          </dl>
          <h3 className="notes-title">Remarks</h3>
          <p className="preserve-lines">{data.remarks || 'No additional remarks.'}</p>
        </section>
        <section className="document-section charge-section">
          <h3>Freight & charges</h3>
          <dl className="charge-list">
            {Object.entries(data.charges).map(([key, value]) => (
              <Detail key={key} name={label(key)} value={money(value)} />
            ))}
          </dl>
          {'totalPaise' in record && (
            <>
              <div className="document-total">
                <span>Total</span>
                <strong>{money(record.totalPaise)}</strong>
              </div>
              <p className="amount-words">{record.amountInWords}</p>
            </>
          )}
        </section>
      </div>
      {company && (
        <section className="document-section document-terms">
          <h3>Company terms</h3>
          <dl>
            <Detail
              name="Bank details"
              value={<span className="preserve-lines">{company.bankDetails || '—'}</span>}
            />
            <Detail name="Jurisdiction" value={company.jurisdiction} />
            <Detail
              name="Carriage terms"
              value={<span className="preserve-lines">{company.carriageTerms || '—'}</span>}
            />
            <Detail
              name="Demurrage terms"
              value={<span className="preserve-lines">{company.demurrageTerms || '—'}</span>}
            />
          </dl>
        </section>
      )}
      <div className="signature-row">
        <span>Consignor signature</span>
        <span>Driver signature</span>
        <span>For {company?.name || 'the carrier'}</span>
      </div>
    </article>
  );
}
