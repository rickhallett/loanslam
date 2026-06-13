import { beforeAll, describe, expect, it } from 'vitest';
import type { GroundingSignal, KbItem } from '@loanslam/contracts';
import { loadKnowledgeBase } from '../../config/kb.js';
import { createRetrievalAdapter } from '../index.js';
import { LexicalRetrievalAdapter } from '../lexical-retrieval.adapter.js';
import type { RetrievalAdapter } from '../../ports/retrieval.port.js';

const THRESHOLD = 0.42;

let kb: KbItem[];
let adapter: RetrievalAdapter;

beforeAll(() => {
  kb = loadKnowledgeBase();
  adapter = createRetrievalAdapter(kb, THRESHOLD);
});

/** Assert structural invariants every grounding signal must hold. */
function expectWellFormed(signal: GroundingSignal): void {
  expect(signal.topScore).toBeGreaterThanOrEqual(0);
  expect(signal.topScore).toBeLessThanOrEqual(1);
  for (const hit of signal.hits) {
    expect(hit.score).toBeGreaterThanOrEqual(0);
    expect(hit.score).toBeLessThanOrEqual(1);
  }
  // hits are sorted by descending score
  for (let i = 1; i < signal.hits.length; i += 1) {
    const prev = signal.hits[i - 1];
    const cur = signal.hits[i];
    if (prev !== undefined && cur !== undefined) {
      expect(prev.score).toBeGreaterThanOrEqual(cur.score);
    }
  }
}

describe('LexicalRetrievalAdapter against the real KB', () => {
  it('loads the full 60-item synthetic corpus', () => {
    expect(kb.length).toBe(60);
  });

  it('"How much can I borrow?" -> grounded, top serving_mode answer', async () => {
    const signal = await adapter.retrieve('How much can I borrow?');
    expectWellFormed(signal);
    expect(signal.topServingMode).toBe('answer');
    expect(signal.grounded).toBe(true);
    expect(signal.topScore).toBeGreaterThanOrEqual(THRESHOLD);
    expect(signal.hits[0]?.itemId).toBe('how-much-can-i-borrow');
  });

  it('"What\'s my balance?" -> handoff_account_specific, not grounded', async () => {
    const signal = await adapter.retrieve("What's my balance?");
    expectWellFormed(signal);
    expect(signal.topServingMode).toBe('handoff_account_specific');
    expect(signal.grounded).toBe(false);
  });

  it('"I can\'t pay this month" -> route_vulnerability', async () => {
    const signal = await adapter.retrieve("I can't pay this month");
    expectWellFormed(signal);
    expect(signal.topServingMode).toBe('route_vulnerability');
    expect(signal.grounded).toBe(false);
  });

  it('"What\'s your APR?" -> excluded, not grounded', async () => {
    const signal = await adapter.retrieve("What's your APR?");
    expectWellFormed(signal);
    expect(signal.topServingMode).toBe('excluded');
    expect(signal.grounded).toBe(false);
  });

  it('gibberish "asdkfj qwer" -> low topScore, not grounded, no serving mode', async () => {
    const signal = await adapter.retrieve('asdkfj qwer');
    expectWellFormed(signal);
    expect(signal.topScore).toBeLessThan(0.2);
    expect(signal.grounded).toBe(false);
    expect(signal.topServingMode).toBeNull();
  });

  it('respects topK and returns at most that many hits', async () => {
    const signal = await adapter.retrieve('How much can I borrow?', { topK: 2 });
    expect(signal.hits.length).toBeLessThanOrEqual(2);
  });

  it('defaults to 3 hits', async () => {
    const signal = await adapter.retrieve('How much can I borrow?');
    expect(signal.hits.length).toBeLessThanOrEqual(3);
  });

  it('every grounded answer hit carries answer_text (release rule)', async () => {
    const signal = await adapter.retrieve('How much can I borrow?');
    const top = signal.hits[0];
    expect(top).toBeDefined();
    if (signal.grounded && top !== undefined) {
      expect(top.answerText).not.toBeNull();
    }
  });

  it('the factory and class produce equivalent behaviour', async () => {
    const viaClass = new LexicalRetrievalAdapter(kb, THRESHOLD);
    const a = await viaClass.retrieve('How much can I borrow?');
    const b = await adapter.retrieve('How much can I borrow?');
    expect(a.grounded).toBe(b.grounded);
    expect(a.topScore).toBeCloseTo(b.topScore, 10);
    expect(a.topServingMode).toBe(b.topServingMode);
  });
});
