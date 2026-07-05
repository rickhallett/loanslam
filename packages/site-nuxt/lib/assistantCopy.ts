import type { SafetyFlag, TurnAction, UiPrimitive } from "@loanslam/contracts";

import { normalizeDemoBrandText } from "./brandText";

export const SUPPORT_WELCOME =
  "Hi, I'm the MAL Loans assistant. I can answer general questions about our loans, read the page you're on, help you navigate the site, and point you to the right team for anything account-specific. How can I help?";
export const LEGACY_ROUTE_FINDER_WELCOME =
  "Tell me what you need help with and I'll point you to apply online, repayments, existing-loan support, complaints, or the right contact route. You can still call, text, or email the team directly from this page.";
export const LEGACY_CONTACT_AVAILABILITY_NOTE =
  "You can also ask me any other Loans by MAL question here.";
export const CONTACT_AVAILABILITY_NOTE =
  "You can also ask me about our loans and how we work. Anything account-specific, I'll route to the right team.";
export const CONTACT_COMPLETE_AVAILABILITY_NOTE =
  "If you have another question, start over and I can help with that too.";
export const ROUTE_FINDER_WELCOME = `Tell me what you need help with and I'll take it one step at a time. I can help with applications, repayments, existing loans, complaints, or finding the right contact route. ${CONTACT_AVAILABILITY_NOTE}`;
export const LEGACY_ROUTE_FINDER_WELCOME_V2 = `Tell me what you need help with and I'll take it one step at a time. I can help with applications, repayments, existing loans, complaints, or finding the right contact route. ${LEGACY_CONTACT_AVAILABILITY_NOTE}`;

export type AssistantCopySurface =
  | "welcome"
  | "topic_primer"
  | "grounded_answer"
  | "off_topic_refusal"
  | "unsupported_financial_promise"
  | "unsupported_rate_quote"
  | "account_specific_route"
  | "safe_human_handoff"
  | "handoff_complete"
  | "handoff_cancel"
  | "other";

export interface AssistantCopyContext {
  isContactRoute: boolean;
  surface: AssistantCopySurface;
}

export interface AssistantTurnSurfaceInput {
  finalAction: TurnAction;
  safetyFlags: readonly SafetyFlag[];
  uiPrimitive: UiPrimitive;
  message: string;
}

const onboardingSurfaces = new Set<AssistantCopySurface>([
  "welcome",
  "topic_primer",
]);

const accountRouteFlags = new Set<SafetyFlag>([
  "account_specific_request",
  "change_request",
]);

const humanHandoffFlags = new Set<SafetyFlag>([
  "vulnerability",
  "distress",
  "complaint",
  "legal_threat",
  "accessibility_need",
  "hardship",
  "language_barrier",
]);

const offTopicRefusal =
  "Sorry, I can only help with Loans by MAL applications, repayments, account support, complaints, or accessibility needs. If your question is about your loan or application, tell me what you need and I'll route you safely.";
const offTopicRefusalPattern =
  /\b(?:cannot answer that in chat|can't answer that in chat|can only help with .*loan questions?)\b/i;

function hasAnyFlag(
  actual: readonly SafetyFlag[],
  expected: ReadonlySet<SafetyFlag>,
): boolean {
  return actual.some((flag) => expected.has(flag));
}

function appendContactAvailability(
  text: string,
  context: AssistantCopyContext,
): string {
  if (
    !context.isContactRoute ||
    !onboardingSurfaces.has(context.surface) ||
    text.includes(CONTACT_AVAILABILITY_NOTE) ||
    text.includes(CONTACT_COMPLETE_AVAILABILITY_NOTE)
  ) {
    return text;
  }
  return `${text}\n\n${CONTACT_AVAILABILITY_NOTE}`;
}

export function assistantCopySurfaceForTurn({
  finalAction,
  safetyFlags,
  uiPrimitive,
  message,
}: AssistantTurnSurfaceInput): AssistantCopySurface {
  if (
    finalAction === "fallback" ||
    safetyFlags.includes("unsupported_request")
  ) {
    return "off_topic_refusal";
  }

  if (finalAction === "refuse") {
    if (offTopicRefusalPattern.test(message)) return "off_topic_refusal";
    if (/\b(?:apr|rate)\b/i.test(message)) return "unsupported_rate_quote";
    return "unsupported_financial_promise";
  }

  if (
    finalAction === "request_handoff_intake" ||
    finalAction === "create_ticket" ||
    finalAction === "escalate" ||
    uiPrimitive === "intake_form" ||
    uiPrimitive === "handoff_confirmation"
  ) {
    if (hasAnyFlag(safetyFlags, accountRouteFlags)) {
      return "account_specific_route";
    }
    if (hasAnyFlag(safetyFlags, humanHandoffFlags)) {
      return "safe_human_handoff";
    }
    return "safe_human_handoff";
  }

  if (finalAction === "answer") return "grounded_answer";
  return "other";
}

export function formatAssistantCopy(
  text: string,
  context: AssistantCopyContext,
): string {
  const normalized = normalizeDemoBrandText(text);
  const surfaced =
    context.surface === "off_topic_refusal" ? offTopicRefusal : normalized;
  return appendContactAvailability(surfaced, context);
}

export function contactTopicPrimerText(topicTitle: string): string {
  const topicLabel = topicTitle.trim();
  return formatAssistantCopy(
    `Okay - let's start with "${topicLabel}". Tell me what you need help with and I'll take it one step at a time.`,
    { isContactRoute: true, surface: "topic_primer" },
  );
}
