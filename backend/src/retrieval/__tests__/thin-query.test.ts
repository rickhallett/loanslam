import { describe, expect, it } from 'vitest';
import { knowledgeBase } from '../../config/kb.js';
import { createRetrievalAdapter } from '../index.js';

const THRESHOLD = 0.42;
const kb = knowledgeBase();
const retrieval = createRetrievalAdapter(kb, THRESHOLD);

describe('thin-query mis-grounding guard (review finding #7)', () => {
  it('a single common word does not produce a perfect (1.0) match', async () => {
    for (const word of ['loan', 'payment', 'help', 'account']) {
      const g = await retrieval.retrieve(word);
      expect(g.topScore, word).toBeLessThan(1.0);
    }
  });

  it('a vague single payment/help word routes safely, not to a confident answer', async () => {
    const payment = await retrieval.retrieve('payment');
    expect(payment.grounded).toBe(false);
    const help = await retrieval.retrieve('help');
    expect(help.grounded).toBe(false);
  });

  it('a real, near-verbatim question still grounds strongly', async () => {
    const g = await retrieval.retrieve('How much can I borrow?');
    expect(g.grounded).toBe(true);
    expect(g.topServingMode).toBe('answer');
    expect(g.topScore).toBeGreaterThan(0.9);
  });
});
