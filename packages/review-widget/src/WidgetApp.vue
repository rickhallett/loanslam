<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

import type {
  DemoSessionResponse,
  DemoTurnResponse,
  IntakeField,
  UiPlan,
} from "@loanslam/contracts";

import Composer from "./components/Composer.vue";
import MessageList from "./components/MessageList.vue";
import {
  cancelHandoff,
  createSession,
  resetSession,
  sendMessage as engineSend,
  submitIntake,
} from "./engineClient";
import {
  announceReady,
  contextForTurn,
  onHostMessage,
  requestClose,
  sendContext,
  sendTurnTelemetry,
} from "./hostBridge";

// This is the original review widget Sam saw (MAL-branded chrome), but the
// transport is the demo-safe loanslam API: same engineClient + hostBridge +
// /demo proxy as packages/demo-widget. The widget is a "dumb terminal" — it
// owns only rendering and local interaction state; the server owns routing,
// safety, and every UI primitive it returns.

interface ChatMessage {
  id: number;
  role: "customer" | "assistant";
  text: string;
  ui?: UiPlan | null;
}

const WELCOME =
  "Hi, I'm the LoanSlam assistant. I can answer general questions about our loans and point you to the right team for anything account-specific. How can I help?";

const messages = ref<ChatMessage[]>([]);
const sessionRef = ref<string | null>(null);
const continuationToken = ref<string | null>(null);
const isSending = ref(false);
const isChatComplete = ref(false);
const errorMessage = ref("");
const composerEl = ref<InstanceType<typeof Composer> | null>(null);

let nextId = 0;

function pushMessage(
  role: ChatMessage["role"],
  text: string,
  ui: UiPlan | null = null,
): void {
  messages.value.push({ id: nextId++, role, text, ui });
}

async function ensureSession(): Promise<DemoSessionResponse> {
  if (sessionRef.value) {
    return {
      conversationRef: sessionRef.value,
      ...(continuationToken.value
        ? { continuationToken: continuationToken.value }
        : {}),
    };
  }
  const session = await createSession();
  storeSession(session);
  return session;
}

function storeSession(session: DemoSessionResponse): void {
  sessionRef.value = session.conversationRef;
  continuationToken.value = session.continuationToken ?? null;
}

function storeResult(result: DemoTurnResponse): void {
  if (result.continuationToken) {
    continuationToken.value = result.continuationToken;
  }
}

function handleResult(result: DemoTurnResponse): void {
  storeResult(result);
  pushMessage("assistant", result.customerMessage, result.ui);
  isChatComplete.value = result.terminalSession;
  sendContext(contextForTurn(result));
  sendTurnTelemetry(result.telemetry);
}

async function submit(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed || isSending.value || isChatComplete.value) {
    return;
  }

  errorMessage.value = "";
  pushMessage("customer", trimmed);
  isSending.value = true;

  try {
    const session = await ensureSession();
    handleResult(
      await engineSend(
        session.conversationRef,
        trimmed,
        session.continuationToken,
      ),
    );
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Something went wrong reaching the assistant. Please try again.";
  } finally {
    isSending.value = false;
  }
}

function choose(label: string): void {
  void submit(label);
}

async function onIntakeSubmit(
  values: Record<IntakeField, string>,
): Promise<void> {
  if (isSending.value || isChatComplete.value) {
    return;
  }

  errorMessage.value = "";
  isSending.value = true;

  try {
    const session = await ensureSession();
    const result = await submitIntake(
      session.conversationRef,
      values,
      session.continuationToken,
    );
    storeResult(result);
    pushMessage("customer", "Shared my contact details.");
    pushMessage("assistant", result.customerMessage, result.ui);
    isChatComplete.value = result.terminalSession;
    sendContext(contextForTurn(result));
    sendTurnTelemetry(result.telemetry);
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Something went wrong sharing your details. Please try again.";
  } finally {
    isSending.value = false;
  }
}

async function onIntakeCancel(): Promise<void> {
  if (isSending.value || isChatComplete.value) {
    return;
  }

  errorMessage.value = "";

  try {
    const session = await ensureSession();
    storeSession(
      await cancelHandoff(session.conversationRef, session.continuationToken),
    );
    pushMessage(
      "assistant",
      "No problem — ask me anything else about your LoanSlam loan.",
      null,
    );
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Something went wrong cancelling the handoff. Please try again.";
  }
}

async function reset(): Promise<void> {
  if (sessionRef.value) {
    try {
      await resetSession(
        sessionRef.value,
        continuationToken.value ?? undefined,
      );
    } catch {
      // A failed reset on the demo API is non-fatal for the demo; we still
      // clear the local view and start a fresh session on the next message.
    }
  }
  sessionRef.value = null;
  continuationToken.value = null;
  isChatComplete.value = false;
  errorMessage.value = "";
  messages.value = [];
  pushMessage("assistant", WELCOME);
}

let stopHostListener: (() => void) | null = null;

stopHostListener = onHostMessage((message) => {
  if (message.type === "example" && typeof message.prompt === "string") {
    void submit(message.prompt);
  } else if (message.type === "open") {
    // Host revealed the panel — put the cursor in the composer so the reviewer
    // can type immediately after every page load.
    composerEl.value?.focusInput();
  }
});

onMounted(() => {
  pushMessage("assistant", WELCOME);
  announceReady();
});

onUnmounted(() => {
  stopHostListener?.();
});
</script>

<template>
  <main class="widget-shell" aria-label="LoanSlam chat widget">
    <section class="chat-panel">
      <header class="chat-header">
        <div>
          <p class="eyebrow">LoanSlam chat</p>
          <h1>LoanSlam assistant</h1>
          <p class="chat-status">Prototype support chat</p>
        </div>
        <div class="chat-header-actions">
          <button
            type="button"
            title="Start over"
            aria-label="Start over"
            @click="reset"
          >
            &#8635;
          </button>
          <button
            type="button"
            title="Close"
            aria-label="Close chat"
            @click="requestClose"
          >
            &times;
          </button>
        </div>
      </header>

      <MessageList
        :messages="messages"
        :thinking="isSending"
        @choose="choose"
        @intake-submit="onIntakeSubmit"
        @intake-cancel="onIntakeCancel"
      />

      <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
      <p v-if="isChatComplete" class="terminal-note">
        This handoff is complete. Refresh or start over to begin a new chat.
      </p>

      <p class="uat-notice uat-notice-composer">
        Prototype — conversations are recorded. Please use test details only.
      </p>

      <Composer
        ref="composerEl"
        :sending="isSending"
        :locked="isChatComplete"
        @send="submit"
      />
    </section>
  </main>
</template>
