import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatResponse, HandoffIntakeForm } from '@loanslam/contracts';

import ChatWidget from './components/ChatWidget.vue';
import type { WidgetChatClient } from './api/chat-client.js';

describe('ChatWidget', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a session on mount and announces readiness', async () => {
    const postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => undefined);
    const client = new FakeWidgetClient();

    const wrapper = mount(ChatWidget, { props: { client } });
    await flushPromises();

    expect(client.createSessionCalls).toBe(1);
    expect(wrapper.text()).toContain('Hello from Loanslam.');
    expect(postMessage).toHaveBeenCalledWith({ type: 'loanslam:ready' }, '*');
  });

  it('submits messages through the client and renders grounded citations', async () => {
    const client = new FakeWidgetClient();
    client.nextMessageResponse = activeResponse({
      text: 'Apply online through Loanslam.',
      citations: [{ sourceId: 'how-to-apply', title: 'How to apply', score: 0.9 }],
    });
    const wrapper = mount(ChatWidget, { props: { client } });
    await flushPromises();

    await wrapper.get('textarea[name="message"]').setValue('How do I apply?');
    await wrapper.get('form[data-testid="message-form"]').trigger('submit');
    await flushPromises();

    expect(client.sentMessages).toEqual(['How do I apply?']);
    expect(wrapper.text()).toContain('Apply online through Loanslam.');
    expect(wrapper.text()).toContain('How to apply');
  });

  it('renders backend-provided form fields and clears values after successful intake', async () => {
    const client = new FakeWidgetClient();
    client.nextMessageResponse = handoffResponse(handoffForm(['email', 'situationalContext']));
    client.nextIntakeResponse = handoffResponse(handoffForm(['email', 'situationalContext']));
    const wrapper = mount(ChatWidget, { props: { client } });
    await flushPromises();

    await wrapper.get('textarea[name="message"]').setValue('Please help with my account.');
    await wrapper.get('form[data-testid="message-form"]').trigger('submit');
    await flushPromises();

    expect(wrapper.find('input[name="name"]').exists()).toBe(false);
    await wrapper.get('input[name="email"]').setValue('alex@example.com');
    await wrapper.get('textarea[name="situationalContext"]').setValue('Please call me.');
    await wrapper.get('form[data-testid="intake-form"]').trigger('submit');
    await flushPromises();

    expect(client.submittedIntake).toEqual({
      email: 'alex@example.com',
      situationalContext: 'Please call me.',
    });
    expect((wrapper.get('input[name="email"]').element as HTMLInputElement).value).toBe('');
    expect(
      (wrapper.get('textarea[name="situationalContext"]').element as HTMLTextAreaElement).value,
    ).toBe('');
  });

  it('does not write transcripts or PII to browser storage', async () => {
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    const client = new FakeWidgetClient();
    const wrapper = mount(ChatWidget, { props: { client } });
    await flushPromises();

    await wrapper.get('textarea[name="message"]').setValue('My email is alex@example.com');
    await wrapper.get('form[data-testid="message-form"]').trigger('submit');
    await flushPromises();

    expect(storageSpy).not.toHaveBeenCalled();
  });
});

class FakeWidgetClient implements WidgetChatClient {
  createSessionCalls = 0;
  sentMessages: string[] = [];
  submittedIntake: Record<string, string> | null = null;
  nextMessageResponse: ChatResponse = activeResponse({ text: 'General answer.' });
  nextIntakeResponse: ChatResponse = activeResponse({ text: 'Intake submitted.' });

  createSession(): Promise<ChatResponse> {
    this.createSessionCalls += 1;
    return Promise.resolve(activeResponse({ text: 'Hello from Loanslam.' }));
  }

  sendMessage(text: string): Promise<ChatResponse> {
    this.sentMessages.push(text);
    return Promise.resolve(this.nextMessageResponse);
  }

  submitIntake(intake: Record<string, string>): Promise<ChatResponse> {
    this.submittedIntake = { ...intake };
    return Promise.resolve(this.nextIntakeResponse);
  }

  reset(): Promise<ChatResponse> {
    return Promise.resolve(activeResponse({ text: 'Reset complete.' }));
  }
}

function activeResponse(input: {
  text: string;
  citations?: ChatResponse['messages'][number]['citations'];
}): ChatResponse {
  return {
    conversationRef: 'conv_123',
    requestRef: `req_${input.text.replaceAll(' ', '_')}`,
    correlationRef: 'corr_123',
    csrfToken: 'csrf_123',
    state: 'active',
    messages: [
      {
        id: `msg_${input.text.replaceAll(' ', '_')}`,
        role: 'assistant',
        text: input.text,
        createdAt: '2026-06-13T12:00:00.000Z',
        citations: input.citations,
      },
    ],
    audit: { events: ['message_routed'], reasonCodes: ['general_process_question'] },
  };
}

function handoffResponse(form: HandoffIntakeForm): ChatResponse {
  return {
    conversationRef: 'conv_123',
    requestRef: 'req_handoff',
    correlationRef: 'corr_handoff',
    csrfToken: 'csrf_123',
    state: 'awaiting_handoff_intake',
    messages: [
      {
        id: 'msg_handoff',
        role: 'assistant',
        text: 'Please share these details.',
        createdAt: '2026-06-13T12:00:00.000Z',
      },
    ],
    form,
    audit: { events: ['message_routed'], reasonCodes: ['account_specific_request'] },
  };
}

function handoffForm(names: Array<'email' | 'situationalContext'>): HandoffIntakeForm {
  return {
    id: 'handoff-intake',
    title: 'Support handoff',
    submitLabel: 'Send details',
    fields: names.map((name) => ({
      name,
      label: name === 'email' ? 'Email' : 'How can the support team help?',
      inputType: name === 'email' ? 'email' : 'textarea',
      required: true,
    })),
  };
}
