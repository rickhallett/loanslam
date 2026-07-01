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
          <p v-if="intakeStatus" class="status success">{{ intakeStatus }}</p>
        </section>

        <form
          v-if="activeCaptureTicket"
          class="capture-form"
          aria-label="Capture handoff details"
          @submit.prevent="submitIntake"
        >
          <header>
            <p class="eyebrow">Demo capture form</p>
            <h2>Handoff details for {{ activeCaptureTicket.id }}</h2>
          </header>
          <p class="form-note">
            Synthetic demo fields only. Do not enter real customer details.
          </p>
          <div class="field-grid">
            <label
              v-for="field in handoffFieldInputs"
              :key="field.name"
              :for="`capture-${field.name}`"
            >
              <span>{{ field.label }}</span>
              <input
                :id="`capture-${field.name}`"
                v-model="captureFields[field.name]"
                :type="field.type"
                :autocomplete="field.autocomplete"
              />
            </label>
          </div>
          <button type="submit" :disabled="isSubmittingIntake">
            {{ isSubmittingIntake ? "Capturing" : "Capture for agent" }}
          </button>
        </form>

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
          <section
            v-if="selectedTicket.structuredIntake"
            class="intake-readback"
            aria-label="Captured intake"
          >
            <h3>Captured intake</h3>
            <dl>
              <div v-for="field in handoffFieldInputs" :key="field.name">
                <dt>{{ field.label }}</dt>
                <dd>{{ selectedTicket.structuredIntake.fields[field.name] }}</dd>
              </div>
            </dl>
            <p>Synthetic demo fields only. No real customer PII.</p>
          </section>
        </section>
      </aside>
    </section>
  </main>
</template>

<script setup lang="ts">
import type {
  IpocChatMessage,
  IpocHandoffField,
  IpocHandoffIntake,
  IpocSendMessageResponse,
  IpocSessionResponse,
  IpocSubmitIntakeResponse,
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
const isSubmittingIntake = ref(false);
const errorMessage = ref<string | null>(null);
const lastTicket = ref<IpocTicket | null>(null);
const intakeStatus = ref<string | null>(null);
const captureFields = ref<IpocHandoffIntake>(defaultCaptureFields());

const handoffFieldInputs: Array<{
  name: IpocHandoffField;
  label: string;
  type: string;
  autocomplete: string;
}> = [
  {
    name: "fullName",
    label: "Full name",
    type: "text",
    autocomplete: "off",
  },
  {
    name: "dateOfBirth",
    label: "Date of birth",
    type: "date",
    autocomplete: "off",
  },
  {
    name: "postcode",
    label: "Postcode",
    type: "text",
    autocomplete: "off",
  },
  {
    name: "email",
    label: "Email",
    type: "email",
    autocomplete: "off",
  },
  {
    name: "phone",
    label: "Phone",
    type: "tel",
    autocomplete: "off",
  },
];

const selectedTicket = computed(() => {
  return tickets.value.find((ticket) => ticket.id === selectedTicketId.value) ?? null;
});

const activeCaptureTicket = computed(() => {
  if (!lastTicket.value || lastTicket.value.structuredIntake) {
    return null;
  }

  return lastTicket.value;
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
  intakeStatus.value = null;

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
      captureFields.value = defaultCaptureFields();
    }

    await refreshTickets();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "The engine route failed.";
  } finally {
    isSending.value = false;
  }
}

async function submitIntake() {
  if (!conversationRef.value || !activeCaptureTicket.value) {
    return;
  }

  isSubmittingIntake.value = true;
  errorMessage.value = null;
  intakeStatus.value = null;

  try {
    const response = await $fetch<IpocSubmitIntakeResponse>(
      `/api/ipoc/sessions/${encodeURIComponent(conversationRef.value)}/intake`,
      {
        method: "POST",
        body: {
          ticketId: activeCaptureTicket.value.id,
          fields: captureFields.value,
        },
      },
    );
    messages.value = response.messages;
    lastTicket.value = response.ticket;
    selectedTicketId.value = response.ticket.id;
    intakeStatus.value = `Captured synthetic intake for ticket ${response.ticket.id}.`;
    await refreshTickets();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "The capture route failed.";
  } finally {
    isSubmittingIntake.value = false;
  }
}

async function refreshTickets() {
  const response = await $fetch<IpocTicketListResponse>("/api/ipoc/admin/tickets");
  tickets.value = response.tickets;

  if (!selectedTicketId.value && response.tickets[0]) {
    selectedTicketId.value = response.tickets[0].id;
  }
}

function defaultCaptureFields(): IpocHandoffIntake {
  return {
    fullName: "Demo Applicant",
    dateOfBirth: "1990-01-01",
    postcode: "AB12 3CD",
    email: "demo.applicant@example.invalid",
    phone: "07000000000",
  };
}
</script>
