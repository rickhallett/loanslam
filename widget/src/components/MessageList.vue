<script setup lang="ts">
import type { ChatMessage } from '../state/useChat.js';
import MessageBubble from './MessageBubble.vue';

defineProps<{
  messages: ChatMessage[];
  loading: boolean;
}>();
</script>

<template>
  <div class="message-list" role="log" aria-live="polite" aria-label="Conversation">
    <MessageBubble v-for="m in messages" :key="m.id" :message="m" />
    <div v-if="loading" class="message-list__typing" aria-label="Assistant is typing">
      <span class="dot" />
      <span class="dot" />
      <span class="dot" />
    </div>
  </div>
</template>
