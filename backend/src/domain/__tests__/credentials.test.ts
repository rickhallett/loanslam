import { describe, expect, it } from 'vitest';
import { looksLikeCredential } from '../credentials.js';

describe('looksLikeCredential (brief §16: never store bank/payment credentials)', () => {
  it('flags card numbers in the forms people actually type', () => {
    expect(looksLikeCredential('4111 1111 1111 1111')).toBe(true);
    expect(looksLikeCredential('4111111111111111')).toBe(true);
    expect(looksLikeCredential('4111-1111-1111-1111')).toBe(true);
  });

  it('flags sort codes written with separators', () => {
    expect(looksLikeCredential('20-00-00')).toBe(true);
    expect(looksLikeCredential('20 00 00')).toBe(true);
    expect(looksLikeCredential('20.00.00')).toBe(true);
  });

  it('flags account numbers run-together and grouped', () => {
    expect(looksLikeCredential('12345678')).toBe(true);
    expect(looksLikeCredential('1234 5678')).toBe(true);
  });

  it('does NOT false-positive on a YYYY-MM-DD date of birth', () => {
    expect(looksLikeCredential('1990-01-02')).toBe(false);
  });

  it('does NOT false-positive on an 11-digit UK phone number', () => {
    expect(looksLikeCredential('07123456789')).toBe(false);
  });

  it('does NOT flag ordinary contact details', () => {
    expect(looksLikeCredential('jane@example.com')).toBe(false);
    expect(looksLikeCredential('Jane Smith')).toBe(false);
    expect(looksLikeCredential('12 Oak Street')).toBe(false);
  });
});
