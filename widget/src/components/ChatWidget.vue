<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';

import type { ChatMessage, ChatResponse, HandoffIntakeForm } from '@loanslam/contracts';

import { createChatClient, type WidgetChatClient } from '../api/chat-client.js';
import IntakeForm from './IntakeForm.vue';
import MessageList from './MessageList.vue';

const props = defineProps<{
  client?: WidgetChatClient;
}>();

const client = props.client ?? createChatClient();
const messages = ref<ChatMessage[]>([]);
const form = ref<HandoffIntakeForm | null>(null);
const messageText = ref('');
const intakeValues = ref<Record<string, string>>({});
const loading = ref(false);
const errorMessage = ref<string | null>(null);
const open = ref(true);

const canSend = computed(() => messageText.value.trim().length > 0 && !loading.value);

onMounted(async () => {
  try {
    loading.value = true;
    applyResponse(await client.createSession());
    postWidgetEvent('loanslam:ready');
  } catch {
    errorMessage.value = 'We cannot start chat right now. Please contact Loanslam support.';
  } finally {
    loading.value = false;
    await emitResize();
  }
});

async function sendMessage(): Promise<void> {
  const text = messageText.value.trim();
  if (!text || loading.value) {
    return;
  }

  messages.value.push({
    id: `local_${Date.now()}`,
    role: 'user',
    text,
    createdAt: new Date().toISOString(),
  });
  messageText.value = '';
  await runClientCall(() => client.sendMessage(text));
}

async function submitIntake(): Promise<void> {
  await runClientCall(() => client.submitIntake({ ...intakeValues.value }));
  intakeValues.value = {};
}

async function resetChat(): Promise<void> {
  await runClientCall(() => client.reset());
  intakeValues.value = {};
  messageText.value = '';
}

async function runClientCall(action: () => Promise<ChatResponse>): Promise<void> {
  try {
    loading.value = true;
    errorMessage.value = null;
    applyResponse(await action());
  } catch {
    errorMessage.value = 'That did not go through. Please try again or contact support.';
  } finally {
    loading.value = false;
    await emitResize();
  }
}

function updateIntakeValue(name: string, value: string): void {
  intakeValues.value = { ...intakeValues.value, [name]: value };
}

function applyResponse(response: ChatResponse): void {
  messages.value.push(...response.messages);
  form.value = response.state === 'awaiting_handoff_intake' ? response.form : null;
}

function closeWidget(): void {
  open.value = false;
  postWidgetEvent('loanslam:close');
}

async function emitResize(): Promise<void> {
  await nextTick();
  postWidgetEvent('loanslam:resize', {
    height: document.documentElement.scrollHeight,
  });
}

function postWidgetEvent(type: string, payload: Record<string, unknown> = {}): void {
  window.parent.postMessage({ type, ...payload }, '*');
}
</script>

<template>
  <section v-if="open" class="chat-shell" aria-label="Loanslam support chat">
    <header class="chat-header">
      <div>
        <p class="eyebrow">Loanslam</p>
        <h1>Support chat</h1>
      </div>
      <button class="icon-button" type="button" aria-label="Close chat" @click="closeWidget">
        ×
      </button>
    </header>

    <MessageList :messages="messages" />

    <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>

    <IntakeForm
      v-if="form"
      :form="form"
      :values="intakeValues"
      :disabled="loading"
      @submit="submitIntake"
      @update="updateIntakeValue"
    />

    <form class="message-form" data-testid="message-form" @submit.prevent="sendMessage">
      <label class="field">
        <span>Message</span>
        <textarea
          v-model="messageText"
          name="message"
          rows="2"
          :disabled="loading"
          autocomplete="off"
        />
      </label>
      <div class="actions">
        <button class="secondary-action" type="button" :disabled="loading" @click="resetChat">
          Reset
        </button>
        <button class="primary-action" type="submit" :disabled="!canSend">Send</button>
      </div>
    </form>
  </section>
</template>
