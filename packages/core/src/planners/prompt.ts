import {
  intakeFieldSchema,
  safetyFlagSchema,
  turnActionSchema,
  type RetrievedMatch,
  type TurnPlannerInput,
  uiPrimitiveSchema,
} from "@loanslam/contracts";

export interface TurnPlannerPrompt {
  system: string;
  user: string;
}

export function buildTurnPlannerPrompt(
  input: TurnPlannerInput,
): TurnPlannerPrompt {
  return {
    system: buildSystemPrompt(),
    user: buildUserPrompt(input),
  };
}

function buildSystemPrompt(): string {
  return [
    "You are the LoanSlam Phase 0 TurnPlanner.",
    "Output exactly one TurnPlan object matching the provided structured output schema. Do not output markdown, commentary, or any object other than the TurnPlan.",
    `Allowed actions: ${turnActionSchema.options.join(", ")}.`,
    `Allowed UI primitives: ${uiPrimitiveSchema.options.join(", ")}.`,
    "Only answer from retrieved corpus items with serving_mode: answer. Cite answer IDs only when serving_mode answer.",
    "For handoff_account_specific or route_vulnerability items, request the standard handoff intake or escalate; do not invent account details or outcomes.",
    "excluded means refuse, signpost, or request handoff without answering the excluded substance. Preserve the exclusion route reason in traceSummary.",
    `Standard handoff intake fields: ${intakeFieldSchema.options.join(", ")}.`,
    "Never ask for payment card numbers, bank credentials, online banking passwords, one-time passcodes, or security answers. If the user offers or asks about these, set forbidden_credentials and use a safe fallback or handoff.",
    `Safety flags to set when relevant: ${safetyFlagSchema.options.join(", ")}.`,
    "Pay special attention to vulnerability, distress, complaint, legal_threat, accessibility_need, and hardship. Prefer safe handoff/intake over unsupported reassurance.",
    "The validator is the hard policy backstop, but the TurnPlan should already respect grounding, serving modes, allowed UI primitives, and credential rules.",
  ].join("\n");
}

function buildUserPrompt(input: TurnPlannerInput): string {
  return [
    `Policy version: ${input.policyVersion}`,
    `Allowed actions for this turn: ${input.allowedActions.join(", ")}`,
    `Allowed UI primitives for this turn: ${input.allowedUiPrimitives.join(", ")}`,
    "",
    "Conversation state",
    stableStringify({
      conversationRef: input.conversationState.conversationRef,
      collectedFacts: input.conversationState.collectedFacts,
      requestedFields: input.conversationState.requestedFields,
      safetyFlags: input.conversationState.safetyFlags,
      lastAction: input.conversationState.lastAction,
      handoffPending: input.conversationState.handoffPending,
    }),
    "",
    "Conversation history",
    formatHistory(input),
    "",
    "Customer message",
    input.userMessage,
    "",
    "Retrieved matches",
    formatRetrievedMatches(input.retrievedMatches),
    "",
    "Plan the next turn using only the facts above.",
  ].join("\n");
}

function formatHistory(input: TurnPlannerInput): string {
  if (input.conversationState.history.length === 0) {
    return "No prior messages.";
  }

  return input.conversationState.history
    .map(
      (message) =>
        `- ${message.createdAt} ${message.role} ${message.id}: ${message.content}`,
    )
    .join("\n");
}

function formatRetrievedMatches(matches: RetrievedMatch[]): string {
  if (matches.length === 0) {
    return "No retrieved matches.";
  }

  return matches.map(formatRetrievedMatch).join("\n\n");
}

function formatRetrievedMatch(match: RetrievedMatch, index: number): string {
  const item = match.item;
  const links = item?.links ?? [];

  return [
    `Match ${index + 1}`,
    `id: ${match.itemId}`,
    `score: ${match.score}`,
    `serving_mode: ${match.servingMode}`,
    `matched_terms: ${match.matchedTerms.join(", ") || "none"}`,
    `title: ${item?.title ?? "unknown"}`,
    `question: ${item?.question ?? "unknown"}`,
    `route_reason: ${item?.route_reason ?? "none"}`,
    `answer_text: ${item?.answer_text ?? "none"}`,
    `links: ${links.length === 0 ? "none" : stableStringify(links)}`,
  ].join("\n");
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
