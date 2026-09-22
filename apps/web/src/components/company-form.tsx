'use client';
import { useState, type FormEvent } from 'react';
import type { CompanySnapshot } from '@bilty/shared-types';
import type { Company } from '@/lib/model';
import { errorMessage } from '@/lib/api';
import { ErrorNotice, Notice, Section, TextArea, TextField, useDirtyForm } from './ui';
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
