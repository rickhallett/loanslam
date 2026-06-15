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
} from "./hostBridge";

interface ChatMessage {
  id: number;
  role: "customer" | "assistant";
  text: string;
  ui?: UiPlan | null;
}

const WELCOME =
  "Hi, I'm the LoanSlam assistant. I can answer general questions about our loans and point you to the right place for anything account-specific. How can I help?";

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

async function onIntakeSubmit(
  values: Record<IntakeField, string>,
): Promise<void> {
  if (isSending.value || isChatComplete.value) {
    return;
  }

  errorMessage.value = "";
  isSending.value = true;

  try {
    const reference = await ensureSession();
    const result = await submitIntake(reference, values);
    pushMessage("customer", "Shared my contact details.");
    pushMessage("assistant", result.customerMessage, result.ui);
    isChatComplete.value = true;
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
    const reference = await ensureSession();
    await cancelHandoff(reference);
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
  <div class="ls-widget">
    <header class="ls-widget__header">
      <div class="ls-brand">
        <span class="ls-brand__mark" aria-hidden="true">LS</span>
        <span class="ls-brand__text">
          <span class="ls-brand__name">LoanSlam</span>
          <span class="ls-brand__tag">Support assistant</span>
        </span>
      </div>
      <div class="ls-widget__actions">
        <button
          class="ls-iconbtn"
          type="button"
          title="Start over"
          aria-label="Start over"
          @click="reset"
        >
          &#8635;
        </button>
        <button
          class="ls-iconbtn"
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

    <p v-if="errorMessage" class="ls-error" role="alert">{{ errorMessage }}</p>
    <p v-if="isChatComplete" class="ls-terminal">
      This handoff is complete. Refresh or start over to begin a new chat.
    </p>

    <Composer :sending="isSending" :locked="isChatComplete" @send="submit" />
  </div>
</template>
