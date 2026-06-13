<script setup lang="ts">
import { onMounted } from 'vue';
import { useChat } from '../state/useChat.js';
import MessageList from './MessageList.vue';
import Composer from './Composer.vue';
import IntakeForm from './IntakeForm.vue';

const chat = useChat();

onMounted(() => {
  void chat.init();
});

function onSend(text: string): void {
  void chat.send(text);
}

function onSubmitForm(values: Record<string, string>): void {
  void chat.submitForm(values);
}

function onReset(): void {
  void chat.reset();
}
</script>

<template>
  <div class="widget">
    <header class="widget__header">
      <div class="widget__brand">
        <span class="widget__logo" aria-hidden="true">LS</span>
        <span class="widget__title">Loanslam support</span>
      </div>
      <button
        type="button"
        class="widget__reset"
        :disabled="chat.loading.value"
        aria-label="Start a new conversation"
        @click="onReset"
      >
        Reset
      </button>
    </header>

    <MessageList
      class="widget__body"
      :messages="chat.messages.value"
      :loading="chat.loading.value"
    />

    <p v-if="chat.error.value" class="widget__error" role="alert">
      {{ chat.error.value }}
    </p>

    <footer class="widget__footer">
      <IntakeForm
        v-if="chat.awaitingIntake.value && chat.activeForm.value"
        :form="chat.activeForm.value"
        :loading="chat.loading.value"
        @submit="onSubmitForm"
      />
      <Composer v-else :loading="chat.loading.value" @send="onSend" />
    </footer>
  </div>
</template>
