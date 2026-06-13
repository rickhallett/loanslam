import { describe, expect, it } from 'vitest';
import { accountHandoffForm, validateIntake } from '../services/intake.js';

const form = accountHandoffForm();

/** A value is rejected if it errors the field or is dropped from `cleaned`. */
function rejected(value: string): boolean {
  const r = validateIntake(form, { context: value });
  return r.errors.context !== undefined || r.cleaned.context === undefined;
}

describe('credential filter (brief §16: never collect bank/payment credentials)', () => {
  it('blocks sort codes in every separated form people actually type', () => {
    for (const v of ['20-00-00', '20 00 00', '20.00.00', 'sort code 04 00 04']) {
      expect(rejected(v), v).toBe(true);
    }
  });

  it('blocks account numbers, run-together and grouped', () => {
    for (const v of ['12345678', '1234 5678', '1234-5678']) {
      expect(rejected(v), v).toBe(true);
    }
  });

  it('blocks card numbers', () => {
    for (const v of ['4111 1111 1111 1111', '4111111111111111']) {
      expect(rejected(v), v).toBe(true);
    }
  });

  it('does NOT reject legitimate handoff details', () => {
    // Phones, DOBs, names, emails, and ordinary prose must pass.
    expect(rejected('07700900000')).toBe(false);
    expect(rejected('I applied on 2026-06-01')).toBe(false);
    expect(rejected('Please call me back, thanks')).toBe(false);
  });

  it('strips a credential pasted into a free-text field while keeping valid fields', () => {
    const r = validateIntake(form, {
      full_name: 'A Customer',
      date_of_birth: '1990-01-01',
      email: 'a@example.com',
      context: 'my sort code is 20-00-00',
    });
    expect(r.cleaned.full_name).toBe('A Customer');
    expect(r.cleaned.context).toBeUndefined();
    expect(r.ok).toBe(false);
  });
});
