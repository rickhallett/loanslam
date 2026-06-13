import { computed, ref, type ComputedRef, type Ref } from 'vue';
import type { FormConfig, PublicConversationState, Reply } from '@loanslam/contracts';
import { ChatApiError, createChatClient, type ChatClient } from '../api/client.js';

/**
 * One rendered line in the transcript. Customer lines carry plain text; bot
 * lines carry the backend-selected `reply` so the bubble can render by mode.
 * Nothing here is persisted to browser storage — it is in-memory reactive state
 * only (brief §16).
 */
export interface ChatMessage {
  id: string;
  author: 'customer' | 'bot';
  text: string;
  reply?: Reply;
}

let messageSeq = 0;
const nextId = (): string => `m_${++messageSeq}_${Date.now()}`;

/** Wrap a backend Reply as a renderable bot message. */
function botMessage(reply: Reply): ChatMessage {
  return { id: nextId(), author: 'bot', text: reply.text, reply };
}

function customerMessage(text: string): ChatMessage {
  return { id: nextId(), author: 'customer', text };
}

export interface UseChat {
  messages: Ref<ChatMessage[]>;
  publicState: Ref<PublicConversationState | null>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  initialised: Ref<boolean>;
  /** True when the backend is waiting on an intake form for the latest reply. */
  awaitingIntake: ComputedRef<boolean>;
  /** The form config from the latest intake_request reply, if any. */
  activeForm: ComputedRef<FormConfig | null>;
  init: () => Promise<void>;
  send: (text: string) => Promise<void>;
  submitForm: (values: Record<string, string>) => Promise<void>;
  reset: () => Promise<void>;
}

/**
 * Reactive chat state + transport orchestration. It renders ONLY backend-
 * provided state and reply modes; it makes no business/safety/intent decisions.
 */
export function useChat(client: ChatClient = createChatClient()): UseChat {
  const messages: Ref<ChatMessage[]> = ref([]);
  const publicState: Ref<PublicConversationState | null> = ref(null);
  const loading: Ref<boolean> = ref(false);
  const error: Ref<string | null> = ref(null);
  const initialised: Ref<boolean> = ref(false);

  const latestReply = computed<Reply | undefined>(() => {
    for (let i = messages.value.length - 1; i >= 0; i--) {
      const m = messages.value[i];
      if (m && m.author === 'bot' && m.reply) return m.reply;
    }
    return undefined;
  });

  // Show the form only when the backend says it is awaiting one AND the latest
  // reply actually carries the form config. Pure rendering off backend state.
  const awaitingIntake = computed<boolean>(() => {
    const r = latestReply.value;
    return Boolean(publicState.value?.awaitingForm) && r?.mode === 'intake_request';
  });

  const activeForm = computed(() => {
    const r = latestReply.value;
    return r && r.mode === 'intake_request' ? r.form : null;
  });

  function toMessage(err: unknown): string {
    if (err instanceof ChatApiError) return err.message;
    if (err instanceof Error) return err.message;
    return 'Something went wrong. Please try again.';
  }

  async function init(): Promise<void> {
    if (loading.value) return;
    loading.value = true;
    error.value = null;
    try {
      const res = await client.createSession();
      publicState.value = res.state;
      messages.value = [botMessage(res.reply)];
      initialised.value = true;
    } catch (err) {
      error.value = toMessage(err);
    } finally {
      loading.value = false;
    }
  }

  async function send(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || loading.value) return;
    error.value = null;
    // Optimistically render the customer's message.
    messages.value.push(customerMessage(trimmed));
    loading.value = true;
    try {
      const res = await client.sendMessage(trimmed);
      publicState.value = res.state;
      messages.value.push(botMessage(res.reply));
    } catch (err) {
      error.value = toMessage(err);
    } finally {
      loading.value = false;
    }
  }

  async function submitForm(values: Record<string, string>): Promise<void> {
    const form = activeForm.value;
    if (!form || loading.value) return;
    error.value = null;
    loading.value = true;
    try {
      const res = await client.submitIntake(form.formId, values);
      publicState.value = res.state;
      messages.value.push(botMessage(res.reply));
    } catch (err) {
      error.value = toMessage(err);
    } finally {
      loading.value = false;
    }
  }

  async function reset(): Promise<void> {
    if (loading.value) return;
    error.value = null;
    loading.value = true;
    try {
      const res = await client.reset();
      publicState.value = res.state;
      // Drop the in-memory transcript; render the fresh reply only.
      messages.value = [botMessage(res.reply)];
    } catch (err) {
      error.value = toMessage(err);
    } finally {
      loading.value = false;
    }
  }

  return {
    messages,
    publicState,
    loading,
    error,
    initialised,
    awaitingIntake,
    activeForm,
    init,
    send,
    submitForm,
    reset,
  };
}
