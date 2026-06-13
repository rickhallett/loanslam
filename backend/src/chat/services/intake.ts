import {
  intakeFieldNameSchema,
  type FormConfig,
  type IntakeField,
  type IntakeFieldName,
} from '@loanslam/contracts';
import { looksLikeCredential } from '../../domain/credentials.js';

/**
 * The account-handoff intake form. The widget renders exactly this config; the
 * backend owns the field set. Only standard handoff PII is requested — name,
 * DOB, address, phone, email, situational context. Bank/payment credentials are
 * never requested and are defensively stripped on submit (brief §16).
 */
export const ACCOUNT_HANDOFF_FORM_ID = 'account_handoff';

const ACCOUNT_HANDOFF_FIELDS: readonly IntakeField[] = [
  { name: 'full_name', label: 'Full name', type: 'text', required: true },
  { name: 'date_of_birth', label: 'Date of birth', type: 'date', required: true },
  { name: 'email', label: 'Email address', type: 'email', required: true },
  { name: 'phone', label: 'Phone number', type: 'tel', required: false },
  { name: 'address', label: 'Address', type: 'textarea', required: false },
  {
    name: 'context',
    label: 'Anything else that would help us',
    type: 'textarea',
    required: false,
  },
];

/** Build the account-handoff form config the customer is asked to complete. */
export function accountHandoffForm(): FormConfig {
  return {
    formId: ACCOUNT_HANDOFF_FORM_ID,
    title: 'Pass your details to our team',
    description:
      'Share a few contact details so the right person can get in touch. Please do not enter card, sort code, or account numbers — we never need those here.',
    fields: ACCOUNT_HANDOFF_FIELDS.map((f) => ({ ...f })),
    submitLabel: 'Send to our team',
  };
}

export interface IntakeValidationResult {
  ok: boolean;
  /** Per-field error messages, keyed by field name. */
  errors: Partial<Record<IntakeFieldName, string>>;
  /** Sanitised values, keyed by valid IntakeFieldName only. */
  cleaned: Partial<Record<IntakeFieldName, string>>;
}

// Basic email/date sanity (intentionally permissive — verification is a human job).
// Credential detection lives in domain/credentials.ts (shared with the extractor).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isIntakeFieldName(key: string): key is IntakeFieldName {
  return intakeFieldNameSchema.safeParse(key).success;
}

/**
 * Validate submitted intake values against the requested form. Required fields
 * must be present; email/date get a basic sanity check. Any value that looks
 * like a credential is rejected (the field errors and the value is dropped).
 * Only keys that are valid `IntakeFieldName` survive into `cleaned`.
 */
export function validateIntake(
  form: FormConfig,
  values: Record<string, string>,
): IntakeValidationResult {
  const errors: Partial<Record<IntakeFieldName, string>> = {};
  const cleaned: Partial<Record<IntakeFieldName, string>> = {};

  for (const field of form.fields) {
    const raw = values[field.name];
    const trimmed = typeof raw === 'string' ? raw.trim() : '';

    if (trimmed.length === 0) {
      if (field.required) errors[field.name] = `${field.label} is required.`;
      continue;
    }

    // Defensive: never store anything that looks like a bank/payment credential.
    if (looksLikeCredential(trimmed)) {
      errors[field.name] =
        'Please remove any card, sort code, or account numbers — we never need those here.';
      continue;
    }

    if (field.type === 'email' && !EMAIL_RE.test(trimmed)) {
      errors[field.name] = 'Please enter a valid email address.';
      continue;
    }

    if (field.type === 'date' && !DATE_RE.test(trimmed)) {
      errors[field.name] = 'Please enter a valid date (YYYY-MM-DD).';
      continue;
    }

    cleaned[field.name] = trimmed;
  }

  // Belt-and-braces: drop any submitted key that is not a known intake field,
  // and any surviving value that still trips the credential check.
  for (const [key, value] of Object.entries(values)) {
    if (!isIntakeFieldName(key)) continue;
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed.length === 0) continue;
    if (looksLikeCredential(trimmed)) {
      delete cleaned[key];
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, cleaned };
}
