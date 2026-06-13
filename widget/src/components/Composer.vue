<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ loading: boolean }>();
const emit = defineEmits<{ (e: 'send', text: string): void }>();

const draft = ref('');

function submit(): void {
  const text = draft.value.trim();
  if (!text || props.loading) return;
  emit('send', text);
  draft.value = '';
}

function onKeydown(event: KeyboardEvent): void {
  // Enter sends; Shift+Enter inserts a newline.
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    submit();
  }
}
</script>

<template>
  <form class="composer" @submit.prevent="submit">
    <textarea
      v-model="draft"
      class="composer__input"
      rows="1"
      placeholder="Type your message…"
      aria-label="Message"
      :disabled="loading"
      @keydown="onKeydown"
    />
    <button
      type="submit"
      class="composer__send"
      :disabled="loading || draft.trim().length === 0"
    >
      Send
    </button>
  </form>
</template>
