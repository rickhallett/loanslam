import { randomUUID } from "node:crypto";

import type {
  ConversationState,
  CorpusItem,
  IntakeField,
  PlannerMetadata,
  SignalBundle,
  SignalExtractionStatus,
  SignalExtractor,
  SignalExtractorMetadata,
  SignalExtractionComparison,
  ServingMode,
  TurnPlanner,
  TurnPlan,
  UiPlan,
  ValidatorOverride,
  ValidatedTurnResult,
} from "@loanslam/contracts";

import {
  allowedActions,
  allowedUiPrimitives,
  buildFallbackCopy,
  hasHandoffSafetyFlag,
  hasVulnerabilitySafetyFlag,
  handoffSafetyFlags,
  isHandoffFamilyAction,
  policyVersion,
  standardHandoffFields,
} from "./policy";
import { retrieveMatches } from "./retriever";
import { type ValidatedPlanFragment, validateTurnPlan } from "./validator";

export interface ProcessTurnInput {
  state: ConversationState;
  userMessage: string;
  planner: TurnPlanner & { metadata?: PlannerMetadata };
  signalExtractor?: SignalExtractor;
  corpus: readonly CorpusItem[];
  now?: Date;
  idFactory?: () => string;
  journeyId?: string;
  turnIndex?: number;
  signalExtractorTimeoutMs?: number;
}

const defaultSignalExtractorTimeoutMs = 10_000;

export async function processTurn({
  state,
  userMessage,
  planner,
  signalExtractor,
  corpus,
  now = new Date(),
  idFactory = randomUUID,
  journeyId,
  turnIndex,
  signalExtractorTimeoutMs = defaultSignalExtractorTimeoutMs,
}: ProcessTurnInput): Promise<ValidatedTurnResult> {
  const requestRef = idFactory();
  const inboundMessageId = idFactory();
  const outboundMessageId = idFactory();
  const traceId = idFactory();
  const createdAt = now.toISOString();

  // Routing signal: load-bearing. Its bundle feeds retrieval filtering
  // (retrieveMatches) and the validator's safety-flag inference
  // (validateTurnPlan) on every turn. The `shadowSignal*` trace fields and
  // `compareSignalToOutcome` below are observational telemetry only.
  const routingSignal = await extractRoutingSignal({
    signalExtractor,
    state,
    userMessage,
    timeoutMs: signalExtractorTimeoutMs,
  });
  const signalBundle =
    routingSignal.status === "fulfilled" ? routingSignal.bundle : undefined;
  const retrievedMatches = retrieveMatches(userMessage, corpus, {
    ...(signalBundle ? { signalBundle } : {}),
  });
  const plannerInput = {
    conversationState: state,
    userMessage,
    retrievedMatches,
    allowedActions,
    allowedUiPrimitives,
    policyVersion,
  };

  const {
    plan,
    validated: policyValidated,
    plannerLatencyMs,
  } = await planAndValidateTurn({
    planner,
    plannerInput,
    retrievedMatches,
    userMessage,
    signalBundle,
  });
  const validated = applyHandoffStateRules(state, policyValidated, userMessage);
  const traceSafetyFlags = mergeTraceSafetyFlags(state, validated);
  const effectiveServingMode = deriveEffectiveServingMode(
    validated,
    traceSafetyFlags,
  );
  const shadowSignalComparison = compareSignalToOutcome({
    signalBundle:
      routingSignal.status === "fulfilled" ? routingSignal.bundle : undefined,
    finalServingMode: effectiveServingMode,
    finalSafetyFlags: traceSafetyFlags,
    signalStatus: routingSignal.status,
  });
  const nextState = mergeState({
    state,
    userMessage,
    inboundMessageId,
    outboundMessageId,
    createdAt,
    customerMessage: validated.customerMessage,
    collectedFacts: validated.collectedFacts,
    requestedFields: validated.requestedFields,
    safetyFlags: traceSafetyFlags,
    finalAction: validated.finalAction,
  });

  const trace = {
    traceId,
    ...(journeyId ? { journeyId } : {}),
    turnIndex: turnIndex ?? state.history.length,
    conversationRef: state.conversationRef,
    requestRef,
    inboundMessageId,
    outboundMessageId,
    planner: planner.metadata ?? defaultPlannerMetadata,
    plannerLatencyMs,
    policyVersion,
    retrievedMatches,
    shadowSignalStatus: routingSignal.status,
    ...shadowSignalTraceFields(routingSignal),
    shadowSignalComparison,
    selectedServingMode: validated.selectedServingMode,
    effectiveServingMode,
    selectedRouteReason: validated.selectedRouteReason,
    proposedAction: plan.action,
    finalAction: validated.finalAction,
    validatorOverrides: validated.validatorOverrides,
    safetyFlags: traceSafetyFlags,
    customerMessage: validated.customerMessage,
    createdAt,
  };

  return {
    conversationRef: state.conversationRef,
    requestRef,
    state: nextState,
    plan,
    finalAction: validated.finalAction,
    ui: validated.ui,
    customerMessage: validated.customerMessage,
    validatorOverrides: validated.validatorOverrides,
    trace,
  };
}

type RoutingSignalOutcome =
  | {
      status: "disabled";
      latencyMs: number;
    }
  | {
      status: "fulfilled";
      bundle: SignalBundle;
      metadata?: SignalExtractorMetadata;
      latencyMs: number;
    }
  | {
      status: "failed" | "timed_out";
      metadata?: SignalExtractorMetadata;
      latencyMs: number;
      errorMessage: string;
    };

async function extractRoutingSignal({
  signalExtractor,
  state,
  userMessage,
  timeoutMs,
}: {
  signalExtractor: SignalExtractor | undefined;
  state: ConversationState;
  userMessage: string;
  timeoutMs: number;
}): Promise<RoutingSignalOutcome> {
  if (!signalExtractor) {
    return { status: "disabled", latencyMs: 0 };
  }

  const startedAt = Date.now();
  const abortController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const extractionPromise: Promise<RoutingSignalOutcome> = signalExtractor
    .extractSignals({
      conversationState: state,
      userMessage,
      abortSignal: abortController.signal,
    })
    .then((bundle) => ({
      status: "fulfilled" as const,
      bundle,
      ...signalMetadataField(signalExtractor.metadata),
      latencyMs: Date.now() - startedAt,
    }))
    .catch((error) => ({
      status: abortController.signal.aborted ? "timed_out" : "failed",
      ...signalMetadataField(signalExtractor.metadata),
      latencyMs: Date.now() - startedAt,
      errorMessage: error instanceof Error ? error.message : String(error),
    }));

  const timeoutPromise = new Promise<RoutingSignalOutcome>((resolve) => {
    timeoutId = setTimeout(
      () => {
        abortController.abort();
        resolve({
          status: "timed_out",
          ...signalMetadataField(signalExtractor.metadata),
          latencyMs: Date.now() - startedAt,
          errorMessage: `Signal extraction exceeded ${timeoutMs}ms.`,
        });
      },
      Math.max(0, timeoutMs),
    );
  });

  return Promise.race([extractionPromise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  });
}

function signalMetadataField(metadata: SignalExtractorMetadata | undefined): {
  metadata?: SignalExtractorMetadata;
} {
  return metadata ? { metadata } : {};
}

function shadowSignalTraceFields(outcome: RoutingSignalOutcome): {
  shadowSignalMetadata?: SignalExtractorMetadata;
  shadowSignalLatencyMs?: number;
  shadowSignalError?: string;
  shadowSignalBundle?: SignalBundle;
} {
  if (outcome.status === "disabled") {
    return { shadowSignalLatencyMs: outcome.latencyMs };
  }

  return {
    ...(outcome.metadata ? { shadowSignalMetadata: outcome.metadata } : {}),
    shadowSignalLatencyMs: outcome.latencyMs,
    ...(outcome.status === "fulfilled"
      ? { shadowSignalBundle: outcome.bundle }
      : {}),
    ...(outcome.status === "failed" || outcome.status === "timed_out"
      ? { shadowSignalError: outcome.errorMessage }
      : {}),
  };
}

function compareSignalToOutcome(params: {
  signalBundle: SignalBundle | undefined;
  finalServingMode: ServingMode | null;
  finalSafetyFlags: ConversationState["safetyFlags"];
  signalStatus: SignalExtractionStatus;
}): SignalExtractionComparison {
  if (params.signalStatus !== "fulfilled") {
    return {
      status: "inconclusive",
      recommendedServingMode: null,
      finalServingMode: params.finalServingMode,
      signalSafetyFlags: [],
      finalSafetyFlags: [...params.finalSafetyFlags],
      reasonCodes: [`signal_extraction_${params.signalStatus}`],
      parseStatus:
        params.signalStatus === "timed_out"
          ? "timed_out"
          : params.signalStatus === "failed"
            ? "failed"
            : "disabled",
    };
  }

  if (!params.signalBundle) {
    return {
      status: "inconclusive",
      recommendedServingMode: null,
      finalServingMode: params.finalServingMode,
      signalSafetyFlags: [],
      finalSafetyFlags: [...params.finalSafetyFlags],
      reasonCodes: ["signal_bundle_missing"],
      parseStatus: "failed",
    };
  }

  const servingModeMatches =
    params.signalBundle.recommendedServingMode === params.finalServingMode;
  const finalSafetySet = new Set(params.finalSafetyFlags);
  const signalSafetySet = new Set(params.signalBundle.safetySignals);
  const safetyMatch =
    [...signalSafetySet].every((flag) => finalSafetySet.has(flag)) &&
    [...finalSafetySet].every((flag) => signalSafetySet.has(flag));

  return {
    status: servingModeMatches && safetyMatch ? "match" : "mismatch",
    recommendedServingMode: params.signalBundle.recommendedServingMode,
    finalServingMode: params.finalServingMode,
    signalSafetyFlags: [...signalSafetySet],
    finalSafetyFlags: [...finalSafetySet],
    reasonCodes: [
      servingModeMatches ? "serving_mode_match" : "serving_mode_mismatch",
      safetyMatch ? "safety_flags_match" : "safety_flags_mismatch",
    ],
    parseStatus: "ok",
  };
}

function deriveEffectiveServingMode(
  validated: ValidatedPlanFragment,
  safetyFlags: ConversationState["safetyFlags"] = validated.safetyFlags,
): ServingMode | null {
  if (validated.finalAction === "answer") {
    return "answer";
  }

  if (validated.finalAction === "refuse") {
    return validated.selectedServingMode === "excluded" ? "excluded" : null;
  }

  if (isHandoffFamilyAction(validated.finalAction)) {
    if (
      validated.selectedServingMode === "route_vulnerability" ||
      hasVulnerabilitySafetyFlag(safetyFlags)
    ) {
      return "route_vulnerability";
    }

    if (validated.selectedServingMode === "excluded") {
      return "excluded";
    }

    if (
      validated.selectedServingMode === "handoff_account_specific" ||
      hasHandoffSafetyFlag(safetyFlags)
    ) {
      return "handoff_account_specific";
    }

    return "handoff_account_specific";
  }

  return null;
}

function applyHandoffStateRules(
  state: ConversationState,
  validated: ValidatedPlanFragment,
  userMessage: string,
): ValidatedPlanFragment {
  const extractedFacts = shouldApplyExtractedHandoffFacts(state, validated)
    ? extractHandoffFacts(userMessage)
    : {};
  const currentValidated =
    Object.keys(extractedFacts).length === 0
      ? validated
      : {
          ...validated,
          collectedFacts: {
            ...extractedFacts,
            ...validated.collectedFacts,
          },
        };

  const urgentRisk = detectUrgentRisk(userMessage);

  if (urgentRisk) {
    return buildUrgentSafetyFragment(currentValidated, urgentRisk);
  }

  const facts = {
    ...state.collectedFacts,
    ...currentValidated.collectedFacts,
  };
  const missingStandardFields = standardHandoffFields.filter(
    (field) => !hasCollectedHandoffField(facts, field),
  );

  if (
    state.lastAction === "create_ticket" &&
    missingStandardFields.length === 0 &&
    hasVulnerabilitySafetyFlag(currentValidated.safetyFlags)
  ) {
    return buildCompletedHandoffFragment(
      state,
      currentValidated,
      "completed_handoff_new_safety_intent",
      "A completed handoff received a new complaint, vulnerability, hardship, legal, or accessibility signal.",
    );
  }

  if (
    shouldCompleteHandoffNow(state, currentValidated, extractedFacts) &&
    missingStandardFields.length === 0
  ) {
    return buildCompletedHandoffFragment(
      state,
      currentValidated,
      "handoff_intake_complete",
      "All requested handoff intake fields are present in conversation state.",
    );
  }

  if (state.handoffPending && hasAnyStandardHandoffFact(extractedFacts)) {
    return buildNextHandoffQuestionFragment(
      currentValidated,
      missingStandardFields,
      "handoff_intake_progress_preserved",
      "A pending handoff turn collected intake facts and should ask only for the next missing standard field.",
    );
  }

  if (currentValidated.finalAction === "create_ticket") {
    if (missingStandardFields.length === 0) {
      return currentValidated;
    }

    return buildMissingHandoffFragment(
      currentValidated,
      missingStandardFields,
      "handoff_intake_incomplete",
      "A ticket cannot be created until every standard handoff field is present.",
    );
  }

  if (
    currentValidated.finalAction !== "request_handoff_intake" ||
    currentValidated.ui.primitive !== "intake_form"
  ) {
    return currentValidated;
  }

  if (missingStandardFields.length === 0) {
    return buildCompletedHandoffFragment(
      state,
      currentValidated,
      "handoff_intake_complete",
      "All requested handoff intake fields are present in conversation state.",
    );
  }

  const customerMessage = currentValidated.safetyFlags.includes(
    "forbidden_credentials",
  )
    ? currentValidated.customerMessage
    : buildHandoffIntroMessage({
        servingMode: currentValidated.selectedServingMode,
        safetyFlags: currentValidated.safetyFlags,
      });

  if (sameIntakeFields(currentValidated.ui.fields, missingStandardFields)) {
    return {
      ...currentValidated,
      customerMessage,
      ui: {
        ...currentValidated.ui,
        message: customerMessage,
      },
      requestedFields: missingStandardFields,
    };
  }

  return {
    ...currentValidated,
    customerMessage,
    ui: {
      ...currentValidated.ui,
      message: customerMessage,
      fields: missingStandardFields,
    },
    requestedFields: missingStandardFields,
  };
}

function buildCompletedHandoffFragment(
  state: ConversationState,
  validated: ValidatedPlanFragment,
  code: string,
  reason: string,
): ValidatedPlanFragment {
  const facts = {
    ...state.collectedFacts,
    ...validated.collectedFacts,
  };
  const customerMessage = buildCompletedHandoffMessage({
    facts,
    safetyFlags: validated.safetyFlags,
  });
  const override: ValidatorOverride = {
    code,
    reason,
    fromAction: validated.finalAction,
    toAction: "create_ticket",
  };

  return {
    ...validated,
    finalAction: "create_ticket",
    customerMessage,
    ui: {
      primitive: "handoff_confirmation",
      message: customerMessage,
    },
    requestedFields: [],
    validatorOverrides: [...validated.validatorOverrides, override],
  };
}

function buildMissingHandoffFragment(
  validated: ValidatedPlanFragment,
  missingFields: readonly IntakeField[],
  code: string,
  reason: string,
): ValidatedPlanFragment {
  const customerMessage =
    "Thanks — I have some of your details, but I still need a few more before I can pass this to the LoanSlam team. Please add the remaining details below.";
  const override: ValidatorOverride = {
    code,
    reason,
    fromAction: validated.finalAction,
    toAction: "request_handoff_intake",
  };

  return {
    ...validated,
    finalAction: "request_handoff_intake",
    customerMessage,
    ui: {
      primitive: "intake_form",
      message: customerMessage,
      fields: [...missingFields],
    },
    requestedFields: [...missingFields],
    validatorOverrides: [...validated.validatorOverrides, override],
  };
}

function buildNextHandoffQuestionFragment(
  validated: ValidatedPlanFragment,
  missingFields: readonly IntakeField[],
  code: string,
  reason: string,
): ValidatedPlanFragment {
  const nextField = missingFields[0];

  if (!nextField) {
    return validated;
  }

  const question = handoffFieldQuestion(nextField);
  const customerMessage = `Thanks, I have that. ${question}`;
  const override: ValidatorOverride = {
    code,
    reason,
    fromAction: validated.finalAction,
    toAction: "ask_clarifying_question",
  };

  return {
    ...validated,
    finalAction: "ask_clarifying_question",
    customerMessage,
    ui: {
      primitive: "clarifying_prompt",
      message: customerMessage,
      questions: [question],
    },
    requestedFields: [nextField],
    selectedServingMode: null,
    selectedRouteReason: null,
    validatorOverrides: [...validated.validatorOverrides, override],
  };
}

function handoffFieldQuestion(field: IntakeField): string {
  switch (field) {
    case "fullName":
      return "What is your full name?";
    case "dateOfBirth":
      return "What is your date of birth?";
    case "postcode":
      return "What is your postcode?";
    case "email":
      return "What email address should the LoanSlam team use?";
    case "phone":
      return "What phone number should the LoanSlam team use?";
  }
}

type UrgentRiskKind = "medical" | "self_harm";

const selfHarmRiskPattern =
  /\b(kill|harm|hurt)\s+myself\b|\bself[-\s]?harm\b|\bsuicid(?:e|al)\b/i;

const negatedSelfHarmPatterns = [
  /\b(?:not|never)\s+(?:suicidal|self[-\s]?harm(?:ing)?)\b/gi,
  /\b(?:not|never)\s+(?:going\s+to|gonna|planning\s+to|trying\s+to|intending\s+to|about\s+to|want(?:ing)?\s+to)?\s*(?:kill|harm|hurt)\s+myself\b/gi,
  /\b(?:not|never)\s+(?:going\s+to|gonna|planning\s+to|trying\s+to|intending\s+to|about\s+to)\s+(?:self[-\s]?harm|end\s+it)\b/gi,
  /\b(?:don't|do\s+not|dont)\s+(?:want|plan|intend|mean|expect)\s+to\s+(?:kill|harm|hurt)\s+myself\b/gi,
  /\b(?:don't|do\s+not|dont)\s+(?:want|plan|intend|mean|expect)\s+to\s+(?:self[-\s]?harm|end\s+it)\b/gi,
  /\b(?:won't|will\s+not)\s+(?:kill|harm|hurt)\s+myself\b/gi,
  /\b(?:won't|will\s+not)\s+(?:self[-\s]?harm|end\s+it|be\s+suicidal)\b/gi,
];

function buildUrgentSafetyFragment(
  validated: ValidatedPlanFragment,
  kind: UrgentRiskKind,
): ValidatedPlanFragment {
  const customerMessage =
    kind === "medical"
      ? "This could need urgent medical help. Please contact emergency services now if you may be in danger. I can't give medical advice in this chat; the LoanSlam team can review any loan issue separately, but urgent help comes first."
      : "I'm sorry you're feeling this way. If you might hurt yourself or are in immediate danger, please contact emergency services or a crisis support service now. I can't provide crisis support in this chat; the LoanSlam team can review any loan issue separately, but urgent help comes first.";
  const override: ValidatorOverride = {
    code: "urgent_safety_escalation_copy",
    reason:
      "Immediate self-harm or medical-emergency language must get urgent safety signposting before LoanSlam intake.",
    fromAction: validated.finalAction,
    toAction: "escalate",
  };

  return {
    ...validated,
    finalAction: "escalate",
    customerMessage,
    ui: {
      primitive: "handoff_confirmation",
      message: customerMessage,
    },
    requestedFields: [],
    safetyFlags: mergeSafetyFlags(validated.safetyFlags, ["vulnerability"]),
    validatorOverrides: [...validated.validatorOverrides, override],
  };
}

function buildCompletedHandoffMessage({
  facts,
  safetyFlags,
}: {
  facts: Record<string, string>;
  safetyFlags: readonly ConversationState["safetyFlags"][number][];
}): string {
  const contactText = buildContactText(facts);

  if (safetyFlags.includes("complaint")) {
    return `I've passed your complaint to the LoanSlam team. ${contactText}`;
  }

  if (hasVulnerabilitySafetyFlag(safetyFlags)) {
    return `I've passed this to the LoanSlam team so a person can help you carefully. ${contactText}`;
  }

  return `I've passed this to the LoanSlam team. ${contactText}`;
}

function buildContactText(facts: Record<string, string>): string {
  const email = facts.email?.trim();
  const phone = facts.phone?.trim();

  if (email && phone) {
    return "The team can use the contact details you provided to follow up.";
  }

  if (email) {
    return "The team can use the email address you provided to follow up.";
  }

  if (phone) {
    return "The team can use the phone number you provided to follow up.";
  }

  return "The team can use the details you provided to follow up.";
}

function buildSupportReference(conversationRef: string): string {
  const normalized = conversationRef.replace(/[^a-z0-9]/gi, "").toUpperCase();
  const suffix = normalized.slice(0, 16);

  return suffix ? `LS-${suffix}` : "LS-SUPPORT";
}

/**
 * Deterministically completes a handoff from a structured intake form
 * submission. Bypasses the planner, signal extractor, and free-text fact
 * extractor: the form already provides exact, validated field values, so this
 * just merges them, builds the ticket confirmation, and ends the handoff.
 */
export function completeStructuredHandoff({
  state,
  fields,
  now = new Date(),
  idFactory = randomUUID,
}: {
  state: ConversationState;
  fields: Record<string, string>;
  now?: Date;
  idFactory?: () => string;
}): {
  state: ConversationState;
  finalAction: "create_ticket";
  ui: UiPlan;
  customerMessage: string;
  reference: string;
} {
  const collectedFacts = { ...state.collectedFacts };
  for (const field of standardHandoffFields) {
    const value = fields[field]?.trim();
    if (value) {
      collectedFacts[field] = value;
    }
  }

  const reference = buildSupportReference(state.conversationRef);
  const customerMessage = buildCompletedHandoffMessage({
    facts: collectedFacts,
    safetyFlags: state.safetyFlags,
  });
  const ui: UiPlan = {
    primitive: "handoff_confirmation",
    message: customerMessage,
  };
  const createdAt = now.toISOString();

  return {
    state: {
      ...state,
      history: [
        ...state.history,
        {
          id: idFactory(),
          role: "customer",
          content: "Submitted contact details.",
          createdAt,
        },
        {
          id: idFactory(),
          role: "assistant",
          content: customerMessage,
          createdAt,
        },
      ],
      collectedFacts,
      requestedFields: [],
      lastAction: "create_ticket",
      handoffPending: false,
    },
    finalAction: "create_ticket",
    ui,
    customerMessage,
    reference,
  };
}

/**
 * Clears a pending handoff so the customer returns to the normal chat loop.
 * Resets the accumulated safety flags too, because the validator re-forces
 * handoff whenever a vulnerability-family flag is present and those flags
 * otherwise persist for the life of the session.
 */
export function cancelHandoff(state: ConversationState): ConversationState {
  return {
    ...state,
    requestedFields: [],
    safetyFlags: [],
    handoffPending: false,
    lastAction: undefined,
  };
}

function buildHandoffIntroMessage({
  servingMode,
  safetyFlags,
}: {
  servingMode: ServingMode | null;
  safetyFlags: readonly ConversationState["safetyFlags"][number][];
}): string {
  if (safetyFlags.includes("complaint")) {
    return "I'm sorry you've had a poor experience. I'll pass this to the LoanSlam team as a complaint so a person can look into it properly. Please share a few contact details below so they can get back to you.";
  }

  if (hasVulnerabilitySafetyFlag(safetyFlags)) {
    return "I'd rather get you to a person who can help with this properly. Please share a few contact details below and the LoanSlam team will be in touch.";
  }

  if (
    servingMode === "handoff_account_specific" ||
    hasHandoffSafetyFlag(safetyFlags)
  ) {
    return "I can't view or change account details myself in this chat, so I'll pass this to the LoanSlam team. They'll confirm your identity first, so please share a few contact details below and they'll be in touch.";
  }

  return "I'll pass this to the LoanSlam team so a person can help. Please share a few contact details below so they can get back to you.";
}

function detectUrgentRisk(message: string): UrgentRiskKind | null {
  if (selfHarmRiskPattern.test(message) && !negatesSelfHarm(message)) {
    return "self_harm";
  }

  if (
    /\b(chest\s+pain|can't\s+breathe|cannot\s+breathe|stroke|heart\s+attack)\b/i.test(
      message,
    ) ||
    /\b(go|going)\s+to\s+hospital\b/i.test(message)
  ) {
    return "medical";
  }

  return null;
}

function negatesSelfHarm(message: string): boolean {
  const withoutNegatedPhrases = negatedSelfHarmPatterns.reduce(
    (text, pattern) => text.replace(pattern, " "),
    message,
  );

  return (
    withoutNegatedPhrases !== message &&
    !selfHarmRiskPattern.test(withoutNegatedPhrases)
  );
}

function shouldApplyExtractedHandoffFacts(
  state: ConversationState,
  validated: ValidatedPlanFragment,
): boolean {
  return state.handoffPending || isHandoffFamilyAction(validated.finalAction);
}

function shouldCompleteHandoffNow(
  state: ConversationState,
  validated: ValidatedPlanFragment,
  extractedFacts: Record<string, string>,
): boolean {
  if (!state.handoffPending) {
    return false;
  }

  return (
    isHandoffFamilyAction(validated.finalAction) ||
    validated.finalAction === "fallback" ||
    hasAnyStandardHandoffFact(extractedFacts)
  );
}

function extractHandoffFacts(message: string): Record<string, string> {
  const facts: Record<string, string> = {};

  captureFact(message, facts, "fullName", [
    /\bfull name\s*:\s*([^.\n]+)/i,
    /\bmy name is\s+([^,.\n]+)/i,
  ]);
  captureFact(message, facts, "dateOfBirth", [
    /\b(?:date of birth|dob)\s*:\s*([^.\n]+)/i,
    /\bmy (?:date of birth|dob) is\s+([^,.\n]+)/i,
  ]);
  captureFact(message, facts, "postcode", [
    /\bpostcode\s*:?\s*([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i,
    /\bmy postcode is\s+([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i,
    /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i,
  ]);
  captureFact(message, facts, "phone", [
    /\bphone\s*:\s*([^.\n]+)/i,
    /\bmy phone is\s+([^,.\n]+)/i,
  ]);
  captureFact(message, facts, "email", [
    /\bemail\s*:\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
    /\bmy email is\s+([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  ]);

  return facts;
}

function captureFact(
  message: string,
  facts: Record<string, string>,
  field: IntakeField,
  patterns: readonly RegExp[],
): void {
  if (facts[field]) {
    return;
  }

  for (const pattern of patterns) {
    const value = cleanFactValue(message.match(pattern)?.[1]);

    if (value) {
      facts[field] = value;
      return;
    }
  }
}

function cleanFactValue(value: string | undefined): string {
  return (
    value
      ?.replace(/\s+/g, " ")
      .replace(/[.,;:\s]+$/g, "")
      .trim() ?? ""
  );
}

function hasAnyStandardHandoffFact(facts: Record<string, string>): boolean {
  return standardHandoffFields.some((field) => Boolean(facts[field]?.trim()));
}

function hasCollectedHandoffField(
  facts: Record<string, string>,
  field: IntakeField,
): boolean {
  const exactValue = facts[field]?.trim();
  const candidateValue = facts[`${field}_candidate`]?.trim();

  return Boolean(exactValue || candidateValue);
}

function sameIntakeFields(
  left: readonly IntakeField[],
  right: readonly IntakeField[],
): boolean {
  return (
    left.length === right.length &&
    left.every((field) => right.includes(field)) &&
    right.every((field) => left.includes(field))
  );
}

async function planAndValidateTurn({
  planner,
  plannerInput,
  retrievedMatches,
  userMessage,
  signalBundle,
}: {
  planner: ProcessTurnInput["planner"];
  plannerInput: Parameters<TurnPlanner["planTurn"]>[0];
  retrievedMatches: ReturnType<typeof retrieveMatches>;
  userMessage: string;
  signalBundle: SignalBundle | undefined;
}): Promise<{
  plan: TurnPlan;
  validated: ValidatedPlanFragment;
  plannerLatencyMs: number;
}> {
  let plan: TurnPlan;
  const plannerStartedAt = Date.now();

  try {
    plan = await planner.planTurn(plannerInput);
  } catch (error) {
    const plannerLatencyMs = Date.now() - plannerStartedAt;
    const reason = "I could not safely choose the next step from this message.";
    const traceReason = plannerFailureReason(error);
    const fallback = buildFallbackCopy(reason);
    plan = {
      action: fallback.action,
      customerMessage: fallback.customerMessage,
      ui: fallback.ui,
      reasonCode: "planner_malformed_output",
      collectedFacts: {},
      requestedFields: [],
      grounding: null,
      safetyFlags: [],
      traceSummary: traceReason,
    };

    if (
      canRecoverMalformedPlanFromRouteEvidence(signalBundle, retrievedMatches)
    ) {
      const recovered = validateTurnPlan(plan, retrievedMatches, {
        userMessage,
        ...(signalBundle ? { signalBundle } : {}),
      });

      return {
        plan,
        plannerLatencyMs,
        validated: {
          ...recovered,
          validatorOverrides: [
            {
              code: "malformed_plan",
              reason: traceReason,
              toAction: recovered.finalAction,
            },
            ...recovered.validatorOverrides,
          ],
        },
      };
    }

    return {
      plan,
      plannerLatencyMs,
      validated: {
        plan,
        finalAction: fallback.action,
        ui: fallback.ui,
        customerMessage: fallback.customerMessage,
        requestedFields: [],
        collectedFacts: {},
        validatorOverrides: [
          {
            code: "malformed_plan",
            reason: traceReason,
            toAction: fallback.action,
          },
        ],
        selectedServingMode: null,
        selectedRouteReason: null,
        safetyFlags: [],
      },
    };
  }

  return {
    plan,
    plannerLatencyMs: Date.now() - plannerStartedAt,
    validated: validateTurnPlan(plan, retrievedMatches, {
      userMessage,
      ...(signalBundle ? { signalBundle } : {}),
    }),
  };
}

function canRecoverMalformedPlanFromRouteEvidence(
  signalBundle: SignalBundle | undefined,
  retrievedMatches: ReturnType<typeof retrieveMatches>,
): boolean {
  const recommendedMode = signalBundle?.recommendedServingMode;

  if (!recommendedMode || recommendedMode === "answer") {
    return false;
  }

  return retrievedMatches[0]?.servingMode === recommendedMode;
}

function plannerFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  return `The planner response could not be validated. ${message}`;
}

const defaultPlannerMetadata: PlannerMetadata = {
  provider: "inline",
  model: "inline-test-planner",
  promptVersion: "phase0-task3",
};

function mergeState({
  state,
  userMessage,
  inboundMessageId,
  outboundMessageId,
  createdAt,
  customerMessage,
  collectedFacts,
  requestedFields,
  safetyFlags,
  finalAction,
}: {
  state: ConversationState;
  userMessage: string;
  inboundMessageId: string;
  outboundMessageId: string;
  createdAt: string;
  customerMessage: string;
  collectedFacts: Record<string, string>;
  requestedFields: ConversationState["requestedFields"];
  safetyFlags: ConversationState["safetyFlags"];
  finalAction: ConversationState["lastAction"];
}): ConversationState {
  const handoffPending = nextHandoffPending(state, finalAction);

  return {
    ...state,
    history: [
      ...state.history,
      {
        id: inboundMessageId,
        role: "customer",
        content: userMessage,
        createdAt,
      },
      {
        id: outboundMessageId,
        role: "assistant",
        content: customerMessage,
        createdAt,
      },
    ],
    collectedFacts: {
      ...state.collectedFacts,
      ...collectedFacts,
    },
    requestedFields: [...new Set(requestedFields)],
    safetyFlags: nextStateSafetyFlags({
      state,
      safetyFlags,
      finalAction,
      handoffPending,
    }),
    lastAction: finalAction,
    handoffPending,
  };
}

function nextStateSafetyFlags({
  state,
  safetyFlags,
  finalAction,
  handoffPending,
}: {
  state: ConversationState;
  safetyFlags: ConversationState["safetyFlags"];
  finalAction: ConversationState["lastAction"];
  handoffPending: boolean;
}): ConversationState["safetyFlags"] {
  if (
    handoffPending &&
    (isHandoffFamilyAction(finalAction) ||
      finalAction === "ask_clarifying_question")
  ) {
    return mergeSafetyFlags(state.safetyFlags, safetyFlags);
  }

  return mergeSafetyFlags(safetyFlags);
}

function nextHandoffPending(
  state: ConversationState,
  finalAction: ConversationState["lastAction"],
): boolean {
  if (isHandoffFamilyAction(finalAction)) {
    return true;
  }

  if (
    finalAction === "answer" ||
    finalAction === "refuse" ||
    finalAction === "fallback" ||
    finalAction === "ask_clarifying_question"
  ) {
    if (finalAction === "ask_clarifying_question") {
      return state.handoffPending;
    }

    return state.lastAction === "create_ticket" && state.handoffPending;
  }

  return state.handoffPending;
}

function mergeTraceSafetyFlags(
  state: ConversationState,
  validated: ValidatedPlanFragment,
): ConversationState["safetyFlags"] {
  if (validated.finalAction === "answer") {
    if (validated.selectedServingMode === "answer") {
      return validated.safetyFlags.filter(
        (flag) => !isHandoffRouteSafetyFlag(flag),
      );
    }

    return validated.safetyFlags;
  }

  if (
    validated.finalAction === "refuse" ||
    validated.finalAction === "fallback" ||
    validated.finalAction === "ask_clarifying_question"
  ) {
    return validated.safetyFlags;
  }

  return mergeSafetyFlags(state.safetyFlags, validated.safetyFlags);
}

function isHandoffRouteSafetyFlag(
  flag: ConversationState["safetyFlags"][number],
): boolean {
  const routeFlags: readonly ConversationState["safetyFlags"][number][] =
    handoffSafetyFlags;

  return routeFlags.includes(flag);
}

function mergeSafetyFlags(
  ...flagGroups: readonly ConversationState["safetyFlags"][]
): ConversationState["safetyFlags"] {
  return [...new Set(flagGroups.flat())];
}
