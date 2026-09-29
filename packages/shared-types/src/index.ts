export type BiltyStatus = 'draft' | 'issued' | 'cancelled';
export type UserRole = 'admin' | 'employee';
export interface Actor {
  userId: string;
  companyId: string;
}
export interface PartySnapshot {
  partyId: string | null;
  name: string;
  address: string;
  gstin: string;
  phone: string;
}
export interface Measurement {
  value: string;
  unit: 'kg' | 'quintal' | 'tonne';
}
export interface InvoiceReference {
  number: string;
  date: string | null;
  declaredValuePaise: number | null;
}
export interface Charges {
  freightPaise: number | null;
  loadingPaise: number;
  unloadingPaise: number;
  statisticalPaise: number;
  expressPaise: number;
  otherPaise: number;
}
export interface Insurance {
  status: 'unspecified' | 'not-insured' | 'insured';
  company: string;
  policyNumber: string;
  date: string | null;
  amountPaise: number | null;
  risk: string;
}
export interface BiltyData {
  consignor: PartySnapshot;
  consignee: PartySnapshot;
  fromLocation: string;
  toLocation: string;
  goodsDescription: string;
  actualWeight: Measurement | null;
  chargeableWeight: Measurement | null;
  volumeCbm: string | null;
  packageCount: number | null;
  packingType: string;
  deliveryMode: 'door' | 'godown' | null;
  freightType: 'paid' | 'to-pay' | 'billed' | null;
  charges: Charges;
  vehicleNumber: string;
  driverName: string;
  driverPhone: string;
  remarks: string;
  ewayBills: string[];
  invoices: InvoiceReference[];
  gstPayableBy: 'consignor' | 'consignee' | 'agency' | null;
  insurance: Insurance;
}
export const BILTY_LAYOUTS = [
  'classic-grid',
  'route-focus',
  'freight-ledger',
  'dispatch-sheet',
  'modern-panels',
] as const;
export type BiltyLayoutId = (typeof BILTY_LAYOUTS)[number];
export const DEFAULT_LAYOUT: BiltyLayoutId = 'classic-grid';
export const LAYOUT_META: { id: BiltyLayoutId; name: string; description: string }[] = [
  { id: 'classic-grid', name: 'Classic Grid', description: 'The original traditional bilty grid.' },
  {
    id: 'route-focus',
    name: 'Route Focus',
    description: 'Route first, with wide goods and party panels.',
  },
  {
    id: 'freight-ledger',
    name: 'Freight Ledger',
    description: 'Charges on the left, with ruled accounting panels.',
  },
  {
    id: 'dispatch-sheet',
    name: 'Dispatch Sheet',
    description: 'Vehicle and delivery details lead the document.',
  },
  {
    id: 'modern-panels',
    name: 'Modern Panels',
    description: 'Goods, references and charges side by side.',
  },
];
export interface CompanySnapshot {
  name: string;
  address: string;
  gstin: string;
  pan: string;
  phone: string;
  email: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  bankDetails: string;
  jurisdiction: string;
  carriageTerms: string;
  demurrageTerms: string;
  biltyLayout?: BiltyLayoutId;
}
export interface BiltyRecord {
  id: string;
  companyId: string;
  number: string | null;
  status: BiltyStatus;
  version: number;
  data: BiltyData;
  companySnapshot: CompanySnapshot | null;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  issuedAt: string | null;
  editedAt: string | null;
  cancelledAt: string | null;
}
export interface AuditEvent {
  companyId: string;
  biltyId: string;
  actorId: string;
  action: 'created' | 'edited' | 'issued' | 'cancelled';
  at: string;
  reason: string | null;
  before: BiltyRecord | null;
  after: BiltyRecord;
}
export interface Transition {
  bilty: BiltyRecord;
  event: AuditEvent | null;
}
