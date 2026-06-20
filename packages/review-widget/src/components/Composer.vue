<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{ disabled: boolean }>();
const emit = defineEmits<{ send: [text: string] }>();

const text = ref("");

function submit(): void {
  const value = text.value.trim();
  if (!value || props.disabled) {
    return;
  }
  emit("send", value);
  text.value = "";
}
</script>

<template>
  <form class="composer" @submit.prevent="submit">
    <input
      v-model="text"
      type="text"
      placeholder="Type your message…"
      autocomplete="off"
      aria-label="Message"
      :disabled="disabled"
    />
    <button
      class="composer-send"
      type="submit"
      :disabled="disabled || text.trim().length === 0"
      aria-label="Send message"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
        <path fill="currentColor" d="M3 20.5 21 12 3 3.5 3 10l12 2-12 2z" />
      </svg>
    </button>
  </form>
</template>
