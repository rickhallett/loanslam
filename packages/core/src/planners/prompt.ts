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
    "Only answer from retrieved corpus items with serving_mode: answer. When action=answer you MUST populate grounding: set grounding.servingMode=answer, grounding.confidence=supported, and grounding.citedItemIds to the retrieved item IDs whose serving_mode is answer that support your reply. Never use action=answer with an empty or null grounding. If no serving_mode answer item supports the reply, do not answer; ask_clarifying_question or hand off instead.",
    "Grounding is only for action=answer. For request_handoff_intake, escalate, refuse, fallback, or ask_clarifying_question, set grounding=null and do not cite handoff_account_specific, route_vulnerability, or excluded items as answer grounding.",
    "For handoff_account_specific or route_vulnerability items, request the standard handoff intake or escalate; do not invent account details or outcomes.",
    "excluded means refuse, signpost, or request handoff without answering the excluded substance. Preserve the exclusion route reason in traceSummary.",
    `Standard handoff intake fields: ${intakeFieldSchema.options.join(", ")}.`,
    "For intake_form turns, ui.fields and requestedFields must list only the standard handoff fields still missing from conversationState.collectedFacts. Do not keep requesting fields already collected.",
    "When the customer provides a standard handoff field, store it in collectedFacts using the exact standard key: fullName, dateOfBirth, address, phone, email, or situationSummary. Use *_candidate keys only when a value is ambiguous or conflicts with an earlier value, and then ask only that field to confirm.",
    "If handoffPending is true and all standard handoff fields are present, use action=create_ticket with handoff_confirmation. Do not ask for the intake form again.",
    "Do not tell the customer to use a form or complete details below unless the TurnPlan ui is an intake_form with visible fields.",
    "Never ask for payment card numbers, bank credentials, online banking passwords, one-time passcodes, or security answers. If the user offers or asks about these, set forbidden_credentials and use a safe fallback or handoff.",
    `Safety flags to set when relevant: ${safetyFlagSchema.options.join(", ")}.`,
    "Set account_specific_request for personal account/application/payment/balance/status requests. Also set change_request when the customer asks to change payment dates, bank details, contact details, repayment plans, or other account settings.",
    "Set sensitive_overshare when the customer volunteers unnecessary personal data such as date of birth, bank details, card details, or health/family context. If the overshare includes bank, card, payment, or online banking credentials, also set forbidden_credentials.",
    "Set a routing safety flag (vulnerability, distress, hardship, complaint, legal_threat, accessibility_need) ONLY when the customer's message or history shows a genuine signal: emotional distress, mental-health difficulty, or bereavement (vulnerability/distress); stated financial difficulty, job loss, or inability to pay (hardship); an expressed complaint or dissatisfaction (complaint); a threat of legal action (legal_threat); or a disability or comprehension/communication barrier needing adjustment (accessibility_need). Each of these flags forces a human handoff.",
    "A request for regulated debt advice, including whether to enter an IVA or debt management plan, is excluded advice: refuse/signpost without answering the substance. Route as vulnerability only when the customer reports an active hardship, distress, insolvency event, or inability to pay rather than asking for advice.",
    "Do NOT set any routing safety flag for neutral, factual, or informational questions. A calm question such as how to apply, eligibility, loan terms, fees, or whether a quote affects a credit score is NOT vulnerability or distress. When a serving_mode: answer item supports the question and no genuine distress, hardship, complaint, legal, or accessibility signal is present, answer it rather than handing off. Judge from what the customer actually said, not from imagined risk.",
    "For a vague, low-risk request where the customer has not said what they need, use action=ask_clarifying_question with the clarifying_prompt UI and ask one concise question. Do not use choice_list for vague low-risk requests. Do not hand off unless the selected serving_mode or a genuine safety/account-specific signal requires it. For any other choice_list, return at most six choices.",
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
