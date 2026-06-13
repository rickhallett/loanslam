import { describe, expect, it } from 'vitest';
import { accountHandoffForm, validateIntake } from '../services/intake.js';

describe('accountHandoffForm', () => {
  it('requests only standard handoff PII, never credentials', () => {
    const form = accountHandoffForm();
    const names = form.fields.map((f) => f.name);
    expect(names).toEqual(['full_name', 'date_of_birth', 'email', 'phone', 'address', 'context']);
    expect(form.submitLabel).toBe('Send to our team');
    const required = form.fields.filter((f) => f.required).map((f) => f.name);
    expect(required).toEqual(['full_name', 'date_of_birth', 'email']);
  });
});

describe('validateIntake', () => {
  const form = accountHandoffForm();

  it('accepts a valid submission', () => {
    const res = validateIntake(form, {
      full_name: 'Jane Doe',
      date_of_birth: '1990-01-02',
      email: 'jane@example.com',
      phone: '07000 000000',
    });
    expect(res.ok).toBe(true);
    expect(res.cleaned.full_name).toBe('Jane Doe');
    expect(res.cleaned.email).toBe('jane@example.com');
  });

  it('errors on missing required fields', () => {
    const res = validateIntake(form, { phone: '07000 000000' });
    expect(res.ok).toBe(false);
    expect(res.errors.full_name).toBeDefined();
    expect(res.errors.date_of_birth).toBeDefined();
    expect(res.errors.email).toBeDefined();
  });

  it('rejects an invalid email', () => {
    const res = validateIntake(form, {
      full_name: 'Jane',
      date_of_birth: '1990-01-02',
      email: 'not-an-email',
    });
    expect(res.ok).toBe(false);
    expect(res.errors.email).toBeDefined();
  });

  it('rejects an invalid date', () => {
    const res = validateIntake(form, {
      full_name: 'Jane',
      date_of_birth: '02/01/1990',
      email: 'jane@example.com',
    });
    expect(res.ok).toBe(false);
    expect(res.errors.date_of_birth).toBeDefined();
  });

  it('defensively rejects a sort code in a field', () => {
    const res = validateIntake(form, {
      full_name: 'Jane',
      date_of_birth: '1990-01-02',
      email: 'jane@example.com',
      context: 'my sort code is 12-34-56',
    });
    expect(res.ok).toBe(false);
    expect(res.errors.context).toBeDefined();
    expect(res.cleaned.context).toBeUndefined();
  });

  it('defensively rejects a card number in a field', () => {
    const res = validateIntake(form, {
      full_name: 'Jane',
      date_of_birth: '1990-01-02',
      email: 'jane@example.com',
      context: 'card 4111 1111 1111 1111',
    });
    expect(res.ok).toBe(false);
    expect(res.cleaned.context).toBeUndefined();
  });

  it('defensively rejects an 8-digit bank account number', () => {
    const res = validateIntake(form, {
      full_name: 'Jane',
      date_of_birth: '1990-01-02',
      email: 'jane@example.com',
      context: 'account 12345678',
    });
    expect(res.ok).toBe(false);
    expect(res.cleaned.context).toBeUndefined();
  });

  it('strips keys that are not valid IntakeFieldName', () => {
    const res = validateIntake(form, {
      full_name: 'Jane',
      date_of_birth: '1990-01-02',
      email: 'jane@example.com',
      // Unknown key: must never land in cleaned (only valid IntakeFieldName survive).
      sort_code: '12-34-56',
    });
    expect(Object.keys(res.cleaned)).not.toContain('sort_code');
  });
});
