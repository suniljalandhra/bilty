import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { parseData } from '../modules/bilty/validation';
import { passwordSchema } from '../modules/auth/password';
export const draftBody = z.strictObject({ data: z.unknown() });
export const versionBody = z.strictObject({ expectedVersion: z.number().int().positive() });
export const cancelBody = versionBody.extend({ reason: z.string().trim().min(1).max(2000) });
export const editBody = versionBody.extend({
  data: z.unknown(),
  reason: z.string().trim().max(2000).default(''),
});
export const callbackQuery = z.strictObject({
  state: z.string(),
  code: z.string(),
  scope: z.string().optional(),
  authuser: z.string().optional(),
  prompt: z.string().optional(),
  hd: z.string().optional(),
  iss: z.string().optional(),
});
export function fullData(raw: unknown) {
  const parsed = parseData(raw);
  function requireKeys(input: unknown, expected: unknown, path: string) {
    if (expected === null || typeof expected !== 'object') return;
    if (!input || typeof input !== 'object')
      throw new BadRequestException(`Full document required: ${path}`);
    for (const key of Object.keys(expected)) {
      if (!Object.prototype.hasOwnProperty.call(input, key))
        throw new BadRequestException(`Full document required: ${path}.${key}`);
      requireKeys(
        (input as Record<string, unknown>)[key],
        (expected as Record<string, unknown>)[key],
        `${path}.${key}`,
      );
    }
  }
  requireKeys(raw, parsed, 'data');
  return parsed;
}

export const biltyQuery = z
  .strictObject({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(100000).default(0),
    q: z.string().trim().max(100).optional(),
    status: z.enum(['draft', 'issued', 'cancelled']).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, 'Invalid date range');

// Password auth schemas
export const emailSchema = z
  .string()
  .email()
  .transform((e) => e.toLowerCase().trim());

export const registerBody = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(200),
});

export const loginBody = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const tokenBody = z.strictObject({
  token: z.string().min(1).max(100),
});

export const emailBody = z.strictObject({
  email: emailSchema,
});

export const resetPasswordBody = z.strictObject({
  token: z.string().min(1).max(100),
  password: passwordSchema,
});

export const addPasswordBody = z.strictObject({
  password: passwordSchema,
});
