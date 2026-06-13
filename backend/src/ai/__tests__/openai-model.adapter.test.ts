import { describe, expect, it, vi } from 'vitest';
import { OpenAiModelAdapter, type ChatCompletionClient } from '../openai-model.adapter.js';
import { DeterministicModelAdapter } from '../deterministic-model.adapter.js';
import type { AppConfig } from '../../config/env.js';
import type { Logger } from '../../config/logger.js';
import type { ClassificationInput, PhraseInput, VulnerabilityInput } from '../../ports/model.port.js';

const cfg = { groundingThreshold: 0.42 } as AppConfig;

// Silent logger so test output stays clean. Cast through unknown: we only use warn.
const silentLogger = { warn: vi.fn(), info: vi.fn(), error: vi.fn() } as unknown as Logger;

/** A fake client whose create() always throws — simulates error/timeout. */
const throwingClient: ChatCompletionClient = {
  chat: {
    completions: {
      create: vi.fn(async () => {
        throw new Error('boom');
      }),
    },
  },
};

/** A fake client that returns a single completion with the given content. */
function clientReturning(content: string | null): ChatCompletionClient {
  return {
    chat: {
      completions: {
        create: vi.fn(async () => ({ choices: [{ message: { content } }] })),
      },
    },
  };
}

function adapterWith(client: ChatCompletionClient): OpenAiModelAdapter {
  return new OpenAiModelAdapter(client, 'fake-model', new DeterministicModelAdapter(cfg), silentLogger);
}

const vulnInput: VulnerabilityInput = { text: 'How much can I borrow?', history: [] };

const classifyInput: ClassificationInput = {
  text: 'How much can I borrow?',
  history: [],
  retrieval: { topServingMode: 'answer', topScore: 0.8, topQuestion: 'How much can I borrow?' },
};

const phraseInput: PhraseInput = {
  customerText: 'how much?',
  groundedAnswerText: 'You can borrow between £1,000 and £25,000.',
  history: [],
};

describe('OpenAiModelAdapter fail-closed semantics (client throws)', () => {
  it('detectVulnerability fails CLOSED: vulnerable=true, source=failclosed, confidence 0', async () => {
    const v = await adapterWith(throwingClient).detectVulnerability(vulnInput);
    expect(v.vulnerable).toBe(true);
    expect(v.source).toBe('failclosed');
    expect(v.category).toBe('uncertain');
    expect(v.confidence).toBe(0);
  });

  it('classify falls back to the deterministic result', async () => {
    const r = await adapterWith(throwingClient).classify(classifyInput);
    expect(r.source).toBe('deterministic');
    // Deterministic mapping of answer + adequate score.
    expect(r.action).toBe('answer');
  });

  it('change-request override survives via deterministic fallback', async () => {
    const r = await adapterWith(throwingClient).classify({
      ...classifyInput,
      text: 'cancel my application',
    });
    expect(r.source).toBe('deterministic');
    expect(r.action).toBe('change_request');
  });

  it('phraseAnswer returns null so the caller routes to fallback', async () => {
    const out = await adapterWith(throwingClient).phraseAnswer(phraseInput);
    expect(out).toBeNull();
  });
});

describe('OpenAiModelAdapter trusts only valid model JSON', () => {
  it('parses a valid vulnerability verdict into source=model', async () => {
    const client = clientReturning(
      JSON.stringify({ vulnerable: false, category: null, confidence: 0.9 }),
    );
    const v = await adapterWith(client).detectVulnerability(vulnInput);
    expect(v.vulnerable).toBe(false);
    expect(v.category).toBeNull();
    expect(v.source).toBe('model');
  });

  it('parses a valid classification into source=model', async () => {
    const client = clientReturning(
      JSON.stringify({ action: 'answer', customerGoal: 'borrowing limit', confidence: 0.85 }),
    );
    const r = await adapterWith(client).classify(classifyInput);
    expect(r.action).toBe('answer');
    expect(r.customerGoal).toBe('borrowing limit');
    expect(r.source).toBe('model');
  });

  it('tolerates code-fenced JSON from the model', async () => {
    const client = clientReturning(
      '```json\n{"vulnerable": true, "category": "distress", "confidence": 0.95}\n```',
    );
    const v = await adapterWith(client).detectVulnerability(vulnInput);
    expect(v.vulnerable).toBe(true);
    expect(v.category).toBe('distress');
    expect(v.source).toBe('model');
  });

  it('fails CLOSED on malformed vulnerability JSON', async () => {
    const v = await adapterWith(clientReturning('not json at all')).detectVulnerability(vulnInput);
    expect(v.source).toBe('failclosed');
    expect(v.vulnerable).toBe(true);
  });

  it('fails CLOSED when JSON is valid but violates the schema', async () => {
    // Missing required `vulnerable` field, bad confidence range.
    const v = await adapterWith(
      clientReturning(JSON.stringify({ category: 'x', confidence: 5 })),
    ).detectVulnerability(vulnInput);
    expect(v.source).toBe('failclosed');
    expect(v.vulnerable).toBe(true);
  });

  it('classify falls back to deterministic when model returns an invalid action', async () => {
    const r = await adapterWith(
      clientReturning(JSON.stringify({ action: 'totally-made-up', customerGoal: 'x', confidence: 0.5 })),
    ).classify(classifyInput);
    expect(r.source).toBe('deterministic');
    expect(r.action).toBe('answer');
  });

  it('phraseAnswer returns trimmed model text on success', async () => {
    const out = await adapterWith(
      clientReturning('  You could borrow somewhere between £1,000 and £25,000.  '),
    ).phraseAnswer(phraseInput);
    expect(out).toBe('You could borrow somewhere between £1,000 and £25,000.');
  });

  it('phraseAnswer returns null on empty model content', async () => {
    expect(await adapterWith(clientReturning('   ')).phraseAnswer(phraseInput)).toBeNull();
    expect(await adapterWith(clientReturning(null)).phraseAnswer(phraseInput)).toBeNull();
  });
});

describe('OpenAiModelAdapter request shaping', () => {
  it('requests JSON response_format for vulnerability and an abort signal', async () => {
    const client = clientReturning(JSON.stringify({ vulnerable: false, category: null, confidence: 0.9 }));
    await adapterWith(client).detectVulnerability(vulnInput);
    const create = client.chat.completions.create as ReturnType<typeof vi.fn>;
    const [params, options] = create.mock.calls[0]!;
    expect(params.response_format).toEqual({ type: 'json_object' });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it('does NOT request JSON response_format for phrasing', async () => {
    const client = clientReturning('rephrased text');
    await adapterWith(client).phraseAnswer(phraseInput);
    const create = client.chat.completions.create as ReturnType<typeof vi.fn>;
    const [params] = create.mock.calls[0]!;
    expect(params.response_format).toBeUndefined();
  });
});
