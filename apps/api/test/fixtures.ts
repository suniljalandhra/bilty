import type { Actor, CompanySnapshot } from '@bilty/shared-types';
export const companyId = '10000000-0000-4000-8000-000000000001';
export const otherCompanyId = '10000000-0000-4000-8000-000000000002';
export const actor: Actor = { companyId, userId: '20000000-0000-4000-8000-000000000001' };
export const otherActor: Actor = {
  companyId: otherCompanyId,
  userId: '20000000-0000-4000-8000-000000000002',
};
export const id = '30000000-0000-4000-8000-000000000001';
export const now = '2026-09-21T06:30:00.000Z';
export const later = '2026-09-21T07:30:00.000Z';
export const company: CompanySnapshot = {
  name: 'Example Transport',
  address: 'Delhi',
  gstin: '',
  pan: '',
  phone: '',
  email: '',
  logoUrl: '',
  primaryColor: '#234567',
  accentColor: '#abcdef',
  bankDetails: '',
  jurisdiction: '',
  carriageTerms: 'Example terms',
  demurrageTerms: '',
};
export function completeData() {
  return {
    consignor: { name: 'Sender', address: 'Noida' },
    consignee: { name: 'Receiver', address: 'Mumbai' },
    fromLocation: 'Noida',
    toLocation: 'Mumbai',
    goodsDescription: 'Medical equipment',
    actualWeight: { value: '313.200', unit: 'kg' },
    chargeableWeight: { value: '320', unit: 'kg' },
    volumeCbm: '1.08',
    packageCount: 21,
    freightType: 'billed',
    vehicleNumber: 'DL 01 AB 1234',
    charges: { freightPaise: 10000, loadingPaise: 5025 },
    ewayBills: ['441774284887', '431754769905', '461754771222'],
    invoices: [
      { number: 'INV-1', date: '2026-09-19', declaredValuePaise: 100000 },
      { number: 'INV-2' },
    ],
  };
}
