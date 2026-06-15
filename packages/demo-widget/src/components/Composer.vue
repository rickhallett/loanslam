<script setup lang="ts">
import { nextTick, ref, watch } from "vue";

// `sending` = a turn is in flight (assistant thinking); `locked` = the chat has
// reached its terminal handoff state. Keeping focus in the input across a turn
// needs two things: (1) the input is never disabled while sending, and (2) the
// Send button must not steal focus on click (@mousedown.prevent) — otherwise the
// button becomes the focused element and then gets disabled mid-send, which
// drops focus to <body>. As a backstop we also return focus to the input when
// the turn completes. Double-submit is still prevented (the button is disabled
// while sending, and submit() ignores input until the turn completes).
const props = defineProps<{ sending: boolean; locked: boolean }>();
const emit = defineEmits<{ send: [text: string] }>();

const text = ref("");
const inputEl = ref<HTMLInputElement | null>(null);

function submit(): void {
  const value = text.value.trim();
  if (!value || props.sending || props.locked) {
    return;
  }
  emit("send", value);
  text.value = "";
}

// When a turn finishes (sending true -> false), return focus to the input so the
// customer can keep typing without clicking back into it.
watch(
  () => props.sending,
  (now, prev) => {
    if (prev && !now && !props.locked) {
      void nextTick(() => inputEl.value?.focus());
    }
  },
);
</script>

<template>
  <form class="ls-composer" @submit.prevent="submit">
    <input
      ref="inputEl"
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
      @mousedown.prevent
    >
      Send
    </button>
  </form>
</template>
