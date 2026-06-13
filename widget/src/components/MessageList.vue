<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

import type { ChatMessage } from '@loanslam/contracts';

const props = defineProps<{
  messages: ChatMessage[];
}>();

const listElement = ref<HTMLOListElement | null>(null);

watch(
  () => props.messages.length,
  async () => {
    await nextTick();
    const element = listElement.value;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  },
);
</script>

<template>
  <ol ref="listElement" class="message-list" aria-live="polite">
    <li
      v-for="message in messages"
      :key="message.id"
      class="message"
      :class="`message--${message.role}`"
    >
      <p>{{ message.text }}</p>
      <ul v-if="message.citations?.length" class="citation-list" aria-label="Sources">
        <li v-for="citation in message.citations" :key="citation.sourceId">
          <a v-if="citation.url" :href="citation.url" target="_blank" rel="noreferrer">
            {{ citation.title }}
          </a>
          <span v-else>{{ citation.title }}</span>
        </li>
      </ul>
    </li>
  </ol>
</template>
