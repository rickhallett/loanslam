<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { Download, LoaderCircle, RotateCcw, Send } from "@lucide/vue";

import type {
  RetrievedMatch,
  TurnAction,
  ValidatedTurnResult,
} from "@loanslam/contracts";

type Tone = "danger" | "info" | "muted" | "ok" | "warning";
type InspectorTab = "diagnostics" | "trace";

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
const turnList = ref<HTMLElement | null>(null);
const inspectorTab = ref<InspectorTab>("diagnostics");

const placeholderLanes: LaneStatus[] = [
  {
    label: "hard_safety",
    tone: "muted",
    summary: "waiting",
    details: ["No turn has been submitted."],
  },
  {
    label: "engine",
    tone: "muted",
    summary: "waiting",
    details: ["Planner and validator output will appear here."],
  },
  {
    label: "ux",
    tone: "muted",
    summary: "waiting",
    details: ["Customer copy notes will appear here."],
  },
];

const placeholderDecisionFields: DecisionField[] = [
  { label: "final_action", value: "-", tone: "muted" },
  { label: "proposed_action", value: "-", tone: "muted" },
  { label: "serving_mode", value: "-", tone: "muted" },
  { label: "retrieval", value: "0", tone: "muted" },
  { label: "overrides", value: "0", tone: "muted" },
  { label: "safety_flags", value: "none", tone: "muted" },
];

const hasTurns = computed(() => turns.value.length > 0);
const selectedTurn = computed(
  () =>
    turns.value.find((turn) => turn.id === selectedTurnId.value) ??
    turns.value.at(-1) ??
    null,
);
const latestTurn = computed(() => turns.value.at(-1) ?? null);
const isChatComplete = computed(() => {
  const result = latestTurn.value?.result;

  return (
    result?.finalAction === "create_ticket" ||
    result?.ui.primitive === "handoff_confirmation"
  );
});
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
  () =>
    message.value.trim().length > 0 &&
    !isSending.value &&
    !isChatComplete.value,
);
const canExport = computed(() => turns.value.length > 0);
const visibleLanes = computed(
  () => selectedTurn.value?.lanes ?? placeholderLanes,
);
const visibleDecisionFields = computed(() =>
  selectedTurn.value === null
    ? placeholderDecisionFields
    : decisionFields(selectedTurn.value.result),
);
const selectedResult = computed(() => selectedTurn.value?.result ?? null);
const selectedTrace = computed(() => selectedResult.value?.trace ?? null);
const retrievedMatches = computed(
  () => selectedTrace.value?.retrievedMatches ?? [],
);
const selectedIntakeFields = computed(() =>
  selectedResult.value === null ? [] : intakeFields(selectedResult.value),
);
const selectedState = computed(() => selectedResult.value?.state ?? null);
const validatorOverrides = computed(
  () => selectedResult.value?.validatorOverrides ?? [],
);

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
    inspectorTab.value = "diagnostics";
    await scrollTranscriptToBottom();
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
  inspectorTab.value = "diagnostics";

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

function selectInspectorTab(tab: InspectorTab): void {
  inspectorTab.value = tab;
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
      label: "HARD_SAFETY",
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
      label: "ENGINE_DIAGNOSTICS",
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
      label: "UX_QUALITY",
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
      label: "final_action",
      value: result.finalAction,
      tone: hardSafetyIssues(result).length > 0 ? "danger" : "ok",
    },
    {
      label: "proposed_action",
      value: trace.proposedAction,
      tone: trace.proposedAction === trace.finalAction ? "ok" : "warning",
    },
    {
      label: "serving_mode",
      value: trace.selectedServingMode ?? "none",
      tone: trace.selectedServingMode === null ? "warning" : "info",
    },
    {
      label: "retrieval",
      value: `${trace.retrievedMatches.length} match(es)`,
      tone: trace.retrievedMatches.length === 0 ? "warning" : "ok",
    },
    {
      label: "overrides",
      value: `${trace.validatorOverrides.length}`,
      tone: trace.validatorOverrides.length === 0 ? "ok" : "warning",
    },
    {
      label: "safety_flags",
      value:
        trace.safetyFlags.length === 0 ? "none" : trace.safetyFlags.join(", "),
      tone: trace.safetyFlags.length === 0 ? "ok" : "info",
    },
  ];
}

function intakeFields(result: ValidatedTurnResult): string[] {
  return result.ui.primitive === "intake_form" ? result.ui.fields : [];
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
    return "Could not reach the lab API. Start the full lab with `just lab`, or start the API with `just core-serve -- --port 8787`.";
  }

  return error instanceof Error ? error.message : String(error);
}

async function focusPrompt(): Promise<void> {
  await nextTick();
  if (isChatComplete.value) {
    return;
  }
  promptInput.value?.focus();
}

async function scrollTranscriptToBottom(): Promise<void> {
  await nextTick();
  await new Promise(requestAnimationFrame);
  const list = turnList.value;

  if (list === null) {
    return;
  }

  list.scrollTo({ top: list.scrollHeight, behavior: "auto" });
}
</script>

<template>
  <div class="app-shell" :class="{ 'has-turns': hasTurns }">
    <header class="topbar">
      <div class="topbar-title">
        <span class="server-dot" :class="overallTone"></span>
        <span>phase0.lab</span>
        <small>session={{ sessionLabel }}</small>
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

    <main class="workbench">
      <section class="transcript-panel" aria-label="Conversation transcript">
        <div class="panel-head">
          <div>
            <h1>transcript</h1>
            <p>turns={{ turns.length }}</p>
          </div>
          <span class="status-pill" :class="overallTone">
            {{ latestTurn?.result.finalAction ?? "idle" }}
          </span>
        </div>

        <div ref="turnList" class="turn-list">
          <button
            v-for="turn in turns"
            :key="turn.id"
            class="turn-card"
            :class="{ selected: selectedTurn?.id === turn.id }"
            type="button"
            @click="selectTurn(turn.id)"
          >
            <span class="turn-index">turn={{ turn.id }}</span>
            <span class="bubble customer">{{ turn.userMessage }}</span>
            <span class="bubble assistant">{{
              turn.result.customerMessage
            }}</span>
            <span
              v-if="intakeFields(turn.result).length > 0"
              class="field-strip"
            >
              <span v-for="field in intakeFields(turn.result)" :key="field">
                {{ field }}
              </span>
            </span>
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
          <div v-if="!hasTurns" class="empty-turn">
            <span>stdin is empty</span>
            <span>submit a customer message to start a run</span>
          </div>
        </div>

        <form class="dock" @submit.prevent="submitMessage">
          <input
            ref="promptInput"
            v-model="message"
            type="text"
            autocomplete="off"
            placeholder="customer_message"
            aria-label="Customer message"
            :disabled="isSending || isChatComplete"
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
        <p v-if="isChatComplete" class="terminal-line">handoff_complete</p>
        <p v-if="errorMessage" class="error-line">{{ errorMessage }}</p>
      </section>

      <aside class="inspector" aria-label="Turn inspector">
        <div class="panel-head">
          <div>
            <h2>
              {{ selectedTurn ? `turn_${selectedTurn.id}` : "turn_idle" }}
            </h2>
            <p>request={{ selectedResult?.requestRef ?? "-" }}</p>
          </div>
          <span class="status-pill" :class="visibleLanes[0]?.tone">
            {{ selectedTrace?.selectedServingMode ?? "none" }}
          </span>
        </div>

        <nav class="tab-bar" aria-label="Inspector tabs">
          <button
            type="button"
            :class="{ selected: inspectorTab === 'diagnostics' }"
            @click="selectInspectorTab('diagnostics')"
          >
            diagnostics
          </button>
          <button
            type="button"
            :class="{ selected: inspectorTab === 'trace' }"
            @click="selectInspectorTab('trace')"
          >
            trace
          </button>
        </nav>

        <div v-if="inspectorTab === 'diagnostics'" class="tab-panel">
          <section class="lane-grid">
            <article
              v-for="lane in visibleLanes"
              :key="lane.label"
              class="lane-card"
              :class="lane.tone"
            >
              <div>
                <h3>{{ lane.label }}</h3>
                <strong>{{ lane.summary }}</strong>
              </div>
              <ul>
                <li v-for="detail in lane.details" :key="detail">
                  {{ detail }}
                </li>
              </ul>
            </article>
          </section>

          <section class="inspector-section">
            <h3>decision_fields</h3>
            <div class="field-grid">
              <article
                v-for="field in visibleDecisionFields"
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
            <h3>validator</h3>
            <div v-if="validatorOverrides.length > 0" class="override-list">
              <article
                v-for="override in validatorOverrides"
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
            <h3>state</h3>
            <div class="state-grid">
              <article>
                <span>requested_fields</span>
                <strong>
                  {{ selectedState?.requestedFields.join(", ") || "none" }}
                </strong>
              </article>
              <article>
                <span>collected_facts</span>
                <strong>
                  {{
                    selectedState === null
                      ? 0
                      : Object.keys(selectedState.collectedFacts).length
                  }}
                </strong>
              </article>
              <article>
                <span>handoff_pending</span>
                <strong>{{ selectedState?.handoffPending ?? false }}</strong>
              </article>
            </div>
          </section>

          <section class="inspector-section">
            <h3>ui_fields</h3>
            <div v-if="selectedIntakeFields.length > 0" class="field-strip">
              <span v-for="field in selectedIntakeFields" :key="field">
                {{ field }}
              </span>
            </div>
            <p v-else class="empty-line">No intake fields for this turn.</p>
          </section>
        </div>

        <div v-else class="tab-panel">
          <section class="inspector-section trace-first">
            <h3>retrieval</h3>
            <div v-if="retrievedMatches.length > 0" class="retrieval-list">
              <article
                v-for="match in retrievedMatches"
                :key="match.itemId"
                class="retrieval-row"
              >
                <div class="retrieval-main">
                  <strong>{{ match.itemId }}</strong>
                  <span>{{ match.servingMode }}</span>
                </div>
                <div class="score-track">
                  <span
                    :style="{
                      width: scoreWidth(match, retrievedMatches),
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
            <h3>raw_turn_json</h3>
            <pre v-if="selectedResult">{{
              JSON.stringify(selectedResult, null, 2)
            }}</pre>
            <pre v-else>
{
  "status": "idle",
  "turn": null
}</pre
            >
          </section>
        </div>
      </aside>
    </main>
  </div>
</template>
