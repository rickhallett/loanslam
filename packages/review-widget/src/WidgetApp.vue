<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

import type {
  IntakeField,
  UiPlan,
  ValidatedTurnResult,
} from "@loanslam/contracts";

import Composer from "./components/Composer.vue";
import MessageList from "./components/MessageList.vue";
import {
  createSession,
  resetSession,
  sendMessage as engineSend,
} from "./engineClient";
import {
  announceReady,
  contextForTurn,
  onHostMessage,
  requestClose,
  sendContext,
} from "./hostBridge";

// This is the original review widget Sam saw (MAL-branded chrome), but the
// transport is the loanslam engine: same engineClient + hostBridge + /sessions
// proxy as packages/demo-widget. The widget is a "dumb terminal" — it owns only
// rendering and local interaction state; the engine owns routing, safety, and
// every UI primitive it returns.

interface ChatMessage {
  id: number;
  role: "customer" | "assistant";
  text: string;
  ui?: UiPlan | null;
}

const WELCOME =
  "Hi, I'm the MAL assistant. I can answer general questions about our loans and point you to the right team for anything account-specific. How can I help?";

const messages = ref<ChatMessage[]>([]);
const sessionRef = ref<string | null>(null);
const isSending = ref(false);
const isChatComplete = ref(false);
const errorMessage = ref("");

let nextId = 0;

function pushMessage(
  role: ChatMessage["role"],
  text: string,
  ui: UiPlan | null = null,
): void {
  messages.value.push({ id: nextId++, role, text, ui });
}

async function ensureSession(): Promise<string> {
  if (sessionRef.value) {
    return sessionRef.value;
  }
  const reference = await createSession();
  sessionRef.value = reference;
  return reference;
}

function handleResult(result: ValidatedTurnResult): void {
  pushMessage("assistant", result.customerMessage, result.ui);
  isChatComplete.value = isTerminalResult(result);
  sendContext(contextForTurn(result));
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
    const reference = await ensureSession();
    handleResult(await engineSend(reference, trimmed));
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

function onIntakeSubmit(values: Partial<Record<IntakeField, string>>): void {
  const phrasing: Record<IntakeField, string> = {
    fullName: "My full name is",
    dateOfBirth: "My date of birth is",
    address: "My address is",
    phone: "My phone number is",
    email: "My email is",
    situationSummary: "Here is a summary of my situation:",
  };

  const parts = (Object.keys(values) as IntakeField[])
    .map((field) => {
      const value = values[field]?.trim();
      return value ? `${phrasing[field]} ${value}` : null;
    })
    .filter((part): part is string => part !== null);

  if (parts.length > 0) {
    void submit(parts.join(". "));
  }
}

async function reset(): Promise<void> {
  if (sessionRef.value) {
    try {
      await resetSession(sessionRef.value);
    } catch {
      // A failed reset on the lab server is non-fatal for the demo; we still
      // clear the local view and start a fresh session on the next message.
    }
  }
  sessionRef.value = null;
  isChatComplete.value = false;
  errorMessage.value = "";
  messages.value = [];
  pushMessage("assistant", WELCOME);
}

function isTerminalResult(result: ValidatedTurnResult): boolean {
  return (
    result.finalAction === "create_ticket" ||
    result.ui.primitive === "handoff_confirmation"
  );
}

let stopHostListener: (() => void) | null = null;

stopHostListener = onHostMessage((message) => {
  if (message.type === "example" && typeof message.prompt === "string") {
    void submit(message.prompt);
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
  <main class="widget-shell" aria-label="MAL chat widget">
    <section class="chat-panel">
      <header class="chat-header">
        <div>
          <p class="eyebrow">MAL chat</p>
          <h1>MAL assistant</h1>
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
      />

      <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>
      <p v-if="isChatComplete" class="terminal-note">
        This handoff is complete. Refresh or start over to begin a new chat.
      </p>

      <p class="uat-notice uat-notice-composer">
        Prototype — conversations are recorded. Please use test details only.
      </p>

      <Composer :disabled="isSending || isChatComplete" @send="submit" />
    </section>
  </main>
</template>
