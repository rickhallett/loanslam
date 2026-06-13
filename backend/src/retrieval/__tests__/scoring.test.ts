import { describe, expect, it } from 'vitest';
import type { KbItem } from '@loanslam/contracts';
import { scoreItem, tokenize } from '../scoring.js';

const borrowItem: KbItem = {
  id: 'how-much-can-i-borrow',
  section: 'application_questions',
  intent: 'borrowing-limits',
  question: 'How much can I borrow?',
  question_variants: [
    "What's the most I can get?",
    "What's the minimum loan?",
    'How big a loan can I take out?',
    'What are your loan amounts?',
  ],
  serving_mode: 'answer',
  answer_text: 'We base what you can borrow on your monthly income...',
  links: [],
  route_reason: null,
  tags: ['borrowing', 'limits', 'affordability'],
};

describe('tokenize', () => {
  it('lowercases, strips punctuation, and drops stopwords', () => {
    expect(tokenize('How much can I borrow?')).toEqual(['much', 'can', 'borrow']);
  });

  it('keeps apostrophe words as single tokens', () => {
    // "what's" -> "whats" (then dropped if a stopword? it is not), "can't" -> "cant"
    expect(tokenize("What's my balance?")).toEqual(['whats', 'balance']);
    expect(tokenize("I can't pay this month")).toEqual(['cant', 'pay', 'month']);
  });

  it('returns no tokens for punctuation-only / empty input', () => {
    expect(tokenize('   ?!.,  ')).toEqual([]);
    expect(tokenize('')).toEqual([]);
  });
});

describe('scoreItem', () => {
  it('scores a verbatim question highly (>= 0.6)', () => {
    const score = scoreItem(tokenize('How much can I borrow?'), borrowItem);
    expect(score).toBeGreaterThanOrEqual(0.6);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('scores a near-verbatim variant highly (>= 0.6)', () => {
    const score = scoreItem(tokenize('How big a loan can I take out?'), borrowItem);
    expect(score).toBeGreaterThanOrEqual(0.6);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('scores an unrelated query low (< 0.2)', () => {
    const score = scoreItem(tokenize('What time do you close on Sundays?'), borrowItem);
    expect(score).toBeLessThan(0.2);
  });

  it('scores gibberish at zero', () => {
    expect(scoreItem(tokenize('asdkfj qwer'), borrowItem)).toBe(0);
  });

  it('returns 0 for an empty query', () => {
    expect(scoreItem([], borrowItem)).toBe(0);
  });

  it('keeps every score within [0, 1]', () => {
    const queries = [
      'How much can I borrow?',
      'loan amounts borrowing limits',
      'asdkfj qwer',
      '',
    ];
    for (const q of queries) {
      const score = scoreItem(tokenize(q), borrowItem);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});
