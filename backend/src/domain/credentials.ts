/**
 * Bank/payment credential detection (brief §16: the system must NEVER collect or
 * store a card number, sort code, or account number). This is the single source
 * of truth for that check, used both by the intake validator (defence on form
 * submit) and by the free-text slot extractor (defence on conversational input).
 *
 * The negative lookarounds keep these from false-positiving on dates
 * (1990-01-02) or matching an isolated run inside a longer digit sequence (an
 * 11-digit phone number). Sort codes are caught in every SEPARATED form people
 * actually type them — "20-00-00", "20 00 00", "20.00.00". A bare run-together
 * "200000" is deliberately NOT matched: indistinguishable from a phone fragment.
 * Account numbers are caught run-together (12345678) and grouped (1234 5678);
 * cards across 13-19 digits.
 */
export const CARD_NUMBER_RE = /(?<!\d)(?:\d[ .-]?){13,19}(?!\d)/;
export const SORT_CODE_RE = /(?<![\d.-])\d{2}[ .-]\d{2}[ .-]\d{2}(?![\d.-])/;
export const BANK_ACCOUNT_RE = /(?<!\d)\d{4}[ .-]?\d{4}(?!\d)/;

/** True if a value looks like a card number, sort code, or bank account number. */
export function looksLikeCredential(value: string): boolean {
  return CARD_NUMBER_RE.test(value) || SORT_CODE_RE.test(value) || BANK_ACCOUNT_RE.test(value);
}
