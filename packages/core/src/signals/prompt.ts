import {
  type ConversationState,
  type SignalBundle,
  type SignalInput,
  servingModeSchema,
  safetyFlagSchema,
} from "@loanslam/contracts";

import { policyVersion } from "../policy";

export interface SignalExtractorPrompt {
  system: string;
  user: string;
}

export function buildSignalExtractorPrompt(
  input: SignalInput,
): SignalExtractorPrompt {
  return {
    system: buildSystemPrompt(),
    user: buildUserPrompt(input),
  };
}

function buildSystemPrompt(): string {
  return [
    "You are the Loanslam Phase 0 SignalExtractor.",
    "Output one strict JSON object matching the provided schema. Do not include markdown.",
    "Focus on interpretation only, not grounding or response choice. You do not write customer copy and you do not decide the final action.",
    "Your value is early classification: domain, account-specificity, excluded advice, safety signals, and retrieval terms. The TurnPlanner and validator remain responsible for final behavior.",
    "Classify the latest customer message first. Conversation state is context, not sticky route authority.",
    "Domain boundary: Loanslam chat is only for Loanslam loan, application, repayment, account-support, complaints, accessibility, vulnerability, and policy questions.",
    "If the latest customer message is outside that domain, set primaryIntent=other, recommendedServingMode=null, safetySignals=[], retrievalQueries=[], routeHints=[], negatedOrCorrected=false unless the message independently contains a genuine safety signal. Examples of out-of-domain requests: train bookings, travel planning, shopping, weather, recipes, coding, entertainment, schoolwork, or general life admin.",
    "Do not classify unrelated tasks as public FAQ. A public FAQ means a public question about Loanslam, Loanslam loans, applications, repayment process, eligibility, credit checks, or support routes.",
    "If this is a public FAQ question with no account-risk or vulnerability signal, set recommendedServingMode=answer.",
    "If this is a vague low-risk money/help request with no stated inability to pay, distress, arrears, complaint, legal threat, or existing-account detail, set primaryIntent=answer and recommendedServingMode=answer so retrieval stays in public/clarification territory. Example: 'I need help with getting money' means clarify whether they want to apply or need existing-account support; it is not hardship by itself.",
    "If this is about account balances, payment dates, bank details, application status, reference numbers, or personal account data, set recommendedServingMode=handoff_account_specific.",
    "If this contains vulnerability, distress, complaint, legal threat, hardship, or accessibility signals, set recommendedServingMode=route_vulnerability.",
    "If this requests regulated/debt advice or similar excluded advice, set recommendedServingMode=excluded.",
    "Set route_vulnerability only for active current-message safety signals. If the customer says they do not mean they cannot pay, are not struggling to pay, or are not complaining, set negatedOrCorrected=true and do not set route_vulnerability unless they add a new active safety signal.",
    "A fresh public FAQ after a handoff remains answerable when it does not ask about the customer's own account or existing application. For example, asking how to apply online for another loan is public FAQ unless the message asks for their own approval, balance, status, payment, or account change.",
    "Do not let previous account_specific or change_request state turn a new public FAQ into handoff_account_specific.",
    "When recommendedServingMode=route_vulnerability, include at least one matching vulnerability-family safetySignals value.",
    "Return safetySignals as the specific safety flags from the customer message only (if any).",
    "Set negatedOrCorrected true only when the customer appears to explicitly reject an earlier safety/account concern.",
    "Use retrievalQueries and routeHints to improve Loanslam corpus retrieval only. Do not add retrieval terms for unrelated tasks. For vague but plausibly Loanslam-scoped messages such as 'I need help with money', use neutral Loanslam terms like application, loan, account, support. Do not add money, approval, funds, payout, balance, arrears, hardship, debt advice, or repayment difficulty unless the customer actually said that specific concept beyond vague money/help.",
    "Keep uncertainty between 0 and 1, where 0 means very confident and 1 means very uncertain.",
    "Examples: 'Can I book a train to Waterloo?' -> primaryIntent=other, recommendedServingMode=null, no retrieval queries. 'Can you order me a pizza?' -> primaryIntent=other, recommendedServingMode=null. 'Where do I start an application?' -> primaryIntent=answer, recommendedServingMode=answer, retrieval query about applying online. 'What is my balance?' -> primaryIntent=account_specific, recommendedServingMode=handoff_account_specific. 'Should I enter an IVA?' -> primaryIntent=excluded_advice, recommendedServingMode=excluded unless active hardship/distress is also stated.",
    `Allowed serving modes: ${servingModeSchema.options.join(", ")}.`,
    `Allowed safety flags: ${safetyFlagSchema.options.join(", ")}.`,
  ].join("\n");
}

function buildUserPrompt(input: SignalInput): string {
  return [
    `Policy version: ${policyVersion}`,
    "Conversation state",
    stableStringify(summarizeState(input.conversationState)),
    "",
    "Conversation history",
    formatHistory(input.conversationState),
    "",
    "Customer message",
    input.userMessage,
    "",
    "Produce a structured signal bundle for retrieval and safety interpretation, not a final action.",
  ].join("\n");
}

function summarizeState(
  state: ConversationState,
): Pick<
  ConversationState,
  | "conversationRef"
  | "safetyFlags"
  | "handoffPending"
  | "lastAction"
  | "collectedFacts"
  | "requestedFields"
> {
  return {
    conversationRef: state.conversationRef,
    safetyFlags: state.safetyFlags,
    handoffPending: state.handoffPending,
    lastAction: state.lastAction,
    collectedFacts: state.collectedFacts,
    requestedFields: state.requestedFields,
  };
}

function formatHistory(state: ConversationState): string {
  if (state.history.length === 0) {
    return "No prior messages.";
  }

  return state.history
    .slice(-8)
    .map(
      (message) =>
        `- ${message.createdAt} ${message.role} ${message.id}: ${message.content}`,
    )
    .join("\n");
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function normalizeOpenAiParsedSignalBundle(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") {
    return parsed;
  }

  const cast = parsed as {
    primaryIntent?: string;
    secondaryIntents?: unknown;
    safetySignals?: unknown;
    retrievalQueries?: unknown;
    routeHints?: unknown;
    uncertainty?: number;
    recommendedServingMode?: unknown;
    negatedOrCorrected?: boolean;
    parserNotes?: unknown;
  };

  return {
    ...cast,
    secondaryIntents: normalizeStringArray(cast.secondaryIntents),
    safetySignals: normalizeStringArray(cast.safetySignals),
    retrievalQueries: normalizeStringArray(cast.retrievalQueries),
    routeHints: normalizeStringArray(cast.routeHints),
    parserNotes: normalizeStringArray(cast.parserNotes),
    uncertainty: clampUncertainty(cast.uncertainty),
    negatedOrCorrected: Boolean(cast.negatedOrCorrected),
    recommendedServingMode:
      cast.recommendedServingMode === "answer" ||
      cast.recommendedServingMode === "handoff_account_specific" ||
      cast.recommendedServingMode === "route_vulnerability" ||
      cast.recommendedServingMode === "excluded"
        ? cast.recommendedServingMode
        : null,
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item ?? "").trim())
    .filter((entry) => entry.length > 0);
}

function clampUncertainty(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.5;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

export function parseSignalBundle(parsed: unknown): SignalBundle {
  const normalized = normalizeOpenAiParsedSignalBundle(parsed);
  return normalized as SignalBundle;
}
