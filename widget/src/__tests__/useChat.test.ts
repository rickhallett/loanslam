import { describe, expect, it, vi } from 'vitest';
import type { ChatTurnResponse, FormConfig, SessionCreatedResponse } from '@loanslam/contracts';
import type { ChatClient } from '../api/client.js';
import { useChat } from '../state/useChat.js';

const baseState = {
  phase: 'anonymous_active' as const,
  vulnerabilityFlagged: false,
  awaitingForm: false,
  goalSummary: null,
};

const greeting: SessionCreatedResponse = {
  conversationRef: 'conv_1',
  requestRef: 'req_1',
  state: baseState,
  reply: { mode: 'clarify', text: 'Hello, how can I help today?' },
};

const handoffForm: FormConfig = {
  formId: 'account-handoff',
  title: 'Connect to our team',
  description: 'A few details, please.',
  submitLabel: 'Send',
  fields: [{ name: 'full_name', label: 'Full name', type: 'text', required: true }],
};

/** Minimal fake implementing the methods useChat depends on. */
function fakeClient(overrides: Partial<ChatClient> = {}): ChatClient {
  return {
    createSession: vi.fn(async () => greeting),
    sendMessage: vi.fn(async () => greeting),
    submitIntake: vi.fn(async () => greeting),
    reset: vi.fn(async () => greeting),
    health: vi.fn(),
    getCsrfToken: vi.fn(() => null),
    ...overrides,
  } as unknown as ChatClient;
}

describe('useChat', () => {
  it('init() creates a session and pushes the greeting reply', async () => {
    const chat = useChat(fakeClient());
    await chat.init();
    expect(chat.messages.value).toHaveLength(1);
    expect(chat.messages.value[0]?.author).toBe('bot');
    expect(chat.messages.value[0]?.text).toBe('Hello, how can I help today?');
    expect(chat.publicState.value?.phase).toBe('anonymous_active');
  });

  it('send() optimistically pushes the customer message then the bot reply', async () => {
    const answer: ChatTurnResponse = {
      ...greeting,
      requestRef: 'req_2',
      reply: {
        mode: 'answer',
        text: 'Here is some general guidance.',
        citations: [{ itemId: 'kb-1', question: 'How much can I borrow?', score: 0.9 }],
        links: [],
      },
    };
    const client = fakeClient({ sendMessage: vi.fn(async () => answer) });
    const chat = useChat(client);

    await chat.send('How much can I borrow?');

    expect(chat.messages.value).toHaveLength(2);
    expect(chat.messages.value[0]).toMatchObject({ author: 'customer', text: 'How much can I borrow?' });
    expect(chat.messages.value[1]).toMatchObject({ author: 'bot' });
    expect(chat.messages.value[1]?.reply?.mode).toBe('answer');
  });

  it('exposes the intake form only when awaitingForm and the latest reply is intake_request', async () => {
    const intakeReply: ChatTurnResponse = {
      ...greeting,
      requestRef: 'req_2',
      state: { ...baseState, phase: 'awaiting_intake', awaitingForm: true },
      reply: { mode: 'intake_request', text: 'I can pass this to our team.', form: handoffForm },
    };
    const chat = useChat(fakeClient({ sendMessage: vi.fn(async () => intakeReply) }));

    await chat.send("What's my balance?");

    expect(chat.awaitingIntake.value).toBe(true);
    expect(chat.activeForm.value?.formId).toBe('account-handoff');
  });

  it('submitForm() posts intake and appends the handoff confirmation', async () => {
    const intakeReply: ChatTurnResponse = {
      ...greeting,
      requestRef: 'req_2',
      state: { ...baseState, phase: 'awaiting_intake', awaitingForm: true },
      reply: { mode: 'intake_request', text: 'Details, please.', form: handoffForm },
    };
    const confirmation: ChatTurnResponse = {
      ...greeting,
      requestRef: 'req_3',
      state: { ...baseState, phase: 'handoff_pending' },
      reply: { mode: 'handoff', text: 'Passed to our team.', ticketRef: 'tkt_1' },
    };
    const submitIntake = vi.fn(async () => confirmation);
    const chat = useChat(
      fakeClient({ sendMessage: vi.fn(async () => intakeReply), submitIntake }),
    );

    await chat.send("What's my balance?");
    await chat.submitForm({ full_name: 'Jordan Example' });

    expect(submitIntake).toHaveBeenCalledWith('account-handoff', { full_name: 'Jordan Example' });
    const last = chat.messages.value.at(-1);
    expect(last?.reply?.mode).toBe('handoff');
    expect(chat.publicState.value?.phase).toBe('handoff_pending');
  });

  it('reset() clears the in-memory transcript and renders the fresh reply', async () => {
    const chat = useChat(fakeClient());
    await chat.init();
    await chat.send('hello');
    expect(chat.messages.value.length).toBeGreaterThan(1);

    await chat.reset();
    expect(chat.messages.value).toHaveLength(1);
  });

  it('surfaces a friendly error when the client throws', async () => {
    const chat = useChat(
      fakeClient({
        createSession: vi.fn(async () => {
          throw new Error('network down');
        }),
      }),
    );
    await chat.init();
    expect(chat.error.value).toBe('network down');
    expect(chat.messages.value).toHaveLength(0);
  });

  it('never touches browser storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const chat = useChat(fakeClient());
    await chat.init();
    await chat.send('hello');
    await chat.reset();
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});
