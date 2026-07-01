<template>
  <main class="poc-shell">
    <section class="workspace">
      <div class="customer-pane" aria-label="Customer support journey">
        <header class="pane-header">
          <p class="eyebrow">Integrated POC</p>
          <h1>Customer support journey</h1>
        </header>

        <div class="journey-status">
          <span>Application help</span>
          <span>Safe handoff path</span>
          <span>Admin readback</span>
        </div>

        <section class="conversation" aria-label="Conversation">
          <article
            v-for="message in messages"
            :key="message.id"
            class="message"
            :class="message.role"
          >
            <p>{{ message.content }}</p>
          </article>
          <p v-if="errorMessage" class="status error">{{ errorMessage }}</p>
          <p v-else-if="lastTicket" class="status success">
            Ticket {{ lastTicket.id }} is ready for human review.
          </p>
        </section>

        <form class="composer" aria-label="Send support message" @submit.prevent="sendMessage">
          <label for="support-message">Message</label>
          <textarea
            id="support-message"
            v-model="draft"
            rows="4"
          />
          <button type="submit" :disabled="isSending || !draft.trim()">
            {{ isSending ? "Sending" : "Send through engine" }}
          </button>
        </form>
      </div>

      <aside class="admin-pane" aria-label="Admin readback">
        <header class="pane-header">
          <p class="eyebrow">Human agent</p>
          <h2>Ticket readback</h2>
        </header>

        <div v-if="tickets.length === 0" class="empty-state">
          <strong>No ticket context yet</strong>
          <p>
            Support receipts from the golden path will appear here.
          </p>
        </div>

        <div v-else class="ticket-list">
          <button
            v-for="ticket in tickets"
            :key="ticket.id"
            type="button"
            class="ticket-row"
            :class="{ selected: selectedTicket?.id === ticket.id }"
            @click="selectedTicketId = ticket.id"
          >
            <span>{{ ticket.id }}</span>
            <strong>{{ ticket.customerContext.summary }}</strong>
          </button>
        </div>

        <section v-if="selectedTicket" class="ticket-detail" aria-label="Ticket detail">
          <dl>
            <div>
              <dt>Status</dt>
              <dd>{{ selectedTicket.status }}</dd>
            </div>
            <div>
              <dt>Queue</dt>
              <dd>{{ selectedTicket.queue }}</dd>
            </div>
            <div>
              <dt>Action</dt>
              <dd>{{ selectedTicket.engine.finalAction }}</dd>
            </div>
            <div>
              <dt>Serving mode</dt>
              <dd>{{ selectedTicket.engine.servingMode ?? "n/a" }}</dd>
            </div>
          </dl>
          <p>{{ selectedTicket.assistantPreview }}</p>
        </section>
      </aside>
    </section>
  </main>
</template>

<script setup lang="ts">
import type {
  IpocChatMessage,
  IpocSendMessageResponse,
  IpocSessionResponse,
  IpocTicket,
  IpocTicketListResponse,
} from "../shared/ipoc";

const defaultMessage =
  "I need help with my loan application and would like someone to contact me.";

const conversationRef = ref<string | null>(null);
const messages = ref<IpocChatMessage[]>([]);
const tickets = ref<IpocTicket[]>([]);
const selectedTicketId = ref<string | null>(null);
const draft = ref(defaultMessage);
const isSending = ref(false);
const errorMessage = ref<string | null>(null);
const lastTicket = ref<IpocTicket | null>(null);

const selectedTicket = computed(() => {
  return tickets.value.find((ticket) => ticket.id === selectedTicketId.value) ?? null;
});

onMounted(async () => {
  await createSession();
  await refreshTickets();
});

async function createSession() {
  const session = await $fetch<IpocSessionResponse>("/api/ipoc/sessions", {
    method: "POST",
  });
  conversationRef.value = session.conversationRef;
  messages.value = session.messages;
}

async function sendMessage() {
  if (!conversationRef.value || !draft.value.trim()) {
    return;
  }

  isSending.value = true;
  errorMessage.value = null;
  lastTicket.value = null;

  try {
    const response = await $fetch<IpocSendMessageResponse>(
      `/api/ipoc/sessions/${encodeURIComponent(conversationRef.value)}/messages`,
      {
        method: "POST",
        body: { message: draft.value },
      },
    );
    messages.value = response.messages;
    draft.value = "";

    if (response.ticket) {
      lastTicket.value = response.ticket;
      selectedTicketId.value = response.ticket.id;
    }

    await refreshTickets();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "The engine route failed.";
  } finally {
    isSending.value = false;
  }
}

async function refreshTickets() {
  const response = await $fetch<IpocTicketListResponse>("/api/ipoc/admin/tickets");
  tickets.value = response.tickets;

  if (!selectedTicketId.value && response.tickets[0]) {
    selectedTicketId.value = response.tickets[0].id;
  }
}
</script>
