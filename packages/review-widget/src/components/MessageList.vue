<script setup lang="ts">
import { nextTick, ref, watch } from "vue";

import type { IntakeField, UiPlan } from "@loanslam/contracts";

import MessagePrimitive from "./MessagePrimitive.vue";

interface ChatMessage {
  id: number;
  role: "customer" | "assistant";
  text: string;
  ui?: UiPlan | null;
}

const props = defineProps<{
  messages: ChatMessage[];
  thinking: boolean;
}>();

const emit = defineEmits<{
  choose: [label: string];
  intakeSubmit: [values: Record<IntakeField, string>];
  intakeCancel: [];
}>();

const scroller = ref<HTMLElement | null>(null);

watch(
  () => [props.messages.length, props.thinking] as const,
  async () => {
    await nextTick();
    const element = scroller.value;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  },
);
</script>

<template>
  <ul ref="scroller" class="message-list">
    <li
      v-for="(message, index) in messages"
      :key="message.id"
      :class="[
        'message',
        message.role === 'customer' ? 'message-user' : 'message-assistant',
      ]"
    >
      <span class="message-text">{{ message.text }}</span>

      <!-- The turn's primitive lives inside the message it belongs to, so a tall
           intake form scrolls with the conversation instead of floating over it.
           Only the latest assistant turn keeps an interactive primitive. -->
      <MessagePrimitive
        v-if="index === messages.length - 1 && message.role === 'assistant'"
        :ui="message.ui ?? null"
        @choose="emit('choose', $event)"
        @intake-submit="emit('intakeSubmit', $event)"
        @intake-cancel="emit('intakeCancel')"
      />
    </li>

    <li
      v-if="thinking"
      class="message message-assistant thinking-bubble"
      aria-label="Assistant is typing"
    >
      <span class="thinking-dots"><span></span><span></span><span></span></span>
    </li>
  </ul>
</template>
