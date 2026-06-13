<script setup lang="ts">
import { computed } from 'vue';
import type { ChatMessage } from '../state/useChat.js';

const props = defineProps<{ message: ChatMessage }>();

const isCustomer = computed(() => props.message.author === 'customer');
const reply = computed(() => props.message.reply);
const mode = computed(() => reply.value?.mode ?? null);

// Narrowed accessors. Discriminated-union fields only exist on certain modes;
// we read them off the reply guarded by `mode` so types stay sound.
const citations = computed(() =>
  reply.value && reply.value.mode === 'answer' ? reply.value.citations : [],
);
const answerLinks = computed(() =>
  reply.value && reply.value.mode === 'answer' ? reply.value.links : [],
);
const supportLinks = computed(() =>
  reply.value && reply.value.mode === 'vulnerability' ? reply.value.links : [],
);
const ticketRef = computed(() =>
  reply.value && reply.value.mode === 'handoff' ? reply.value.ticketRef : null,
);

// Defence in depth: only ever render a link whose scheme is one we expect from
// the approved KB (http/https/mailto/tel). A stray `javascript:` href is dropped
// to a non-clickable label rather than bound into the anchor. The KB is trusted,
// but the frontend should never render an arbitrary scheme.
const SAFE_SCHEME = /^(https?:|mailto:|tel:)/i;
function safeHref(href: string): string | null {
  const trimmed = href.trim();
  return SAFE_SCHEME.test(trimmed) ? trimmed : null;
}
</script>

<template>
  <div
    class="bubble"
    :class="[isCustomer ? 'bubble--customer' : 'bubble--bot', mode ? `bubble--${mode}` : '']"
  >
    <p class="bubble__text">{{ message.text }}</p>

    <!-- answer: text + a small Sources line listing cited questions and links -->
    <div v-if="mode === 'answer'" class="bubble__sources">
      <p class="bubble__sources-label">Sources</p>
      <ul class="bubble__citations">
        <li v-for="c in citations" :key="c.itemId" class="bubble__citation">
          {{ c.question }}
        </li>
      </ul>
      <ul v-if="answerLinks.length" class="bubble__links">
        <li v-for="link in answerLinks" :key="link.href">
          <a
            v-if="safeHref(link.href)"
            :href="safeHref(link.href) ?? undefined"
            target="_blank"
            rel="noopener noreferrer"
            >{{ link.label }}</a
          >
          <span v-else>{{ link.label }}</span>
        </li>
      </ul>
    </div>

    <!-- vulnerability: empathetic text + support links shown prominently -->
    <div v-if="mode === 'vulnerability' && supportLinks.length" class="bubble__support">
      <p class="bubble__support-label">Free, confidential support</p>
      <ul class="bubble__support-links">
        <li v-for="link in supportLinks" :key="link.href">
          <a
            v-if="safeHref(link.href)"
            :href="safeHref(link.href) ?? undefined"
            target="_blank"
            rel="noopener noreferrer"
            >{{ link.label }}</a
          >
          <span v-else>{{ link.label }}</span>
        </li>
      </ul>
    </div>

    <!-- handoff: text + the ticket reference -->
    <p v-if="mode === 'handoff' && ticketRef" class="bubble__ticket">
      Reference: <span class="bubble__ticket-ref">{{ ticketRef }}</span>
    </p>
  </div>
</template>
