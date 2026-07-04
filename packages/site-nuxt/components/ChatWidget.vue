<template>
  <div>
    <button id="mal-launcher" type="button" :aria-label="isOpen ? `Close ${chatTitle}` : `Open ${chatTitle}`" :aria-expanded="isOpen" @click="togglePanel">
      <svg v-if="!isOpen" viewBox="0 0 24 24" aria-hidden="true" class="mal-icon">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
      </svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true" class="mal-icon">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
      </svg>
    </button>

    <div v-show="isOpen" id="mal-panel" role="dialog" :aria-label="chatTitle">
      <main class="widget-shell" aria-label="MAL Loans chat widget">
        <section class="chat-panel">
          <header class="chat-header">
            <div>
              <p class="eyebrow">{{ chatEyebrow }}</p>
              <h1>{{ chatTitle }}</h1>
              <!-- The two chat surfaces are deliberately distinct (D045/D046);
                   the badge keeps the seam visible to the customer. -->
              <p v-if="isConciergeMode" id="mal-mode-badge" class="chat-status"><span class="mode-pill">Live guide</span> Application guide</p>
              <p v-else class="chat-status">{{ chatStatus }}</p>
            </div>
            <div class="chat-header-actions">
              <button type="button" title="Start over" aria-label="Start over" @click="reset">&#8635;</button>
              <button type="button" title="Close" aria-label="Close chat" @click="closePanel">&times;</button>
            </div>
          </header>

          <ul ref="scroller" class="message-list">
            <li v-for="(message, index) in messages" :key="message.id" :class="['message', message.role === 'customer' ? 'message-user' : 'message-assistant']">
              <span class="message-text">{{ message.text }}</span>
              <div v-if="index === messages.length - 1 && message.role === 'assistant' && message.ui && hasRenderableContent(message.ui)" class="primitive">
                <div v-if="message.ui.primitive === 'choice_list'" class="choices">
                  <button v-for="choice in message.ui.choices" :key="choice.id" class="chip" type="button" @click="submit(choice.label)">
                    {{ choice.label }}
                  </button>
                </div>
                <ChatIntakeForm v-else-if="message.ui.primitive === 'intake_form'" :key="message.ui.fields.join(',')" :fields="message.ui.fields" @submit="onIntakeSubmit" @cancel="onIntakeCancel" />
                <div v-else-if="(message.ui.primitive === 'message' || message.ui.primitive === 'safe_fallback') && message.ui.links.length > 0" class="links">
                  <a v-for="(link, i) in message.ui.links" :key="i" class="link" :href="linkHref(link)" target="_blank" rel="noopener">
                    {{ link.label }}
                  </a>
                </div>
                <div v-else-if="message.ui.primitive === 'handoff_confirmation'" class="handoff">Our support team will take it from here.</div>
              </div>
              <div v-if="index === messages.length - 1 && message.id === applyOfferMessageId" class="primitive">
                <div class="choices">
                  <button id="mal-apply-nav" class="chip" type="button" @click="goToApply">Take me to the application</button>
                </div>
              </div>
              <div v-if="index === messages.length - 1 && message.id === handoffOfferMessageId" class="primitive">
                <div class="choices">
                  <button id="mal-handoff-nav" class="chip" type="button" @click="connectSupport">Connect me with the support team</button>
                </div>
              </div>
              <div v-if="index === messages.length - 1 && message.id === navOfferMessageId && navOffer" class="primitive">
                <div class="choices">
                  <button id="mal-concierge-nav" class="chip" type="button" @click="goToNavOffer">
                    {{ navOffer.label }}
                  </button>
                </div>
              </div>
            </li>
            <li v-if="isSending && streamingMessageId === null" class="message message-assistant thinking-bubble" aria-label="Assistant is typing">
              <span class="thinking-dots"><span></span><span></span><span></span></span>
            </li>
          </ul>

          <p v-if="errorMessage" class="error" role="alert">
            {{ errorMessage }}
          </p>
          <p v-if="isChatComplete" class="terminal-note">This handoff is complete. Refresh or start over to begin a new chat.</p>

          <p class="uat-notice uat-notice-composer">Prototype — conversations are recorded. Please use test details only.</p>

          <form class="composer" :data-sending="isSending ? 'true' : undefined" @submit.prevent="submitDraft">
            <input ref="inputEl" v-model="draft" type="text" name="message" placeholder="Type your message…" autocomplete="off" aria-label="Message" :disabled="isChatComplete" />
            <button class="composer-send" type="submit" :disabled="isSending || isChatComplete || draft.trim().length === 0" aria-label="Send message" @mousedown.prevent>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import type { DemoDisplayTelemetry, IntakeField, UiPlan } from '@loanslam/contracts';
import type { IpocSendMessageResponse, IpocSessionResponse, IpocSubmitIntakeResponse } from '../../integrated-poc/shared/ipoc';
import type { ConciergeSessionResponse, ConciergeStatusResponse } from '../lib/concierge';
import { snapshotApplicationForm } from '../lib/formSnapshot';
import { hasApplicationFormLink, navOfferForReply, type NavOffer } from '../lib/navOffer';
import { snapshotPage } from '../lib/pageSnapshot';

// Native port of the review-widget chat (WidgetApp.vue) over the ipoc
// surface: same texts, same UiPlan rendering, same interaction rules (D042).
// The widget stays a dumb terminal; the server owns routing and safety.

interface ChatMessage {
  id: number;
  role: 'customer' | 'assistant';
  text: string;
  ui?: UiPlan | null;
}

interface RouteFinderTopic {
  eyebrow?: string;
  title: string;
}

const SUPPORT_WELCOME = "Hi, I'm the MAL Loans assistant. I can answer general questions about our loans and point you to the right team for anything account-specific. How can I help?";
const LEGACY_ROUTE_FINDER_WELCOME =
  "Tell me what you need help with and I'll point you to apply online, repayments, existing-loan support, complaints, or the right contact route. You can still call, text, or email the team directly from this page.";
const CONTACT_AVAILABILITY_NOTE = 'You can also ask me any other Loans by MAL question here.';
const CONTACT_COMPLETE_AVAILABILITY_NOTE = 'If you have another question, start over and I can help with that too.';
const CONTACT_CLOSE_REVEAL_ENABLED = false;
const ROUTE_FINDER_WELCOME =
  `Tell me what you need help with and I'll take it one step at a time. I can help with applications, repayments, existing loans, complaints, or finding the right contact route. ${CONTACT_AVAILABILITY_NOTE}`;

// dc-005 (D045): concierge mode on the apply journey. On /apply/, turns go
// to the segregated concierge route with a snapshot of the form state; the
// validated engine keeps serving every other route. Disabled everywhere by
// the kill switch (status endpoint gates the UI affordances too).
const APPLY_INTRO =
  "Here's the application — a few short steps, starting with your details. I can see the form as you fill it in (test details only on this prototype), so if anything's unclear just ask me here.";

// Layout-level surface (D045/D046): the widget is mounted once and present
// on every route, but stays opt-in. On /contact/ the page owns the primary
// route-finder UI and opens this panel only when the customer asks for help.
function normalizePath(path: string): string {
  const trimmed = path.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

const route = useRoute();
const isContactRoute = computed(() => normalizePath(route.path) === '/contact');
const isApplyRoute = computed(() => normalizePath(route.path) === '/apply');
// The surface the next turn will use: concierge everywhere except /contact/
// (mirrors the routing in submit). Drives the header mode badge.
const isConciergeMode = computed(() => conciergeAvailable.value && !isContactRoute.value);
const chatEyebrow = computed(() => (isContactRoute.value ? 'Route finder' : 'Website help'));
const chatTitle = computed(() => (isContactRoute.value ? 'Find the right team' : 'MAL Loans assistant'));
const chatStatus = computed(() => (isContactRoute.value ? 'Contact route finder' : 'Support chat'));

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
// Concierge navigation offer: a deterministic chip rendered when the reply
// names a whitelisted site page (lib/navOffer). The handoff offer wins when
// both match — the difficulty path back to the validated engine comes first.
const navOffer = ref<NavOffer | null>(null);
const navOfferMessageId = ref<number | null>(null);
const conciergeAvailable = ref(false);
const conciergeSessionRef = ref<string | null>(null);
const applyIntroDone = ref(false);
const storedContext = ref<'vulnerability' | 'handoff' | 'general' | null>(null);
const messages = ref<ChatMessage[]>([]);
const sessionRef = ref<string | null>(null);
const activeTicketId = ref<string | null>(null);
const isSending = ref(false);
// dr-002: id of the assistant message a reply is currently streaming into
// (null when no stream is active — the thinking dots show instead).
const streamingMessageId = ref<number | null>(null);
const isChatComplete = ref(false);
const errorMessage = ref('');
const draft = ref('');
const scroller = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLInputElement | null>(null);

let nextId = 0;

function pushMessage(role: ChatMessage['role'], text: string, ui: UiPlan | null = null): void {
  messages.value.push({ id: nextId++, role, text, ui });
}

function currentWelcome(): string {
  return isContactRoute.value ? ROUTE_FINDER_WELCOME : SUPPORT_WELCOME;
}

function isWelcomeText(text: string): boolean {
  return text === SUPPORT_WELCOME || text === ROUTE_FINDER_WELCOME || text === LEGACY_ROUTE_FINDER_WELCOME;
}

function ensureContextWelcome(): void {
  const firstMessage = messages.value[0];
  if (!firstMessage) {
    pushMessage('assistant', currentWelcome());
    return;
  }
  if (messages.value.length === 1 && firstMessage.role === 'assistant' && isWelcomeText(firstMessage.text)) {
    firstMessage.text = currentWelcome();
  }
}

function withContactAvailability(text: string): string {
  if (!isContactRoute.value || text.includes(CONTACT_AVAILABILITY_NOTE) || text.includes(CONTACT_COMPLETE_AVAILABILITY_NOTE)) {
    return text;
  }
  return `${text}\n\n${CONTACT_AVAILABILITY_NOTE}`;
}

function topicPrimerText(topic: RouteFinderTopic): string {
  const topicLabel = topic.title.trim();
  return withContactAvailability(`Okay - let's start with "${topicLabel}". Tell me what you need help with and I'll take it one step at a time.`);
}

function pushTopicPrimer(topic: RouteFinderTopic): void {
  const primer = topicPrimerText(topic);
  if (messages.value.at(-1)?.role === 'assistant' && messages.value.at(-1)?.text === primer) return;
  pushMessage('assistant', primer);
}

function scrollToEnd(): void {
  const element = scroller.value;
  if (element) element.scrollTop = element.scrollHeight;
}

// dc2-003 (D046): the conversation survives full page loads via
// sessionStorage (per-tab, gone on tab close). Restored transcripts are
// text-only — interactive UiPlans are not resurrected.
const STORAGE_KEY = 'mal-chat-state-v1';

function persistState(): void {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        messages: messages.value.map(({ role, text }) => ({ role, text })),
        sessionRef: sessionRef.value,
        conciergeSessionRef: conciergeSessionRef.value,
        activeTicketId: activeTicketId.value,
        applyIntroDone: applyIntroDone.value,
        storedContext: storedContext.value,
        isChatComplete: isChatComplete.value,
      }),
    );
  } catch {
    // Storage unavailable (private mode, quota): persistence is best-effort.
  }
}

function restoreState(): boolean {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw) as {
      messages?: Array<{ role: ChatMessage['role']; text: string }>;
      sessionRef?: string | null;
      conciergeSessionRef?: string | null;
      activeTicketId?: string | null;
      applyIntroDone?: boolean;
      storedContext?: typeof storedContext.value;
      isChatComplete?: boolean;
    };
    if (!saved.messages || saved.messages.length === 0) return false;
    messages.value = saved.messages.map((entry) => ({
      id: nextId++,
      role: entry.role,
      text: entry.text,
      ui: null,
    }));
    sessionRef.value = saved.sessionRef ?? null;
    conciergeSessionRef.value = saved.conciergeSessionRef ?? null;
    activeTicketId.value = saved.activeTicketId ?? null;
    applyIntroDone.value = saved.applyIntroDone ?? false;
    storedContext.value = saved.storedContext ?? null;
    isChatComplete.value = saved.isChatComplete ?? false;
    return true;
  } catch {
    return false;
  }
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
const VULNERABLE_FLAGS = new Set(['vulnerability', 'distress', 'hardship', 'accessibility_need', 'language_barrier', 'legal_threat', 'complaint']);
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

function replyAlreadyLinksApplication(ui: UiPlan): boolean {
  return (ui.primitive === 'message' || ui.primitive === 'safe_fallback') && hasApplicationFormLink(ui.links);
}

function goToApply(): void {
  applyOfferMessageId.value = null;
  void navigateTo('/apply/');
}

function goToNavOffer(): void {
  const target = navOffer.value;
  navOffer.value = null;
  navOfferMessageId.value = null;
  if (target) void navigateTo(target.path);
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

function contextForTelemetry(telemetry: DemoDisplayTelemetry): 'vulnerability' | 'handoff' | 'general' {
  if (telemetry.safetyFlags.some((flag) => VULNERABLE_FLAGS.has(flag))) {
    return 'vulnerability';
  }
  if (telemetry.intake.handoffPending || HANDOFF_ACTIONS.has(telemetry.finalAction) || telemetry.uiPrimitive === 'handoff_confirmation') {
    return 'handoff';
  }
  return 'general';
}

async function ensureSession(): Promise<string> {
  if (sessionRef.value) return sessionRef.value;
  const session = await $fetch<IpocSessionResponse>('/api/ipoc/sessions', {
    method: 'POST',
  });
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

function transcriptForResume(): Array<{
  role: 'customer' | 'assistant';
  content: string;
}> {
  // Text-only replay (dr-001). The current customer turn is already in
  // messages.value (pushed by submit) and is sent separately as the new
  // turn, so drop the trailing customer message to avoid double-counting;
  // welcome lines are UI, not turns.
  const history = [...messages.value];
  if (history.at(-1)?.role === 'customer') history.pop();
  return history.filter((m) => m.text && !isWelcomeText(m.text)).map((m) => ({ role: m.role, content: m.text }));
}

// dr-002 (D047): concierge replies stream over SSE. Validation failures
// (404/429/400) arrive as the response status before any bytes stream, so
// the dr-001 resurrection path is unchanged. Resolves to the full reply;
// onText receives the accumulated partial text as deltas arrive.
async function streamConciergeMessage(ref: string, message: string, resume: boolean, onText: (text: string) => void): Promise<string> {
  const response = await fetch(`/api/concierge/sessions/${encodeURIComponent(ref)}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message,
      formState: isApplyRoute.value ? snapshotApplicationForm() : null,
      pageContext: snapshotPage(route.path),
      resumeTranscript: resume ? transcriptForResume() : null,
      stream: true,
    }),
  });
  if (!response.ok || !response.body) {
    const failure = new Error(`The assistant request failed (${response.status}).`) as Error & {
      statusCode?: number;
    };
    failure.statusCode = response.status;
    throw failure;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let finalMessage: string | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');
      const data = frame.split('\n').find((line) => line.startsWith('data: '));
      if (!data) continue;
      const payload = JSON.parse(data.slice(6)) as {
        delta?: string;
        text?: string;
        done?: boolean;
        message?: string;
        error?: string;
      };
      if (payload.error) throw new Error(payload.error);
      if (typeof payload.text === 'string') {
        accumulated = payload.text;
        onText(accumulated);
      } else if (typeof payload.delta === 'string') {
        accumulated += payload.delta;
        onText(accumulated);
      }
      if (payload.done) finalMessage = payload.message ?? accumulated;
    }
  }
  if (finalMessage === null || finalMessage.trim() === '') {
    // An empty final message means the model produced no visible text
    // (e.g. its output budget went entirely on reasoning); surface an error
    // instead of a silent turn.
    throw new Error('The assistant reply ended unexpectedly. Please try again.');
  }
  return finalMessage;
}

async function sendConciergeTurn(message: string, onText: (text: string) => void): Promise<string> {
  const ref = await ensureConciergeSession();
  try {
    return await streamConciergeMessage(ref, message, false, onText);
  } catch (error) {
    // dr-001 (D047): the server lost this session (restart/redeploy). Open a
    // fresh one, replay our transcript as context, and retry the turn once.
    if ((error as { statusCode?: number }).statusCode !== 404) throw error;
    conciergeSessionRef.value = null;
    const freshRef = await ensureConciergeSession();
    return await streamConciergeMessage(freshRef, message, true, onText);
  }
}

function maybeApplyIntro(): void {
  if (!isApplyRoute.value || !isOpen.value) return;
  if (!conciergeAvailable.value || applyIntroDone.value) return;
  applyIntroDone.value = true;
  pushMessage('assistant', APPLY_INTRO);
}

async function submit(text: string, { forceEngine = false }: { forceEngine?: boolean } = {}): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed || isSending.value || isChatComplete.value) return;

  errorMessage.value = '';
  pushMessage('customer', trimmed);
  isSending.value = true;

  try {
    if (!forceEngine && !isContactRoute.value && conciergeAvailable.value) {
      // Concierge mode (D046): every route except /contact/ (the validated
      // engine keeps the support chat). Page snapshot as context; form
      // snapshot additionally on /apply/. No engine, no telemetry, no UiPlan.
      // dr-002 (D047): the reply streams into a live message bubble; the
      // thinking dots yield to it at the first delta.
      const reply = await sendConciergeTurn(trimmed, (text) => {
        const streaming = streamingMessageId.value === null ? null : messages.value.find((entry) => entry.id === streamingMessageId.value);
        if (streaming) {
          streaming.text = text;
        } else {
          pushMessage('assistant', text);
          streamingMessageId.value = messages.value.at(-1)?.id ?? null;
        }
        scrollToEnd();
      });
      const streamed = streamingMessageId.value === null ? null : messages.value.find((entry) => entry.id === streamingMessageId.value);
      if (streamed) {
        streamed.text = reply;
      } else {
        pushMessage('assistant', reply);
      }
      streamingMessageId.value = null;
      applyOfferMessageId.value = null;
      handoffOfferMessageId.value = /support team/i.test(reply) ? (messages.value.at(-1)?.id ?? null) : null;
      navOffer.value = handoffOfferMessageId.value === null ? navOfferForReply(reply, route.path) : null;
      navOfferMessageId.value = navOffer.value !== null ? (messages.value.at(-1)?.id ?? null) : null;
      return;
    }
    const ref = await ensureSession();
    const result = await $fetch<IpocSendMessageResponse>(`/api/ipoc/sessions/${encodeURIComponent(ref)}/messages`, { method: 'POST', body: { message: trimmed } });
    if (result.ticket) activeTicketId.value = result.ticket.id;
    pushMessage('assistant', withContactAvailability(result.assistant.message), result.assistant.ui);
    emitTelemetry(result.assistant.telemetry);
    const showApplyOffer = !replyAlreadyLinksApplication(result.assistant.ui) && applyOfferEligible(result.assistant.telemetry);
    applyOfferMessageId.value = showApplyOffer ? (messages.value.at(-1)?.id ?? null) : null;
    handoffOfferMessageId.value = null;
    navOffer.value = null;
    navOfferMessageId.value = null;
  } catch (error) {
    // A reply that errored mid-stream leaves a partial bubble; drop it so
    // the transcript (and any dr-001 replay of it) holds only whole turns.
    if (streamingMessageId.value !== null) {
      const index = messages.value.findIndex((entry) => entry.id === streamingMessageId.value);
      if (index !== -1) messages.value.splice(index, 1);
      streamingMessageId.value = null;
    }
    errorMessage.value = error instanceof Error ? error.message : 'Something went wrong reaching the assistant. Please try again.';
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
    const result = await $fetch<IpocSubmitIntakeResponse>(`/api/ipoc/sessions/${encodeURIComponent(sessionRef.value)}/intake`, {
      method: 'POST',
      body: { ticketId: activeTicketId.value, fields: values },
    });
    pushMessage('customer', 'Shared my contact details.');
    emitTelemetry(result.telemetry);
    const confirmation = result.messages.at(-1);
    pushMessage(
      'assistant',
      `${confirmation?.role === 'assistant' ? confirmation.content : 'Thanks — our support team will take it from here.'}\n\n${CONTACT_COMPLETE_AVAILABILITY_NOTE}`,
    );
    isChatComplete.value = true;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Something went wrong sharing your details. Please try again.';
  } finally {
    isSending.value = false;
  }
}

async function onIntakeCancel(): Promise<void> {
  if (isSending.value || isChatComplete.value || !sessionRef.value) return;
  errorMessage.value = '';

  try {
    await $fetch<IpocSessionResponse>(`/api/ipoc/sessions/${encodeURIComponent(sessionRef.value)}/cancel-handoff`, { method: 'POST' });
    pushMessage('assistant', withContactAvailability('No problem - ask me anything else about your loan.'), null);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Something went wrong cancelling the handoff. Please try again.';
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
  navOffer.value = null;
  navOfferMessageId.value = null;
  messages.value = [];
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort
  }
  pushMessage('assistant', currentWelcome());
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
  if (CONTACT_CLOSE_REVEAL_ENABLED) {
    document.getElementById('contact-section')?.removeAttribute('data-revealed');
  }
  focusInput();
}

function closePanel(): void {
  isOpen.value = false;
  document.body.classList.remove('mal-open');
  if (!CONTACT_CLOSE_REVEAL_ENABLED) return;
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
  ensureContextWelcome();
  if (!now && prev && isOpen.value) focusInput();
});

watch([isApplyRoute, isOpen, conciergeAvailable], () => {
  // Arrival introduction (D045): fires when the open panel reaches /apply/
  // (chat-driven navigation) or when the panel is first opened there.
  maybeApplyIntro();
});

watch(
  // isSending is in the key so the send that finalizes a streamed reply
  // (text mutation, no length change) still persists the finished turn.
  () => [messages.value.length, sessionRef.value, conciergeSessionRef.value, isSending.value] as const,
  () => persistState(),
);

onMounted(async () => {
  if (!restoreState()) pushMessage('assistant', currentWelcome());
  else ensureContextWelcome();
  window.addEventListener('mal:open-route-finder', handleRouteFinderOpen);
  try {
    const status = await $fetch<ConciergeStatusResponse>('/api/concierge/status');
    conciergeAvailable.value = status.enabled;
  } catch {
    conciergeAvailable.value = false;
  }
});

function handleRouteFinderOpen(event: Event): void {
  ensureContextWelcome();
  openPanel();
  const topic = (event as CustomEvent<{ topic?: RouteFinderTopic }>).detail?.topic;
  if (topic?.title) pushTopicPrimer(topic);
}

onBeforeUnmount(() => {
  window.removeEventListener('mal:open-route-finder', handleRouteFinderOpen);
});
</script>

<style src="../assets/chat-widget.css"></style>
