import { describe, expect, it, vi } from 'vitest';
import { DeterministicModelAdapter } from '../deterministic-model.adapter.js';
import { OpenAiModelAdapter, type ChatCompletionClient } from '../openai-model.adapter.js';
import type { AppConfig } from '../../config/env.js';
import type { Logger } from '../../config/logger.js';
import type { ExtractInput } from '../../ports/model.port.js';

const cfg = { groundingThreshold: 0.42 } as AppConfig;
const silentLogger = { warn: vi.fn(), info: vi.fn(), error: vi.fn() } as unknown as Logger;

const ALL_SLOTS: ExtractInput['requestedSlots'] = ['full_name', 'date_of_birth', 'email', 'phone'];

function det(): DeterministicModelAdapter {
  return new DeterministicModelAdapter(cfg);
}

function input(text: string, requestedSlots = ALL_SLOTS): ExtractInput {
  return { text, history: [], requestedSlots };
}

describe('DeterministicModelAdapter.extract', () => {
  it('extracts name, DOB, email, and phone volunteered in one message', async () => {
    const r = await det().extract(
      input('Hi, my name is Jane Smith, dob 1990-01-02, email jane@example.com, phone 07123456789'),
    );
    expect(r.slots.full_name).toBe('Jane Smith');
    expect(r.slots.date_of_birth).toBe('1990-01-02');
    expect(r.slots.email).toBe('jane@example.com');
    expect(r.slots.phone).toBe('07123456789');
    expect(r.source).toBe('deterministic');
  });

  it('only extracts slots the journey actually requested', async () => {
    const r = await det().extract(
      input('my name is Jane Smith and my email is jane@example.com', ['email']),
    );
    expect(r.slots.email).toBe('jane@example.com');
    expect(r.slots.full_name).toBeUndefined();
  });

  it('NEVER lands a bank/payment credential in a slot (brief §16, DD-0001)', async () => {
    const r = await det().extract(input('my name is 4111 1111 1111 1111, sort code 20-00-00'));
    expect(r.slots.full_name).toBeUndefined();
    // No slot anywhere holds a credential-shaped value.
    for (const v of Object.values(r.slots)) {
      expect(/\d{4}[ .-]?\d{4}/.test(v ?? '')).toBe(false);
    }
  });

  it('does not mistake an 8-digit account number for a phone', async () => {
    const r = await det().extract(input('my account number is 12345678', ['phone']));
    expect(r.slots.phone).toBeUndefined();
  });

  it('flags a question asked mid-collection', async () => {
    const r = await det().extract(input('wait, why do you need my date of birth?'));
    expect(r.signals.question).toBe(true);
  });

  it('flags a refusal to provide a field', async () => {
    const r = await det().extract(input("I'd rather not give my phone number"));
    expect(r.signals.refusal).toBe(true);
  });

  it('flags a correction to an earlier value', async () => {
    const r = await det().extract(input("actually it's jane@new.com"));
    expect(r.signals.correction).toBe(true);
  });
});

// ── OpenAI path ──────────────────────────────────────────────────────────────

function clientReturning(content: string | null): ChatCompletionClient {
  return {
    chat: { completions: { create: vi.fn(async () => ({ choices: [{ message: { content } }] })) } },
  };
}

const throwingClient: ChatCompletionClient = {
  chat: {
    completions: {
      create: vi.fn(async () => {
        throw new Error('boom');
      }),
    },
  },
};

function adapterWith(client: ChatCompletionClient): OpenAiModelAdapter {
  return new OpenAiModelAdapter(client, 'fake-model', new DeterministicModelAdapter(cfg), silentLogger);
}

const SIGNALS = { correction: false, refusal: false, offTopic: false, question: false };

describe('OpenAiModelAdapter.extract', () => {
  it('parses valid model JSON into source=model', async () => {
    const client = clientReturning(
      JSON.stringify({ slots: { full_name: 'Jane Smith' }, signals: SIGNALS, confidence: 0.8 }),
    );
    const r = await adapterWith(client).extract(input('I am Jane Smith'));
    expect(r.source).toBe('model');
    expect(r.slots.full_name).toBe('Jane Smith');
  });

  it('drops a credential-shaped value even if the model returns it', async () => {
    const client = clientReturning(
      JSON.stringify({
        slots: { full_name: 'Jane', phone: '4111 1111 1111 1111' },
        signals: SIGNALS,
        confidence: 0.9,
      }),
    );
    const r = await adapterWith(client).extract(input('...'));
    expect(r.slots.full_name).toBe('Jane');
    expect(r.slots.phone).toBeUndefined();
  });

  it('drops slot keys the journey did not request', async () => {
    const client = clientReturning(
      JSON.stringify({
        slots: { full_name: 'Jane', address: '12 Oak St' },
        signals: SIGNALS,
        confidence: 0.9,
      }),
    );
    const r = await adapterWith(client).extract(input('I am Jane', ['full_name']));
    expect(r.slots.full_name).toBe('Jane');
    expect((r.slots as Record<string, string>).address).toBeUndefined();
  });

  it('falls back to deterministic extraction when the client throws', async () => {
    const r = await adapterWith(throwingClient).extract(input('email jane@example.com'));
    expect(r.source).toBe('deterministic');
    expect(r.slots.email).toBe('jane@example.com');
  });

  it('falls back to deterministic on malformed model JSON', async () => {
    const r = await adapterWith(clientReturning('not json')).extract(input('email jane@example.com'));
    expect(r.source).toBe('deterministic');
    expect(r.slots.email).toBe('jane@example.com');
  });

  it('requests a JSON response_format and passes an abort signal', async () => {
    const client = clientReturning(JSON.stringify({ slots: {}, signals: SIGNALS, confidence: 0.5 }));
    await adapterWith(client).extract(input('hello'));
    const create = client.chat.completions.create as ReturnType<typeof vi.fn>;
    const [params, options] = create.mock.calls[0]!;
    expect(params.response_format).toEqual({ type: 'json_object' });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });
});
