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
  intakeSubmit: [values: Partial<Record<IntakeField, string>>];
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
  <div ref="scroller" class="ls-messages">
    <div
      v-for="(message, index) in messages"
      :key="message.id"
      :class="['ls-msg', `ls-msg--${message.role}`]"
    >
      <div class="ls-msg__content">
        <div class="ls-bubble">{{ message.text }}</div>

        <!-- The turn's primitive lives inside the message it belongs to, so it
             scrolls with the conversation instead of floating over it. Only the
             latest assistant turn keeps an interactive primitive. -->
        <MessagePrimitive
          v-if="index === messages.length - 1 && message.role === 'assistant'"
          :ui="message.ui ?? null"
          @choose="emit('choose', $event)"
          @intake-submit="emit('intakeSubmit', $event)"
        />
      </div>
    </div>

    <div v-if="thinking" class="ls-msg ls-msg--assistant">
      <div class="ls-msg__content">
        <div
          class="ls-bubble ls-bubble--thinking"
          aria-label="Assistant is typing"
        >
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  </div>
</template>
