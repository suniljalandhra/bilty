'use client';
import './bilty-layouts.css';
import { useState, type FormEvent } from 'react';
import { LAYOUT_META as LAYOUT_OPTIONS } from '@bilty/shared-types';
import type { BiltyLayoutId, CompanySnapshot } from '@bilty/shared-types';
import type { Company } from '@/lib/model';
import { errorMessage } from '@/lib/api';
import { ErrorNotice, Notice, Section, TextArea, TextField, useDirtyForm } from './ui';

function LayoutPreviewCard({
  layout,
  selected,
  primaryColor,
  accentColor,
  onSelect,
  disabled,
}: {
  layout: (typeof LAYOUT_OPTIONS)[number];
  selected: boolean;
  primaryColor: string;
  accentColor: string;
  onSelect: () => void;
  disabled: boolean;
}) {
  const primary = /^#[a-fA-F0-9]{6}$/.test(primaryColor) ? primaryColor : '#2d4f9e';
  const accent = /^#[a-fA-F0-9]{6}$/.test(accentColor) ? accentColor : '#1d7a4c';

  return (
    <button
      type="button"
      className={`layout-card ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
    >
      <div
        className="layout-preview"
        style={{ '--primary': primary, '--accent': accent } as React.CSSProperties}
      >
        {layout.id === 'classic-grid' && <ClassicGridPreview />}
        {layout.id !== 'classic-grid' && <PanelPreview layout={layout.id} />}
      </div>
      <div className="layout-info">
        <strong>{layout.name}</strong>
        <span>{layout.description}</span>
      </div>
    </button>
  );
}

function ClassicGridPreview() {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="2"
        y="2"
        width="116"
        height="76"
        rx="1"
        stroke="#ddd"
        strokeWidth="0.5"
        fill="#fff"
      />
      <rect x="4" y="4" width="112" height="2" fill="var(--primary)" />
      <rect x="4" y="7" width="112" height="0.5" fill="var(--accent)" />
      <rect x="4" y="10" width="30" height="8" fill="var(--primary)" opacity="0.2" />
      <rect x="4" y="20" width="50" height="15" stroke="#ccc" strokeWidth="0.3" />
      <rect x="56" y="20" width="30" height="15" stroke="#ccc" strokeWidth="0.3" />
      <rect x="88" y="20" width="28" height="15" stroke="#ccc" strokeWidth="0.3" />
      <rect x="4" y="37" width="70" height="25" stroke="#ccc" strokeWidth="0.3" />
      <rect x="76" y="37" width="40" height="25" stroke="#ccc" strokeWidth="0.3" />
      <rect x="4" y="64" width="112" height="12" stroke="#ccc" strokeWidth="0.3" />
    </svg>
  );
}

function PanelPreview({ layout }: { layout: Exclude<BiltyLayoutId, 'classic-grid'> }) {
  const rows = {
    'route-focus': [
      ['Route'],
      ['Consignor', 'Consignee'],
      ['Goods', 'Charges'],
      ['Dispatch', 'Insurance', 'References'],
      ['Company', 'Terms'],
    ],
    'freight-ledger': [
      ['Route', 'Dispatch'],
      ['Consignor', 'Consignee'],
      ['Charges', 'Goods'],
      ['References', 'Insurance'],
      ['Company', 'Terms'],
    ],
    'dispatch-sheet': [
      ['Dispatch', 'Route'],
      ['Consignor', 'Consignee'],
      ['Goods', 'Insurance'],
      ['References', 'Charges'],
      ['Company', 'Terms'],
    ],
    'modern-panels': [
      ['Route'],
      ['Consignor', 'Consignee'],
      ['Goods', 'References', 'Charges'],
      ['Dispatch', 'Insurance'],
      ['Company', 'Terms'],
    ],
  }[layout];
  return (
    <svg viewBox="0 0 180 127" aria-hidden="true">
      <rect x="1" y="1" width="178" height="125" fill="white" stroke="#ddd" />
      <rect x="7" y="7" width="166" height="2" fill="var(--primary)" />
      <rect x="7" y="12" width="9" height="9" fill="var(--accent)" opacity="0.3" />
      <text x="20" y="19" fontSize="5" fill="var(--primary)">
        COMPANY NAME
      </text>
      {rows.map((row, r) =>
        row.map((label, i) => {
          const w = 166 / row.length;
          return (
            <g key={label}>
              <rect
                x={7 + i * w}
                y={27 + r * 17}
                width={w - 3}
                height="14"
                fill="#f5f7fa"
                stroke="#cbd2db"
                strokeWidth="0.4"
              />
              <rect
                x={7 + i * w}
                y={27 + r * 17}
                width="1.5"
                height="14"
                fill={label === 'Charges' ? 'var(--primary)' : 'var(--accent)'}
              />
              <text x={11 + i * w} y={34 + r * 17} fontSize="4" fill="#334155">
                {label}
              </text>
              <path
                d={`M ${11 + i * w} ${37 + r * 17} h ${w - 15}`}
                stroke="#cbd2db"
                strokeWidth="0.6"
              />
            </g>
          );
        }),
      )}
      <path d="M 7 119 h 45 M 65 119 h 45 M 123 119 h 45" stroke="#aaa" strokeWidth="0.5" />
    </svg>
  );
}

export function CompanyForm({
  company,
  onSave,
  onboarding = false,
  readOnly = false,
}: {
  company: Company;
  onSave: (profile: CompanySnapshot, prefix: string) => Promise<void>;
  onboarding?: boolean;
  readOnly?: boolean;
}) {
  const [profile, setProfile] = useState(company.profile),
    [prefix, setPrefix] = useState(company.numberPrefix),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  const [baseline, setBaseline] = useState(JSON.stringify([company.profile, company.numberPrefix]));
  const dirty = JSON.stringify([profile, prefix]) !== baseline;
  useDirtyForm(!readOnly && dirty && !busy);
  const update = (key: keyof CompanySnapshot, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await onSave(profile, prefix);
      setBaseline(JSON.stringify([profile, prefix]));
      setSaved(true);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-stack">
      <ErrorNotice message={error} />
      {saved && !onboarding && (
        <Notice>
          Company settings saved. Issued biltys retain their original company details.
        </Notice>
      )}
      {readOnly && <Notice>Your administrator can update these settings.</Notice>}
      <fieldset disabled={busy || readOnly} className="plain-fieldset">
        <Section
          title="Company profile"
          description="These details appear on your bilty documents."
        >
          <div className="form-grid">
            <TextField
              label="Company name"
              required
              value={profile.name}
              onChange={(e) => update('name', e.target.value)}
            />
            <TextField
              label="Company email"
              type="email"
              value={profile.email}
              onChange={(e) => update('email', e.target.value)}
            />
            <TextField
              label="Phone number"
              type="tel"
              value={profile.phone}
              onChange={(e) => update('phone', e.target.value)}
            />
            <TextField
              label="GSTIN"
              value={profile.gstin}
              onChange={(e) => update('gstin', e.target.value)}
            />
            <TextField
              label="PAN"
              value={profile.pan}
              onChange={(e) => update('pan', e.target.value)}
            />
            <TextField
              label="Jurisdiction"
              value={profile.jurisdiction}
              onChange={(e) => update('jurisdiction', e.target.value)}
            />
            <div className="span-2">
              <TextArea
                label="Company address"
                maxLength={2000}
                value={profile.address}
                onChange={(e) => update('address', e.target.value)}
              />
            </div>
          </div>
        </Section>
        <Section
          title="Bilty numbering"
          description="A permanent number is assigned when a draft is issued."
        >
          <div className="form-grid">
            <TextField
              label="Number prefix"
              required
              maxLength={40}
              pattern={String.raw`[A-Za-z0-9\/._\-]+`}
              hint="Letters, numbers, slash, dot, underscore or hyphen."
              value={prefix}
              onChange={(e) => {
                setPrefix(e.target.value);
                setSaved(false);
              }}
            />
            <div className="number-preview">
              <span>Next number</span>
              <strong>
                {prefix}
                {(company.nextNumber || '1').padStart(4, '0')}
              </strong>
              <small>Existing document numbers stay the same.</small>
            </div>
          </div>
        </Section>
        <Section title="Document appearance" description="Add your logo and company colours.">
          <div className="logo-settings">
            {profile.logoUrl ? (
              <img className="logo-preview" src={profile.logoUrl} alt="Company logo preview" />
            ) : (
              <div className="logo-placeholder">LOGO</div>
            )}
            <div>
              <label className="field">
                <span className="field-label">Upload company logo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (
                      !['image/png', 'image/jpeg'].includes(file.type) ||
                      file.size > 120 * 1024
                    ) {
                      setError('Choose a PNG or JPEG logo up to 120 KB.');
                      e.target.value = '';
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      update('logoUrl', String(reader.result));
                      setError('');
                    };
                    reader.onerror = () => setError('The logo file could not be read.');
                    reader.readAsDataURL(file);
                  }}
                />
                <span className="hint">
                  PNG or JPEG, up to 120 KB. Uploaded logos are included in PDFs.
                </span>
              </label>
              {profile.logoUrl && (
                <button type="button" className="text-button" onClick={() => update('logoUrl', '')}>
                  Remove logo
                </button>
              )}
            </div>
          </div>
          <div className="form-grid">
            <TextField
              label="Primary colour"
              type="color"
              value={profile.primaryColor}
              onChange={(e) => update('primaryColor', e.target.value)}
            />
            <TextField
              label="Accent colour"
              type="color"
              value={profile.accentColor}
              onChange={(e) => update('accentColor', e.target.value)}
            />
          </div>
        </Section>
        <Section
          title="Bilty layout"
          description="Choose your A4 landscape layout. Previews show the arrangement. This choice is frozen when a bilty is issued."
        >
          <div className="layout-grid">
            {LAYOUT_OPTIONS.map((layout) => (
              <LayoutPreviewCard
                key={layout.id}
                layout={layout}
                selected={(profile.biltyLayout ?? 'classic-grid') === layout.id}
                primaryColor={profile.primaryColor}
                accentColor={profile.accentColor}
                onSelect={() => {
                  setProfile((current) => ({ ...current, biltyLayout: layout.id }));
                  setSaved(false);
                }}
                disabled={busy || readOnly}
              />
            ))}
          </div>
        </Section>
        <Section
          title="Terms & payment details"
          description="These details are frozen on each bilty when it is issued."
        >
          <div className="form-grid">
            <div className="span-2">
              <TextArea
                label="Bank details"
                maxLength={2000}
                value={profile.bankDetails}
                onChange={(e) => update('bankDetails', e.target.value)}
              />
            </div>
            <TextArea
              label="Carriage terms"
              value={profile.carriageTerms}
              onChange={(e) => update('carriageTerms', e.target.value)}
            />
            <TextArea
              label="Demurrage terms"
              value={profile.demurrageTerms}
              onChange={(e) => update('demurrageTerms', e.target.value)}
            />
          </div>
        </Section>
      </fieldset>
      {!readOnly && (
        <div className="form-footer">
          <span>
            {dirty
              ? 'You have unsaved changes'
              : onboarding
                ? 'You will be the first company administrator'
                : 'All changes saved'}
          </span>
          <button className="primary" disabled={busy || (!onboarding && !dirty)} type="submit">
            {busy ? 'Saving…' : onboarding ? 'Create company & continue' : 'Save settings'}
          </button>
        </div>
      )}
    </form>
  );
}
