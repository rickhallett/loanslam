<script setup lang="ts">
import { nextTick, ref, watch } from "vue";

// `sending` = a turn is in flight; `locked` = terminal handoff state. To keep the
// keyboard cursor in the input across a turn: (1) never disable the input while
// sending (disabling blurs it), (2) stop the Send button stealing focus on click
// (@mousedown.prevent) so it can't become the focused element and then get
// disabled mid-send, and (3) return focus to the input when the turn completes.
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
  <form class="composer" @submit.prevent="submit">
    <input
      ref="inputEl"
      v-model="text"
      type="text"
      placeholder="Type your message…"
      autocomplete="off"
      aria-label="Message"
      :disabled="locked"
    />
    <button
      class="composer-send"
      type="submit"
      :disabled="sending || locked || text.trim().length === 0"
      aria-label="Send message"
      @mousedown.prevent
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
        <path fill="currentColor" d="M3 20.5 21 12 3 3.5 3 10l12 2-12 2z" />
      </svg>
    </button>
  </form>
</template>
