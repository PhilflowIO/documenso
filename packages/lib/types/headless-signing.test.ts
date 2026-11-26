import { describe, expect, it } from 'vitest';

import {
  HEADLESS_SIGNER_USER_AGENT_MAX_LENGTH,
  HEADLESS_TYPED_SIGNATURE_MAX_LENGTH,
  ZHeadlessFieldValueSchema,
  ZHeadlessSignatureValueSchema,
  ZHeadlessSignerSchema,
} from './headless-signing';

const PNG_SIGNATURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('ZHeadlessSignerSchema', () => {
  it('accepts IPv4 and IPv6 addresses', () => {
    expect(ZHeadlessSignerSchema.safeParse({ ipAddress: '203.0.113.7', userAgent: 'Mozilla/5.0' }).success).toBe(true);
    expect(ZHeadlessSignerSchema.safeParse({ ipAddress: '2001:db8::1' }).success).toBe(true);
  });

  it('rejects anything that is not an IP address', () => {
    expect(ZHeadlessSignerSchema.safeParse({ ipAddress: 'localhost' }).success).toBe(false);
    expect(ZHeadlessSignerSchema.safeParse({ ipAddress: '203.0.113.7, 10.0.0.1' }).success).toBe(false);
    expect(ZHeadlessSignerSchema.safeParse({ ipAddress: '' }).success).toBe(false);
    expect(ZHeadlessSignerSchema.safeParse({}).success).toBe(false);
  });

  it('caps the user agent and refuses control characters', () => {
    const ok = 'a'.repeat(HEADLESS_SIGNER_USER_AGENT_MAX_LENGTH);

    expect(ZHeadlessSignerSchema.safeParse({ ipAddress: '203.0.113.7', userAgent: ok }).success).toBe(true);
    expect(ZHeadlessSignerSchema.safeParse({ ipAddress: '203.0.113.7', userAgent: `${ok}a` }).success).toBe(false);
    expect(ZHeadlessSignerSchema.safeParse({ ipAddress: '203.0.113.7', userAgent: 'evil\nInjected: 1' }).success).toBe(
      false,
    );
  });

  it('refuses unknown keys so a typo never silently drops the signer', () => {
    expect(ZHeadlessSignerSchema.safeParse({ ipAddress: '203.0.113.7', ip: '203.0.113.8' }).success).toBe(false);
  });
});

describe('ZHeadlessSignatureValueSchema', () => {
  it('accepts a real PNG data URL and a short typed signature', () => {
    expect(ZHeadlessSignatureValueSchema.safeParse(PNG_SIGNATURE).success).toBe(true);
    expect(ZHeadlessSignatureValueSchema.safeParse('Erika Muster').success).toBe(true);
  });

  it('rejects a PNG data URL whose payload is not a PNG', () => {
    expect(ZHeadlessSignatureValueSchema.safeParse('data:image/png;base64,bm90IGEgcG5n').success).toBe(false);
  });

  it('rejects empty, overlong and control-character typed signatures', () => {
    expect(ZHeadlessSignatureValueSchema.safeParse('').success).toBe(false);
    expect(ZHeadlessSignatureValueSchema.safeParse('a'.repeat(HEADLESS_TYPED_SIGNATURE_MAX_LENGTH + 1)).success).toBe(
      false,
    );
    expect(ZHeadlessSignatureValueSchema.safeParse('Erika\u0000').success).toBe(false);
  });
});

describe('ZHeadlessFieldValueSchema', () => {
  it('takes a date without a value, so the client cannot set the signing time', () => {
    expect(ZHeadlessFieldValueSchema.parse({ type: 'DATE', value: '2020-01-01' })).toEqual({ type: 'DATE' });
  });

  it('requires a value for a signature', () => {
    expect(ZHeadlessFieldValueSchema.safeParse({ type: 'SIGNATURE' }).success).toBe(false);
    expect(ZHeadlessFieldValueSchema.safeParse({ type: 'SIGNATURE', value: null }).success).toBe(false);
  });
});
