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
              <div
                v-if="index === messages.length - 1 && message.id === applyOfferMessageId"
                class="primitive"
              >
                <div class="choices">
                  <button id="mal-apply-nav" class="chip" type="button" @click="goToApply">
                    Take me to the application
                  </button>
                </div>
              </div>
              <div
                v-if="index === messages.length - 1 && message.id === handoffOfferMessageId"
                class="primitive"
              >
                <div class="choices">
                  <button id="mal-handoff-nav" class="chip" type="button" @click="connectSupport">
                    Connect me with the support team
                  </button>
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
import { computed, nextTick, onMounted, ref, watch } from 'vue';

import type { DemoDisplayTelemetry, IntakeField, UiPlan } from '@loanslam/contracts';
import type {
  IpocSendMessageResponse,
  IpocSessionResponse,
  IpocSubmitIntakeResponse,
} from '../../integrated-poc/shared/ipoc';
import type {
  ConciergeMessageResponse,
  ConciergeSessionResponse,
  ConciergeStatusResponse,
} from '../lib/concierge';
import { snapshotApplicationForm } from '../lib/formSnapshot';

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

// dc-005 (D045): concierge mode on the apply journey. On /apply/, turns go
// to the segregated concierge route with a snapshot of the form state; the
// validated engine keeps serving every other route. Disabled everywhere by
// the kill switch (status endpoint gates the UI affordances too).
const APPLY_INTRO =
  "Here's the application — a few short steps, starting with your details. I can see the form as you fill it in (test details only on this prototype), so if anything's unclear just ask me here.";

// Layout-level surface (D045/D046): the widget is mounted once and present
// on every route — closed by default, opt-in via the launcher. Only
// /contact/ keeps its auto-open loader parity. The site-wide launcher is a
// recorded parity deviation, masked in the harness.
function normalizePath(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

const route = useRoute();
const isContactRoute = computed(() => normalizePath(route.path) === '/contact');
const isApplyRoute = computed(() => normalizePath(route.path) === '/apply');

// dc-003 (D045): deterministic navigation offer. When a grounded answer's
// top retrieval match is an apply-journey FAQ item, offer to take the user
// to the application form. Client-side quick action only — the engine and
// validator are untouched; no offer on safety-flagged turns.
const APPLY_ITEM_IDS = new Set([
  'how-do-i-apply',
  'what-is-the-eligibility-criteria',
  'can-i-apply-with-bad-credit',
  'can-i-apply-jointly',
  'what-documents-do-i-need',
  'will-my-credit-score-be-affected',
  'why-are-applications-declined-general',
]);

const isOpen = ref(false);
const applyOfferMessageId = ref<number | null>(null);
const handoffOfferMessageId = ref<number | null>(null);
const conciergeAvailable = ref(false);
const conciergeSessionRef = ref<string | null>(null);
const applyIntroDone = ref(false);
const storedContext = ref<'vulnerability' | 'handoff' | 'general' | null>(null);
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

function emitTelemetry(telemetry: unknown): void {
  // Same-window loopback the sm-devtools panel already accepts: content-free
  // decision metadata for the stakeholder engine-internals view (D043).
  window.postMessage(telemetry, window.location.origin);
  storedContext.value = contextForTelemetry(telemetry as DemoDisplayTelemetry);
}

// Mirrors core/lab/demoDisplay hostContextForState (D044): the coarse
// session context that promotes the matching contact route card on close.
const VULNERABLE_FLAGS = new Set([
  'vulnerability',
  'distress',
  'hardship',
  'accessibility_need',
  'language_barrier',
  'legal_threat',
  'complaint',
]);
const HANDOFF_ACTIONS = new Set(['request_handoff_intake', 'create_ticket', 'escalate']);

function applyOfferEligible(telemetry: DemoDisplayTelemetry): boolean {
  // The kill switch silences every concierge affordance, including the
  // navigation nudge into the concierge-assisted journey.
  if (!conciergeAvailable.value) return false;
  if (telemetry.finalAction !== 'answer' || telemetry.safetyFlags.length > 0) return false;
  if (normalizePath(route.path) === '/apply') return false;
  const top = telemetry.retrieval.matches[0];
  return top !== undefined && APPLY_ITEM_IDS.has(top.itemId);
}

function goToApply(): void {
  applyOfferMessageId.value = null;
  void navigateTo('/apply/');
}

// dc-006 (D045): the difficulty path out of concierge mode. When the
// concierge offers the support team, a deterministic quick action routes
// the next turn to the validated engine, which owns the existing handoff
// intake flow (form, ticket, server readback) unchanged.
function connectSupport(): void {
  handoffOfferMessageId.value = null;
  void submit("I'd like to talk to a person about my loan application, please.", {
    forceEngine: true,
  });
}

function contextForTelemetry(
  telemetry: DemoDisplayTelemetry,
): 'vulnerability' | 'handoff' | 'general' {
  if (telemetry.safetyFlags.some((flag) => VULNERABLE_FLAGS.has(flag))) {
    return 'vulnerability';
  }
  if (
    telemetry.intake.handoffPending ||
    HANDOFF_ACTIONS.has(telemetry.finalAction) ||
    telemetry.uiPrimitive === 'handoff_confirmation'
  ) {
    return 'handoff';
  }
  return 'general';
}

async function ensureSession(): Promise<string> {
  if (sessionRef.value) return sessionRef.value;
  const session = await $fetch<IpocSessionResponse>('/api/ipoc/sessions', { method: 'POST' });
  sessionRef.value = session.conversationRef;
  return session.conversationRef;
}

async function ensureConciergeSession(): Promise<string> {
  if (conciergeSessionRef.value) return conciergeSessionRef.value;
  const session = await $fetch<ConciergeSessionResponse>('/api/concierge/sessions', {
    method: 'POST',
  });
  conciergeSessionRef.value = session.conversationRef;
  return session.conversationRef;
}

async function sendConciergeTurn(message: string): Promise<string> {
  const ref = await ensureConciergeSession();
  const result = await $fetch<ConciergeMessageResponse>(
    `/api/concierge/sessions/${encodeURIComponent(ref)}/messages`,
    { method: 'POST', body: { message, formState: snapshotApplicationForm() } },
  );
  return result.assistant.message;
}

function maybeApplyIntro(): void {
  if (!isApplyRoute.value || !isOpen.value) return;
  if (!conciergeAvailable.value || applyIntroDone.value) return;
  applyIntroDone.value = true;
  pushMessage('assistant', APPLY_INTRO);
}

async function submit(
  text: string,
  { forceEngine = false }: { forceEngine?: boolean } = {},
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed || isSending.value || isChatComplete.value) return;

  errorMessage.value = '';
  pushMessage('customer', trimmed);
  isSending.value = true;

  try {
    if (!forceEngine && isApplyRoute.value && conciergeAvailable.value) {
      // Concierge mode: the segregated frontier-model route with a live
      // form-state snapshot. No engine, no telemetry, no UiPlan.
      const reply = await sendConciergeTurn(trimmed);
      pushMessage('assistant', reply);
      applyOfferMessageId.value = null;
      handoffOfferMessageId.value = /support team/i.test(reply)
        ? (messages.value.at(-1)?.id ?? null)
        : null;
      return;
    }
    const ref = await ensureSession();
    const result = await $fetch<IpocSendMessageResponse>(
      `/api/ipoc/sessions/${encodeURIComponent(ref)}/messages`,
      { method: 'POST', body: { message: trimmed } },
    );
    if (result.ticket) activeTicketId.value = result.ticket.id;
    pushMessage('assistant', result.assistant.message, result.assistant.ui);
    emitTelemetry(result.assistant.telemetry);
    applyOfferMessageId.value = applyOfferEligible(result.assistant.telemetry)
      ? (messages.value.at(-1)?.id ?? null)
      : null;
    handoffOfferMessageId.value = null;
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
    emitTelemetry(result.telemetry);
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
  conciergeSessionRef.value = null;
  applyIntroDone.value = false;
  isChatComplete.value = false;
  errorMessage.value = '';
  applyOfferMessageId.value = null;
  handoffOfferMessageId.value = null;
  messages.value = [];
  pushMessage('assistant', WELCOME);
  maybeApplyIntro();
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
  // Loader parity: re-apply the stored context on close and bring the
  // promoted contact route card into view.
  if (storedContext.value !== null) {
    const section = document.getElementById('contact-section');
    if (section) {
      section.setAttribute('data-revealed', storedContext.value);
      section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
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

watch(isContactRoute, (now, prev) => {
  // Each arrival at /contact/ auto-opens, matching the per-visit loader
  // behavior the page had when the widget was mounted by the page itself.
  if (now && !prev) openPanel();
});

watch([isApplyRoute, isOpen, conciergeAvailable], () => {
  // Arrival introduction (D045): fires when the open panel reaches /apply/
  // (chat-driven navigation) or when the panel is first opened there.
  maybeApplyIntro();
});

onMounted(async () => {
  pushMessage('assistant', WELCOME);
  // The loader auto-opens the panel once the widget announces ready; the
  // native panel is ready immediately (deployed-Astro behavior parity).
  if (isContactRoute.value) openPanel();
  try {
    const status = await $fetch<ConciergeStatusResponse>('/api/concierge/status');
    conciergeAvailable.value = status.enabled;
  } catch {
    conciergeAvailable.value = false;
  }
});
</script>

<style src="../assets/chat-widget.css"></style>
