import { describe, expect, it } from 'vitest';
import { DeterministicModelAdapter, createDeterministicModelAdapter } from '../deterministic-model.adapter.js';
import type { AppConfig } from '../../config/env.js';
import type { ClassificationInput, VulnerabilityInput } from '../../ports/model.port.js';

const cfg = { groundingThreshold: 0.42 } as AppConfig;

const adapter = new DeterministicModelAdapter(cfg);

function vuln(text: string): VulnerabilityInput {
  return { text, history: [] };
}

function classifyInput(
  text: string,
  retrieval: Partial<ClassificationInput['retrieval']> = {},
): ClassificationInput {
  return {
    text,
    history: [],
    retrieval: {
      topServingMode: retrieval.topServingMode ?? null,
      topScore: retrieval.topScore ?? 0,
      topQuestion: retrieval.topQuestion ?? null,
    },
  };
}

describe('DeterministicModelAdapter.detectVulnerability', () => {
  it('flags "I can\'t pay my loan" as financial difficulty', async () => {
    const v = await adapter.detectVulnerability(vuln("I can't pay my loan this month"));
    expect(v.vulnerable).toBe(true);
    expect(v.category).toBe('financial_difficulty');
    expect(v.source).toBe('deterministic');
  });

  it('flags "struggling" and "behind" as financial difficulty', async () => {
    expect((await adapter.detectVulnerability(vuln('I am struggling to keep up'))).vulnerable).toBe(true);
    expect((await adapter.detectVulnerability(vuln("I've fallen behind on payments"))).vulnerable).toBe(true);
  });

  it('flags complaints and Ombudsman references', async () => {
    const v = await adapter.detectVulnerability(vuln('I want to raise a complaint to the ombudsman'));
    expect(v.vulnerable).toBe(true);
    expect(v.category).toBe('complaint');
  });

  it('flags legal threats', async () => {
    const v = await adapter.detectVulnerability(vuln('I will get a solicitor and take legal action'));
    expect(v.vulnerable).toBe(true);
    expect(v.category).toBe('legal');
  });

  it('flags accessibility needs', async () => {
    const v = await adapter.detectVulnerability(vuln('I am blind and need a screen reader'));
    expect(v.vulnerable).toBe(true);
    expect(v.category).toBe('accessibility');
  });

  it('does NOT flag a plain borrowing question', async () => {
    const v = await adapter.detectVulnerability(vuln('How much can I borrow?'));
    expect(v.vulnerable).toBe(false);
    expect(v.category).toBeNull();
    expect(v.source).toBe('deterministic');
  });

  it('searches recent history, not just the latest message', async () => {
    const v = await adapter.detectVulnerability({
      text: 'so what should I do',
      history: [{ role: 'user', content: "I can't afford the repayment", ts: '2026-06-13T00:00:00Z' }],
    });
    expect(v.vulnerable).toBe(true);
    expect(v.category).toBe('financial_difficulty');
  });
});

describe('DeterministicModelAdapter.classify maps serving modes', () => {
  it('answer + adequate score -> answer', async () => {
    const r = await adapter.classify(
      classifyInput('How much can I borrow?', { topServingMode: 'answer', topScore: 0.8, topQuestion: 'How much can I borrow?' }),
    );
    expect(r.action).toBe('answer');
    expect(r.customerGoal).toBe('How much can I borrow?');
    expect(r.source).toBe('deterministic');
  });

  it('answer + low score -> clarify', async () => {
    const r = await adapter.classify(
      classifyInput('borrow', { topServingMode: 'answer', topScore: 0.1 }),
    );
    expect(r.action).toBe('clarify');
  });

  it('handoff_account_specific + adequate score -> handoff_account_specific', async () => {
    const r = await adapter.classify(
      classifyInput("What's my balance?", { topServingMode: 'handoff_account_specific', topScore: 0.7 }),
    );
    expect(r.action).toBe('handoff_account_specific');
  });

  it('excluded + adequate score -> excluded_topic', async () => {
    const r = await adapter.classify(
      classifyInput("What's your APR?", { topServingMode: 'excluded', topScore: 0.7 }),
    );
    expect(r.action).toBe('excluded_topic');
  });

  it('route_vulnerability -> handoff_account_specific', async () => {
    const r = await adapter.classify(
      classifyInput('I am behind on things generally', { topServingMode: 'route_vulnerability', topScore: 0.7 }),
    );
    expect(r.action).toBe('handoff_account_specific');
  });

  it('nothing matched (null serving mode) -> fallback', async () => {
    const r = await adapter.classify(classifyInput('asdf', { topServingMode: null, topScore: 0 }));
    expect(r.action).toBe('fallback');
  });

  it('change-request keywords override retrieval -> change_request', async () => {
    const r = await adapter.classify(
      classifyInput('Please cancel my loan application', { topServingMode: 'answer', topScore: 0.9 }),
    );
    expect(r.action).toBe('change_request');
  });

  it('"close my account" overrides to change_request', async () => {
    const r = await adapter.classify(
      classifyInput('I want to close my account', { topServingMode: 'handoff_account_specific', topScore: 0.8 }),
    );
    expect(r.action).toBe('change_request');
  });

  it('falls back to first clause for customerGoal when no top question', async () => {
    const r = await adapter.classify(
      classifyInput('I need help with my budget. Thanks.', { topServingMode: 'answer', topScore: 0.5 }),
    );
    expect(r.customerGoal).toBe('I need help with my budget');
  });
});

describe('DeterministicModelAdapter.phraseAnswer is faithful', () => {
  it('returns the grounded answer text unchanged', async () => {
    const text = 'You can typically borrow between £1,000 and £25,000 depending on your circumstances.';
    const out = await adapter.phraseAnswer({ customerText: 'how much?', groundedAnswerText: text, history: [] });
    expect(out).toBe(text);
  });
});

describe('factory', () => {
  it('createDeterministicModelAdapter returns an adapter', () => {
    expect(createDeterministicModelAdapter(cfg)).toBeInstanceOf(DeterministicModelAdapter);
  });
});
