import { describe, expect, it } from 'vitest';
import { isFaithful } from '../services/faithfulness.js';

describe('isFaithful', () => {
  const approved =
    'We base what you can borrow on your monthly income, up to twice your earnings. ' +
    'The minimum loan is £1,000 and the maximum is £5,000.';

  it('accepts a tone-only paraphrase that keeps the same facts', () => {
    expect(
      isFaithful(approved, 'You can borrow from £1,000 up to £5,000, based on your income.'),
    ).toBe(true);
  });

  it('tolerates word/numeral swaps on single digits ("twice" -> "2 times")', () => {
    expect(isFaithful(approved, 'You can borrow up to 2 times your monthly income.')).toBe(true);
  });

  it('rejects a fabricated currency amount', () => {
    expect(isFaithful(approved, 'You can borrow up to £20,000.')).toBe(false);
  });

  it('rejects a fabricated rate/percentage', () => {
    expect(isFaithful('We may be able to help.', 'Your APR will be 12.5%.')).toBe(false);
  });

  it('rejects a fabricated multi-digit figure', () => {
    expect(isFaithful('Funds arrive quickly after approval.', 'Funds arrive within 48 hours.')).toBe(
      false,
    );
  });

  it('rejects an injected link not present in the approved text', () => {
    expect(isFaithful('Contact our team for help.', 'Claim now at https://evil.example')).toBe(
      false,
    );
  });

  it('keeps an approved link', () => {
    const src = 'See https://loanslam.co.uk/open-banking/ for details.';
    expect(isFaithful(src, 'You can read more at https://loanslam.co.uk/open-banking/.')).toBe(true);
  });

  it('rejects an implausibly long rephrasing', () => {
    expect(isFaithful('Short approved answer.', 'x'.repeat(2000))).toBe(false);
  });
});
