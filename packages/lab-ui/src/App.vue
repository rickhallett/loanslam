<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { Download, LoaderCircle, RotateCcw, Send, Server } from "@lucide/vue";

import type {
  RetrievedMatch,
  TurnAction,
  ValidatedTurnResult,
} from "@loanslam/contracts";

type Tone = "danger" | "info" | "muted" | "ok" | "warning";

interface SessionResponse {
  conversationRef: string;
  state: ValidatedTurnResult["state"];
  traces?: ValidatedTurnResult["trace"][];
}

interface LabTurn {
  id: number;
  userMessage: string;
  result: ValidatedTurnResult;
  lanes: LaneStatus[];
}

interface LaneStatus {
  label: string;
  tone: Tone;
  summary: string;
  details: string[];
}

interface DecisionField {
  label: string;
  value: string;
  tone: Tone;
}

const safeNonAnswerActions = new Set<TurnAction>([
  "request_handoff_intake",
  "create_ticket",
  "escalate",
  "refuse",
  "fallback",
]);

const message = ref("");
const sessionRef = ref<string | null>(null);
const turns = ref<LabTurn[]>([]);
const selectedTurnId = ref<number | null>(null);
const isSending = ref(false);
const isResetting = ref(false);
const errorMessage = ref("");
const promptInput = ref<HTMLInputElement | null>(null);

const hasTurns = computed(() => turns.value.length > 0);
const selectedTurn = computed(
  () =>
    turns.value.find((turn) => turn.id === selectedTurnId.value) ??
    turns.value.at(-1) ??
    null,
);
const latestTurn = computed(() => turns.value.at(-1) ?? null);
const sessionLabel = computed(() => sessionRef.value ?? "new session");
const overallTone = computed<Tone>(() => {
  const lanes = latestTurn.value?.lanes ?? [];

  if (lanes.some((lane) => lane.tone === "danger")) {
    return "danger";
  }

  if (lanes.some((lane) => lane.tone === "warning")) {
    return "warning";
  }

  return latestTurn.value ? "ok" : "muted";
});
const canSend = computed(
  () => message.value.trim().length > 0 && !isSending.value,
);
const canExport = computed(() => turns.value.length > 0);

onMounted(() => {
  void focusPrompt();
});

async function submitMessage(): Promise<void> {
  const userMessage = message.value.trim();

  if (!userMessage || isSending.value) {
    return;
  }

  isSending.value = true;
  errorMessage.value = "";

  try {
    const conversationRef = await ensureSession();
    const result = await requestJson<ValidatedTurnResult>(
      `/sessions/${encodeURIComponent(conversationRef)}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ message: userMessage }),
      },
    );
    const turn: LabTurn = {
      id: turns.value.length + 1,
      userMessage,
      result,
      lanes: analyseTurn(result),
    };

    turns.value = [...turns.value, turn];
    selectedTurnId.value = turn.id;
    sessionRef.value = result.conversationRef;
    message.value = "";
  } catch (error) {
    errorMessage.value = formatError(error);
  } finally {
    isSending.value = false;
    await focusPrompt();
  }
}

async function resetConsole(): Promise<void> {
  isResetting.value = true;
  errorMessage.value = "";
  turns.value = [];
  selectedTurnId.value = null;
  sessionRef.value = null;

  try {
    await startSession();
  } catch (error) {
    errorMessage.value = formatError(error);
  } finally {
    isResetting.value = false;
    await focusPrompt();
  }
}

function exportSession(): void {
  if (!canExport.value) {
    return;
  }

  const payload = {
    conversationRef: sessionRef.value,
    exportedAt: new Date().toISOString(),
    turns: turns.value.map((turn) => ({
      id: turn.id,
      userMessage: turn.userMessage,
      result: turn.result,
    })),
  };
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `loanslam-lab-${sessionRef.value ?? "session"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function selectTurn(turnId: number): void {
  selectedTurnId.value = turnId;
}

async function ensureSession(): Promise<string> {
  if (sessionRef.value !== null) {
    return sessionRef.value;
  }

  return startSession();
}

async function startSession(): Promise<string> {
  const session = await requestJson<SessionResponse>("/sessions", {
    method: "POST",
    body: JSON.stringify({}),
  });

  sessionRef.value = session.conversationRef;

  return session.conversationRef;
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      isErrorPayload(payload) && payload.message
        ? payload.message
        : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return payload as T;
}

function isErrorPayload(value: unknown): value is { message?: string } {
  return typeof value === "object" && value !== null && "message" in value;
}

function analyseTurn(result: ValidatedTurnResult): LaneStatus[] {
  const hardIssues = hardSafetyIssues(result);
  const diagnosticIssues = engineDiagnosticIssues(result);
  const uxIssues = uxQualityNotes(result);

  return [
    {
      label: "Hard Safety",
      tone: hardIssues.length > 0 ? "danger" : "ok",
      summary:
        hardIssues.length > 0
          ? `${hardIssues.length} boundary issue(s)`
          : "Within hard bounds",
      details:
        hardIssues.length > 0
          ? hardIssues
          : ["Validator result stayed inside the hard policy envelope."],
    },
    {
      label: "Engine Diagnostics",
      tone: diagnosticIssues.length > 0 ? "warning" : "ok",
      summary:
        diagnosticIssues.length > 0
          ? `${diagnosticIssues.length} signal(s)`
          : "Clean engine path",
      details:
        diagnosticIssues.length > 0
          ? diagnosticIssues
          : ["No validator override, routing gap, or retrieval gap observed."],
    },
    {
      label: "UX Quality",
      tone: uxIssues.length > 0 ? "info" : "muted",
      summary: uxIssues.length > 0 ? `${uxIssues.length} note(s)` : "No notes",
      details:
        uxIssues.length > 0
          ? uxIssues
          : [
              "Customer-facing copy has no obvious length or interaction issue.",
            ],
    },
  ];
}

function hardSafetyIssues(result: ValidatedTurnResult): string[] {
  const issues: string[] = [];
  const trace = result.trace;

  if (
    result.finalAction === "answer" &&
    trace.selectedServingMode !== "answer"
  ) {
    issues.push(
      "Final action answers while selected serving mode is not answer.",
    );
  }

  if (result.finalAction === "answer" && trace.retrievedMatches.length === 0) {
    issues.push("Final answer has no retrieved evidence.");
  }

  if (
    trace.safetyFlags.includes("forbidden_credentials") &&
    !safeNonAnswerActions.has(result.finalAction)
  ) {
    issues.push("Forbidden credential flag did not resolve to a safe action.");
  }

  if (
    trace.safetyFlags.includes("account_specific_request") &&
    result.finalAction === "answer"
  ) {
    issues.push("Account-specific request resolved to a direct answer.");
  }

  return issues;
}

function engineDiagnosticIssues(result: ValidatedTurnResult): string[] {
  const issues: string[] = [];
  const trace = result.trace;

  if (trace.validatorOverrides.length > 0) {
    issues.push(
      `${trace.validatorOverrides.length} validator override(s) fired.`,
    );
  }

  if (trace.proposedAction !== trace.finalAction) {
    issues.push(
      `Planner proposed ${trace.proposedAction}; validator emitted ${trace.finalAction}.`,
    );
  }

  if (trace.selectedServingMode === null) {
    issues.push("No serving mode was selected.");
  }

  if (trace.retrievedMatches.length === 0) {
    issues.push("Retriever returned no evidence.");
  }

  if (
    trace.retrievedMatches.length > 0 &&
    topRetrievalScore(trace.retrievedMatches) < 2
  ) {
    issues.push("Top retrieval score is weak.");
  }

  return issues;
}

function uxQualityNotes(result: ValidatedTurnResult): string[] {
  const notes: string[] = [];
  const text = result.customerMessage.trim();

  if (text.length < 32) {
    notes.push("Customer-facing message is very short.");
  }

  if (text.length > 700) {
    notes.push(
      "Customer-facing message is long enough to inspect for readability.",
    );
  }

  if (result.finalAction === "ask_clarifying_question") {
    notes.push("Turn asks for clarification.");
  }

  if (result.state.requestedFields.length > 0) {
    notes.push(
      `${result.state.requestedFields.length} handoff field(s) requested.`,
    );
  }

  return notes;
}

function decisionFields(result: ValidatedTurnResult): DecisionField[] {
  const trace = result.trace;

  return [
    {
      label: "Final action",
      value: result.finalAction,
      tone: hardSafetyIssues(result).length > 0 ? "danger" : "ok",
    },
    {
      label: "Proposed action",
      value: trace.proposedAction,
      tone: trace.proposedAction === trace.finalAction ? "ok" : "warning",
    },
    {
      label: "Serving mode",
      value: trace.selectedServingMode ?? "none",
      tone: trace.selectedServingMode === null ? "warning" : "info",
    },
    {
      label: "Retrieval",
      value: `${trace.retrievedMatches.length} match(es)`,
      tone: trace.retrievedMatches.length === 0 ? "warning" : "ok",
    },
    {
      label: "Overrides",
      value: `${trace.validatorOverrides.length}`,
      tone: trace.validatorOverrides.length === 0 ? "ok" : "warning",
    },
    {
      label: "Safety flags",
      value:
        trace.safetyFlags.length === 0 ? "none" : trace.safetyFlags.join(", "),
      tone: trace.safetyFlags.length === 0 ? "ok" : "info",
    },
  ];
}

function scoreWidth(
  match: RetrievedMatch,
  matches: readonly RetrievedMatch[],
): string {
  const max = Math.max(1, ...matches.map((entry) => entry.score));

  return `${Math.round((match.score / max) * 100)}%`;
}

function topRetrievalScore(matches: readonly RetrievedMatch[]): number {
  return Math.max(0, ...matches.map((match) => match.score));
}

function formatError(error: unknown): string {
  if (error instanceof TypeError) {
    return "Could not reach the lab API. Start it with `just core-serve -- --port 8787`.";
  }

  return error instanceof Error ? error.message : String(error);
}

async function focusPrompt(): Promise<void> {
  await nextTick();
  promptInput.value?.focus();
}
</script>

<template>
  <div class="app-shell" :class="{ 'has-turns': hasTurns }">
    <header v-if="hasTurns" class="topbar">
      <div class="topbar-title">
        <span class="server-dot" :class="overallTone"></span>
        <span>Phase 0 Lab Console</span>
        <small>{{ sessionLabel }}</small>
      </div>
      <div class="topbar-actions">
        <button
          class="icon-button"
          type="button"
          title="Export session JSON"
          aria-label="Export session JSON"
          :disabled="!canExport"
          @click="exportSession"
        >
          <Download :size="18" aria-hidden="true" />
        </button>
        <button
          class="icon-button"
          type="button"
          title="Reset session"
          aria-label="Reset session"
          :disabled="isResetting"
          @click="resetConsole"
        >
          <RotateCcw :size="18" aria-hidden="true" />
        </button>
      </div>
    </header>

    <main v-if="!hasTurns" class="center-stage">
      <form class="prompt-card" @submit.prevent="submitMessage">
        <div class="console-mark">
          <Server :size="20" aria-hidden="true" />
          <span>Phase 0 Lab Console</span>
        </div>
        <div class="input-row">
          <input
            ref="promptInput"
            v-model="message"
            type="text"
            autocomplete="off"
            placeholder="Type a customer message"
            aria-label="Customer message"
            :disabled="isSending"
          />
          <button
            class="send-button"
            type="submit"
            title="Send message"
            aria-label="Send message"
            :disabled="!canSend"
          >
            <LoaderCircle
              v-if="isSending"
              class="spin"
              :size="19"
              aria-hidden="true"
            />
            <Send v-else :size="19" aria-hidden="true" />
          </button>
        </div>
        <p v-if="errorMessage" class="error-line">{{ errorMessage }}</p>
      </form>
    </main>

    <main v-else class="workbench">
      <section class="transcript-panel" aria-label="Conversation transcript">
        <div class="panel-head">
          <div>
            <h1>Conversation</h1>
            <p>{{ turns.length }} turn(s)</p>
          </div>
          <span class="status-pill" :class="overallTone">
            {{ latestTurn?.result.finalAction }}
          </span>
        </div>

        <div class="turn-list">
          <button
            v-for="turn in turns"
            :key="turn.id"
            class="turn-card"
            :class="{ selected: selectedTurn?.id === turn.id }"
            type="button"
            @click="selectTurn(turn.id)"
          >
            <span class="turn-index">Turn {{ turn.id }}</span>
            <span class="bubble customer">{{ turn.userMessage }}</span>
            <span class="bubble assistant">{{
              turn.result.customerMessage
            }}</span>
            <span class="lane-strip">
              <span
                v-for="lane in turn.lanes"
                :key="lane.label"
                class="mini-dot"
                :class="lane.tone"
                :title="`${lane.label}: ${lane.summary}`"
              ></span>
            </span>
          </button>
        </div>

        <form class="dock" @submit.prevent="submitMessage">
          <input
            ref="promptInput"
            v-model="message"
            type="text"
            autocomplete="off"
            placeholder="Type another customer message"
            aria-label="Customer message"
            :disabled="isSending"
          />
          <button
            class="send-button"
            type="submit"
            title="Send message"
            aria-label="Send message"
            :disabled="!canSend"
          >
            <LoaderCircle
              v-if="isSending"
              class="spin"
              :size="19"
              aria-hidden="true"
            />
            <Send v-else :size="19" aria-hidden="true" />
          </button>
        </form>
        <p v-if="errorMessage" class="error-line">{{ errorMessage }}</p>
      </section>

      <aside v-if="selectedTurn" class="inspector" aria-label="Turn inspector">
        <div class="panel-head">
          <div>
            <h2>Turn {{ selectedTurn.id }} Inspector</h2>
            <p>{{ selectedTurn.result.requestRef }}</p>
          </div>
          <span class="status-pill" :class="selectedTurn.lanes[0]?.tone">
            {{ selectedTurn.result.trace.selectedServingMode ?? "none" }}
          </span>
        </div>

        <section class="lane-grid">
          <article
            v-for="lane in selectedTurn.lanes"
            :key="lane.label"
            class="lane-card"
            :class="lane.tone"
          >
            <div>
              <h3>{{ lane.label }}</h3>
              <strong>{{ lane.summary }}</strong>
            </div>
            <ul>
              <li v-for="detail in lane.details" :key="detail">{{ detail }}</li>
            </ul>
          </article>
        </section>

        <section class="inspector-section">
          <h3>Decision Fields</h3>
          <div class="field-grid">
            <article
              v-for="field in decisionFields(selectedTurn.result)"
              :key="field.label"
              class="field-tile"
              :class="field.tone"
            >
              <span>{{ field.label }}</span>
              <strong>{{ field.value }}</strong>
            </article>
          </div>
        </section>

        <section class="inspector-section">
          <h3>Retrieval</h3>
          <div
            v-if="selectedTurn.result.trace.retrievedMatches.length > 0"
            class="retrieval-list"
          >
            <article
              v-for="match in selectedTurn.result.trace.retrievedMatches"
              :key="match.itemId"
              class="retrieval-row"
            >
              <div class="retrieval-head">
                <strong>{{ match.itemId }}</strong>
                <span class="status-pill info">{{ match.servingMode }}</span>
              </div>
              <div class="score-track">
                <span
                  :style="{
                    width: scoreWidth(
                      match,
                      selectedTurn.result.trace.retrievedMatches,
                    ),
                  }"
                ></span>
              </div>
              <div class="retrieval-meta">
                <span>score {{ match.score }}</span>
                <span>{{ match.matchedTerms.join(", ") || "no terms" }}</span>
              </div>
            </article>
          </div>
          <p v-else class="empty-line">No retrieved evidence.</p>
        </section>

        <section class="inspector-section">
          <h3>Validator</h3>
          <div
            v-if="selectedTurn.result.validatorOverrides.length > 0"
            class="override-list"
          >
            <article
              v-for="override in selectedTurn.result.validatorOverrides"
              :key="`${override.code}-${override.toAction}`"
              class="override-row"
            >
              <span class="status-pill warning">{{ override.code }}</span>
              <p>{{ override.reason }}</p>
              <small>
                {{ override.fromAction ?? "none" }} -> {{ override.toAction }}
              </small>
            </article>
          </div>
          <p v-else class="empty-line">No validator overrides.</p>
        </section>

        <section class="inspector-section">
          <h3>State</h3>
          <div class="state-grid">
            <article>
              <span>Requested fields</span>
              <strong>
                {{
                  selectedTurn.result.state.requestedFields.join(", ") || "none"
                }}
              </strong>
            </article>
            <article>
              <span>Collected facts</span>
              <strong>
                {{
                  Object.keys(selectedTurn.result.state.collectedFacts).length
                }}
              </strong>
            </article>
            <article>
              <span>Handoff pending</span>
              <strong>{{ selectedTurn.result.state.handoffPending }}</strong>
            </article>
          </div>
        </section>

        <section class="inspector-section">
          <details>
            <summary>Raw turn JSON</summary>
            <pre>{{ JSON.stringify(selectedTurn.result, null, 2) }}</pre>
          </details>
        </section>
      </aside>
    </main>
  </div>
</template>
