import type { Charges } from '@bilty/shared-types';
import { BiltyError } from './errors';
export const MAX_PAISE = 99_999_999_999;
export function checkedPaise(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_PAISE)
    throw new BiltyError(
      'VALIDATION',
      'Money must be nonnegative integer paise within the supported limit',
    );
  return value;
}
export function totalPaise(charges: Charges): number {
  const total = Object.values(charges).reduce<number>(
    (sum, value) => sum + checkedPaise(value ?? 0),
    0,
  );
  if (total > MAX_PAISE)
    throw new BiltyError('VALIDATION', 'Charges total exceeds the supported limit');
  return total;
}
const small = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function words(n: number): string {
  if (n < 20) return small[n]!;
  if (n < 100) return tens[Math.floor(n / 10)]! + (n % 10 ? '-' + words(n % 10) : '');
  for (const [size, label] of [
    [10_000_000, 'crore'],
    [100_000, 'lakh'],
    [1_000, 'thousand'],
    [100, 'hundred'],
  ] as const) {
    if (n >= size)
      return words(Math.floor(n / size)) + ' ' + label + (n % size ? ' ' + words(n % size) : '');
  }
  throw new Error('Unsupported amount');
}
export function amountInWords(paise: number): string {
  checkedPaise(paise);
  const rupees = words(Math.floor(paise / 100));
  return (
    'Rupees ' +
    rupees[0]!.toUpperCase() +
    rupees.slice(1) +
    (paise % 100 ? ' and ' + words(paise % 100) + ' paise' : '') +
    ' only'
  );
}
