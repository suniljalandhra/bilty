import type {
  BiltyData,
  BiltyRecord,
  CompanySnapshot,
  PartySnapshot,
  UserRole,
} from '@bilty/shared-types';

export interface Session {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  companyId: string | null;
  role: UserRole | null;
  onboardingRequired: boolean;
}
export interface Company {
  id: string;
  profile: CompanySnapshot;
  numberPrefix: string;
  nextNumber?: string;
}
export interface Party extends Omit<PartySnapshot, 'partyId'> {
  id: string;
  kind: 'consignor' | 'consignee';
  archivedAt: string | null;
}
export interface Member {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  joinedAt: string;
  revokedAt: string | null;
}
export interface Invite {
  id: string;
  email: string;
  role: UserRole;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}
export interface Share {
  id: string;
  expiresAt: string;
  version: number;
  format: 'a4' | 'thermal';
  copy: string;
  revokedAt: string | null;
  createdAt: string;
  url?: string;
}
export interface PrintRecord extends BiltyRecord {
  totalPaise: number;
  amountInWords: string;
  watermarks: string[];
}
export const blankParty = (): PartySnapshot => ({
  partyId: null,
  name: '',
  address: '',
  gstin: '',
  phone: '',
});
export function blankBilty(): BiltyData {
  return {
    consignor: blankParty(),
    consignee: blankParty(),
    fromLocation: '',
    toLocation: '',
    goodsDescription: '',
    actualWeight: null,
    chargeableWeight: null,
    volumeCbm: null,
    packageCount: null,
    packingType: '',
    deliveryMode: null,
    freightType: null,
    charges: {
      freightPaise: null,
      loadingPaise: 0,
      unloadingPaise: 0,
      statisticalPaise: 0,
      expressPaise: 0,
      otherPaise: 0,
    },
    vehicleNumber: '',
    driverName: '',
    driverPhone: '',
    remarks: '',
    ewayBills: [],
    invoices: [],
    gstPayableBy: null,
    insurance: {
      status: 'unspecified',
      company: '',
      policyNumber: '',
      date: null,
      amountPaise: null,
      risk: '',
    },
  };
}
export function blankCompany(): CompanySnapshot {
  return {
    name: '',
    address: '',
    gstin: '',
    pan: '',
    phone: '',
    email: '',
    logoUrl: '',
    primaryColor: '#2d4f9e',
    accentColor: '#1d7a4c',
    bankDetails: '',
    jurisdiction: '',
    carriageTerms: '',
    demurrageTerms: '',
  };
}
export function parseRupees(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new Error('Enter a rupee amount with up to two decimal places.');
  const [whole, fraction = ''] = text.split('.');
  const value = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (value > 99999999999n) throw new Error('The rupee amount cannot exceed 999,999,999.99.');
  return Number(value);
}
export function paiseInput(value: number | null): string {
  return value === null ? '' : `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;
}
export function money(value: number | null | undefined) {
  return value == null
    ? '—'
    : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value / 100);
}
export function dateTime(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    : '—';
}
export function dateOnly(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(
        new Date(value.length === 10 ? `${value}T12:00:00` : value),
      )
    : '—';
}
export function label(value: string) {
  return value
    .replace(/Paise$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/-/g, ' ')
    .replace(/^./, (s) => s.toUpperCase());
}
export function reconcileData(
  original: BiltyData,
  mine: BiltyData,
  latest: BiltyData,
): { data: BiltyData; conflicts: (keyof BiltyData)[] } {
  const data = structuredClone(latest),
    conflicts: (keyof BiltyData)[] = [];
  for (const key of Object.keys(original) as (keyof BiltyData)[]) {
    const localChange = JSON.stringify(mine[key]) !== JSON.stringify(original[key]);
    const remoteChange = JSON.stringify(latest[key]) !== JSON.stringify(original[key]);
    if (!localChange) continue;
    if (remoteChange && JSON.stringify(mine[key]) !== JSON.stringify(latest[key]))
      conflicts.push(key);
    Object.assign(data, { [key]: structuredClone(mine[key]) });
  }
  return { data, conflicts };
}
