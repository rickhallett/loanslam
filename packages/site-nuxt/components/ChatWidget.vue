<template>
  <div>
    <div id="mal-frost" :class="{ 'is-visible': isOpen }" @click="closePanel" />

    <button
      id="mal-launcher"
      type="button"
      :aria-label="isOpen ? 'Close Loans by MAL assistant' : 'Open Loans by MAL assistant'"
      :aria-expanded="isOpen"
      @click="togglePanel"
    >
      <svg v-if="!isOpen" viewBox="0 0 24 24" aria-hidden="true" class="mal-icon">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
      </svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true" class="mal-icon">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
      </svg>
    </button>

    <div v-show="isOpen" id="mal-panel" role="dialog" aria-label="Loans by MAL assistant">
      <main class="widget-shell" aria-label="LoanSlam chat widget">
        <section class="chat-panel">
          <header class="chat-header">
            <div>
              <p class="eyebrow">LoanSlam chat</p>
              <h1>LoanSlam assistant</h1>
              <p class="chat-status">Prototype support chat</p>
            </div>
            <div class="chat-header-actions">
              <button type="button" title="Start over" aria-label="Start over" @click="reset">
                &#8635;
              </button>
              <button type="button" title="Close" aria-label="Close chat" @click="closePanel">
                &times;
              </button>
            </div>
          </header>

          <ul ref="scroller" class="message-list">
            <li
              v-for="(message, index) in messages"
              :key="message.id"
              :class="['message', message.role === 'customer' ? 'message-user' : 'message-assistant']"
            >
              <span class="message-text">{{ message.text }}</span>
              <div
                v-if="index === messages.length - 1 && message.role === 'assistant' && message.ui && hasRenderableContent(message.ui)"
                class="primitive"
              >
                <div v-if="message.ui.primitive === 'choice_list'" class="choices">
                  <button
                    v-for="choice in message.ui.choices"
                    :key="choice.id"
                    class="chip"
                    type="button"
                    @click="submit(choice.label)"
                  >
                    {{ choice.label }}
                  </button>
                </div>
                <ChatIntakeForm
                  v-else-if="message.ui.primitive === 'intake_form'"
                  :key="message.ui.fields.join(',')"
                  :fields="message.ui.fields"
                  @submit="onIntakeSubmit"
                  @cancel="onIntakeCancel"
                />
                <div
                  v-else-if="(message.ui.primitive === 'message' || message.ui.primitive === 'safe_fallback') && message.ui.links.length > 0"
                  class="links"
                >
                  <a
                    v-for="(link, i) in message.ui.links"
                    :key="i"
                    class="link"
                    :href="linkHref(link)"
                    target="_blank"
                    rel="noopener"
                  >
                    {{ link.label }}
                  </a>
                </div>
                <div v-else-if="message.ui.primitive === 'handoff_confirmation'" class="handoff">
                  Our support team will take it from here.
                </div>
              </div>
            </li>
            <li v-if="isSending" class="message message-assistant thinking-bubble" aria-label="Assistant is typing">
              <span class="thinking-dots"><span></span><span></span><span></span></span>
            </li>
          </ul>

          <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
          <p v-if="isChatComplete" class="terminal-note">
            This handoff is complete. Refresh or start over to begin a new chat.
          </p>

          <p class="uat-notice uat-notice-composer">
            Prototype — conversations are recorded. Please use test details only.
          </p>

          <form class="composer" @submit.prevent="submitDraft">
            <input
              ref="inputEl"
              v-model="draft"
              type="text"
              placeholder="Type your message…"
              autocomplete="off"
              aria-label="Message"
              :disabled="isChatComplete"
            />
            <button
              class="composer-send"
              type="submit"
              :disabled="isSending || isChatComplete || draft.trim().length === 0"
              aria-label="Send message"
              @mousedown.prevent
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
                <path fill="currentColor" d="M3 20.5 21 12 3 3.5 3 10l12 2-12 2z" />
              </svg>
            </button>
          </form>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';

import type { IntakeField, UiPlan } from '@loanslam/contracts';
import type {
  IpocSendMessageResponse,
  IpocSessionResponse,
  IpocSubmitIntakeResponse,
} from '../../integrated-poc/shared/ipoc';

// Native port of the review-widget chat (WidgetApp.vue) over the ipoc
// surface: same texts, same UiPlan rendering, same interaction rules (D042).
// The widget stays a dumb terminal; the server owns routing and safety.

interface ChatMessage {
  id: number;
  role: 'customer' | 'assistant';
  text: string;
  ui?: UiPlan | null;
}

const WELCOME =
  "Hi, I'm the LoanSlam assistant. I can answer general questions about our loans and point you to the right team for anything account-specific. How can I help?";

const isOpen = ref(false);
const messages = ref<ChatMessage[]>([]);
const sessionRef = ref<string | null>(null);
const activeTicketId = ref<string | null>(null);
const isSending = ref(false);
const isChatComplete = ref(false);
const errorMessage = ref('');
const draft = ref('');
const scroller = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLInputElement | null>(null);

let nextId = 0;

function pushMessage(role: ChatMessage['role'], text: string, ui: UiPlan | null = null): void {
  messages.value.push({ id: nextId++, role, text, ui });
}

function hasRenderableContent(plan: UiPlan): boolean {
  switch (plan.primitive) {
    case 'choice_list':
      return plan.choices.length > 0;
    case 'intake_form':
      return plan.fields.length > 0;
    case 'message':
    case 'safe_fallback':
      return plan.links.length > 0;
    case 'handoff_confirmation':
      return true;
    default:
      return false;
  }
}

function linkHref(link: { url?: string | null; href?: string | null }): string {
  return link.url ?? link.href ?? '#';
}

async function ensureSession(): Promise<string> {
  if (sessionRef.value) return sessionRef.value;
  const session = await $fetch<IpocSessionResponse>('/api/ipoc/sessions', { method: 'POST' });
  sessionRef.value = session.conversationRef;
  return session.conversationRef;
}

async function submit(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed || isSending.value || isChatComplete.value) return;

  errorMessage.value = '';
  pushMessage('customer', trimmed);
  isSending.value = true;

  try {
    const ref = await ensureSession();
    const result = await $fetch<IpocSendMessageResponse>(
      `/api/ipoc/sessions/${encodeURIComponent(ref)}/messages`,
      { method: 'POST', body: { message: trimmed } },
    );
    if (result.ticket) activeTicketId.value = result.ticket.id;
    pushMessage('assistant', result.assistant.message, result.assistant.ui);
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : 'Something went wrong reaching the assistant. Please try again.';
  } finally {
    isSending.value = false;
  }
}

function submitDraft(): void {
  const value = draft.value;
  draft.value = '';
  void submit(value);
}

async function onIntakeSubmit(values: Record<IntakeField, string>): Promise<void> {
  if (isSending.value || isChatComplete.value || !sessionRef.value || !activeTicketId.value) return;

  errorMessage.value = '';
  isSending.value = true;

  try {
    const result = await $fetch<IpocSubmitIntakeResponse>(
      `/api/ipoc/sessions/${encodeURIComponent(sessionRef.value)}/intake`,
      { method: 'POST', body: { ticketId: activeTicketId.value, fields: values } },
    );
    pushMessage('customer', 'Shared my contact details.');
    const confirmation = result.messages.at(-1);
    pushMessage(
      'assistant',
      confirmation?.role === 'assistant'
        ? confirmation.content
        : 'Thanks — our support team will take it from here.',
    );
    isChatComplete.value = true;
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : 'Something went wrong sharing your details. Please try again.';
  } finally {
    isSending.value = false;
  }
}

async function onIntakeCancel(): Promise<void> {
  if (isSending.value || isChatComplete.value || !sessionRef.value) return;
  errorMessage.value = '';

  try {
    await $fetch<IpocSessionResponse>(
      `/api/ipoc/sessions/${encodeURIComponent(sessionRef.value)}/cancel-handoff`,
      { method: 'POST' },
    );
    pushMessage('assistant', 'No problem — ask me anything else about your LoanSlam loan.', null);
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : 'Something went wrong cancelling the handoff. Please try again.';
  }
}

function reset(): void {
  // Client-side reset (D042): drop the session ref; a fresh session starts on
  // the next message, mirroring the widget's local-clear fallback.
  sessionRef.value = null;
  activeTicketId.value = null;
  isChatComplete.value = false;
  errorMessage.value = '';
  messages.value = [];
  pushMessage('assistant', WELCOME);
}

function focusInput(): void {
  void nextTick(() => inputEl.value?.focus());
}

function openPanel(): void {
  isOpen.value = true;
  document.body.classList.add('mal-open');
  // Highlights belong to the closed state (loader parity): clear any reveal
  // while the assistant is open.
  document.getElementById('contact-section')?.removeAttribute('data-revealed');
  focusInput();
}

function closePanel(): void {
  isOpen.value = false;
  document.body.classList.remove('mal-open');
}

function togglePanel(): void {
  if (isOpen.value) closePanel();
  else openPanel();
}

watch(
  () => [messages.value.length, isSending.value] as const,
  async () => {
    await nextTick();
    const element = scroller.value;
    if (element) element.scrollTop = element.scrollHeight;
  },
);

watch(
  () => isSending.value,
  (now, prev) => {
    if (prev && !now && !isChatComplete.value) focusInput();
  },
);

onMounted(() => {
  pushMessage('assistant', WELCOME);
  // The loader auto-opens the panel once the widget announces ready; the
  // native panel is ready immediately (deployed-Astro behavior parity).
  openPanel();
});
</script>

<style src="../assets/chat-widget.css"></style>
