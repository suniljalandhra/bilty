import { z } from 'zod';
import type { BiltyData, CompanySnapshot } from '@bilty/shared-types';
import { BiltyError } from './errors';
import { MAX_PAISE, totalPaise } from './money';
const text = z.string().trim().max(2000).default('');
const longText = z.string().trim().max(10000).default('');
const money = z.number().int().min(0).max(MAX_PAISE);
const date = z.iso.date().nullable().default(null);
const decimal = z
  .string()
  .trim()
  .regex(/^\d{1,9}(\.\d{1,3})?$/)
  .refine((v) => Number(v) > 0, 'Must be positive');
const party = z.strictObject({
  partyId: z.uuid().nullable().default(null),
  name: text,
  address: text,
  gstin: text,
  phone: text,
});
const measurement = z.strictObject({ value: decimal, unit: z.enum(['kg', 'quintal', 'tonne']) });
const charges = z.strictObject({
  freightPaise: money.nullable().default(null),
  loadingPaise: money.default(0),
  unloadingPaise: money.default(0),
  statisticalPaise: money.default(0),
  expressPaise: money.default(0),
  otherPaise: money.default(0),
});
const insurance = z.strictObject({
  status: z.enum(['unspecified', 'not-insured', 'insured']).default('unspecified'),
  company: text,
  policyNumber: text,
  date,
  amountPaise: money.nullable().default(null),
  risk: text,
});
const schema = z.strictObject({
  consignor: party.prefault({}),
  consignee: party.prefault({}),
  fromLocation: text,
  toLocation: text,
  goodsDescription: longText,
  actualWeight: measurement.nullable().default(null),
  chargeableWeight: measurement.nullable().default(null),
  volumeCbm: decimal.nullable().default(null),
  packageCount: z.number().int().positive().max(1_000_000_000).nullable().default(null),
  packingType: text,
  deliveryMode: z.enum(['door', 'godown']).nullable().default(null),
  freightType: z.enum(['paid', 'to-pay', 'billed']).nullable().default(null),
  charges: charges.prefault({}),
  vehicleNumber: text,
  driverName: text,
  driverPhone: text,
  remarks: longText,
  ewayBills: z
    .array(
      z
        .string()
        .trim()
        .regex(/^\d{12}$/),
    )
    .max(200)
    .default([]),
  invoices: z
    .array(
      z.strictObject({
        number: z.string().trim().min(1).max(100),
        date,
        declaredValuePaise: money.nullable().default(null),
      }),
    )
    .max(200)
    .default([]),
  gstPayableBy: z.enum(['consignor', 'consignee', 'agency']).nullable().default(null),
  insurance: insurance.prefault({}),
});
export function parseData(raw: unknown): BiltyData {
  const result = schema.safeParse(raw);
  if (!result.success)
    throw new BiltyError(
      'VALIDATION',
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    );
  const data = result.data;
  if (new Set(data.ewayBills).size !== data.ewayBills.length)
    throw new BiltyError('VALIDATION', 'ewayBills: duplicate number');
  if (new Set(data.invoices.map((i) => i.number.toUpperCase())).size !== data.invoices.length)
    throw new BiltyError('VALIDATION', 'invoices: duplicate number');
  totalPaise(data.charges);
  return data;
}
export function validateIssue(data: BiltyData): void {
  const missing: string[] = [];
  if (!data.consignor.name) missing.push('consignor.name');
  if (!data.consignee.name) missing.push('consignee.name');
  for (const key of ['fromLocation', 'toLocation', 'goodsDescription', 'vehicleNumber'] as const)
    if (!data[key]) missing.push(key);
  if (!data.actualWeight) missing.push('actualWeight');
  if (!data.freightType) missing.push('freightType');
  if (data.charges.freightPaise === null) missing.push('charges.freightPaise');
  if (data.insurance.status === 'insured') {
    if (!data.insurance.company) missing.push('insurance.company');
    if (!data.insurance.policyNumber) missing.push('insurance.policyNumber');
  }
  if (missing.length)
    throw new BiltyError('VALIDATION', 'Required before issue: ' + missing.join(', '));
}
const companySchema = z.strictObject({
  name: z.string().trim().min(1).max(2000),
  address: text,
  gstin: text,
  pan: text,
  phone: text,
  email: text,
  logoUrl: text,
  primaryColor: text,
  accentColor: text,
  bankDetails: text,
  jurisdiction: text,
  carriageTerms: longText,
  demurrageTerms: longText,
});
export function parseCompany(raw: unknown): CompanySnapshot {
  const parsed = companySchema.safeParse(raw);
  if (!parsed.success)
    throw new BiltyError('VALIDATION', 'Invalid company print profile: ' + parsed.error.message);
  return parsed.data;
}
