<script setup lang="ts">
import { ref } from "vue";

// `sending` = a turn is in flight (assistant thinking); `locked` = the chat has
// reached its terminal handoff state. We deliberately do NOT disable the input
// while sending: disabling blurs it, and restoring focus into a sandboxed
// cross-origin iframe is unreliable. Keeping it enabled means focus is never
// lost. Double-submit is still prevented (the Send button is disabled while
// sending, and submit() ignores input until the turn completes).
const props = defineProps<{ sending: boolean; locked: boolean }>();
const emit = defineEmits<{ send: [text: string] }>();

const text = ref("");

function submit(): void {
  const value = text.value.trim();
  if (!value || props.sending || props.locked) {
    return;
  }
  emit("send", value);
  text.value = "";
}
</script>

<template>
  <form class="ls-composer" @submit.prevent="submit">
    <input
      v-model="text"
      class="ls-input"
      type="text"
      placeholder="Type your message…"
      autocomplete="off"
      aria-label="Message"
      :disabled="locked"
    />
    <button
      class="ls-send"
      type="submit"
      :disabled="sending || locked || text.trim().length === 0"
      aria-label="Send message"
    >
      Send
    </button>
  </form>
</template>
