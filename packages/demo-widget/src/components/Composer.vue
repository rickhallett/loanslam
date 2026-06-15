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
  <form class="ls-composer" @submit.prevent="submit">
    <input
      v-model="text"
      class="ls-input"
      type="text"
      placeholder="Type your message…"
      autocomplete="off"
      aria-label="Message"
      :disabled="disabled"
    />
    <button
      class="ls-send"
      type="submit"
      :disabled="disabled || text.trim().length === 0"
      aria-label="Send message"
    >
      Send
    </button>
  </form>
</template>
