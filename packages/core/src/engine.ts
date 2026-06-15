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

  const shadowSignal = await captureShadowSignals({
    signalExtractor,
    state,
    userMessage,
    timeoutMs: signalExtractorTimeoutMs,
  });
  const signalBundle =
    shadowSignal.status === "fulfilled" ? shadowSignal.bundle : undefined;
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

  const { plan, validated: policyValidated } = await planAndValidateTurn({
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
      shadowSignal.status === "fulfilled" ? shadowSignal.bundle : undefined,
    finalServingMode: effectiveServingMode,
    finalSafetyFlags: traceSafetyFlags,
    signalStatus: shadowSignal.status,
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
    policyVersion,
    retrievedMatches,
    shadowSignalStatus: shadowSignal.status,
    ...shadowSignalTraceFields(shadowSignal),
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

type ShadowSignalOutcome =
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

async function captureShadowSignals({
  signalExtractor,
  state,
  userMessage,
  timeoutMs,
}: {
  signalExtractor: SignalExtractor | undefined;
  state: ConversationState;
  userMessage: string;
  timeoutMs: number;
}): Promise<ShadowSignalOutcome> {
  if (!signalExtractor) {
    return { status: "disabled", latencyMs: 0 };
  }

  const startedAt = Date.now();
  const abortController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const extractionPromise: Promise<ShadowSignalOutcome> = signalExtractor
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

  const timeoutPromise = new Promise<ShadowSignalOutcome>((resolve) => {
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

function shadowSignalTraceFields(outcome: ShadowSignalOutcome): {
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

  if (
    validated.finalAction === "request_handoff_intake" ||
    validated.finalAction === "create_ticket" ||
    validated.finalAction === "escalate"
  ) {
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
    isCompletedHandoffFollowUp(userMessage)
  ) {
    return buildCompletedHandoffFragment(
      state,
      currentValidated,
      "completed_handoff_follow_up",
      "A completed handoff follow-up should preserve the completed handoff state.",
    );
  }

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
    shouldCompleteHandoffNow(
      state,
      currentValidated,
      extractedFacts,
      userMessage,
    ) &&
    missingStandardFields.length === 0
  ) {
    return buildCompletedHandoffFragment(
      state,
      currentValidated,
      "handoff_intake_complete",
      "All requested handoff intake fields are present in conversation state.",
    );
  }

  if (
    state.handoffPending &&
    hasHandoffSafetyFlag(state.safetyFlags) &&
    isPendingHandoffReferentialFollowUp(userMessage)
  ) {
    if (missingStandardFields.length === 0) {
      return buildCompletedHandoffFragment(
        state,
        currentValidated,
        "pending_handoff_reference_complete",
        "A pending account-specific handoff follow-up refers back to a complete handoff request.",
      );
    }

    return buildMissingHandoffFragment(
      currentValidated,
      missingStandardFields,
      "pending_handoff_reference_preserved",
      "A pending account-specific handoff follow-up refers back to the existing handoff request.",
    );
  }

  if (state.handoffPending && missingStandardFields.length > 0) {
    if (currentValidated.safetyFlags.includes("complaint")) {
      return buildPendingHandoffComplaintFragment(
        currentValidated,
        missingStandardFields,
      );
    }

    if (isPendingHandoffEmergencyText(userMessage)) {
      return buildPendingHandoffDeclinedFragment(
        currentValidated,
        "handoff_emergency_text",
        "The customer entered alarming emergency-like text during handoff intake.",
        buildHandoffEmergencyMessage(),
      );
    }

    if (isPendingHandoffDetailsRefusal(userMessage)) {
      return buildPendingHandoffDeclinedFragment(
        currentValidated,
        "handoff_details_declined",
        "The customer declined to provide handoff details in chat.",
        buildHandoffDetailsDeclinedMessage(),
      );
    }

    if (isPendingHandoffHostileAbort(userMessage)) {
      return buildPendingHandoffDeclinedFragment(
        currentValidated,
        "handoff_hostile_abort",
        "The customer responded angrily to handoff intake.",
        buildHandoffHostileAbortMessage(),
      );
    }

    if (isPendingHandoffWhyQuestion(userMessage)) {
      return buildPendingHandoffReasonFragment(
        currentValidated,
        missingStandardFields,
      );
    }
  }

  if (state.handoffPending && hasAnyStandardHandoffFact(extractedFacts)) {
    return buildMissingHandoffFragment(
      currentValidated,
      missingStandardFields,
      "handoff_intake_progress_preserved",
      "A pending handoff turn collected intake facts but still needs more standard fields.",
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

  const customerMessage = buildHandoffIntakeMessage(missingStandardFields);

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
  const reference = buildSupportReference(state.conversationRef);
  const customerMessage = buildCompletedHandoffMessage({
    facts,
    reference,
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
      reference,
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
  const customerMessage = buildHandoffIntakeMessage(missingFields);
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

function buildPendingHandoffReasonFragment(
  validated: ValidatedPlanFragment,
  missingFields: readonly IntakeField[],
): ValidatedPlanFragment {
  const customerMessage = buildPendingHandoffReasonMessage(
    validated.safetyFlags,
  );
  const override: ValidatorOverride = {
    code: "handoff_intake_reason_explained",
    reason: "A pending handoff customer asked why details are needed.",
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

function buildPendingHandoffComplaintFragment(
  validated: ValidatedPlanFragment,
  missingFields: readonly IntakeField[],
): ValidatedPlanFragment {
  const customerMessage =
    "I can pass your complaint to the Loanslam team. To do that from this chat, a person needs enough details to identify the case. Please share your full name when you are ready, or tell me if you do not want to share details here.";
  const override: ValidatorOverride = {
    code: "pending_handoff_complaint_reframed",
    reason:
      "A pending handoff customer raised a complaint, so the intake copy must acknowledge the complaint.",
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

function buildPendingHandoffDeclinedFragment(
  validated: ValidatedPlanFragment,
  code: string,
  reason: string,
  customerMessage: string,
): ValidatedPlanFragment {
  const override: ValidatorOverride = {
    code,
    reason,
    fromAction: validated.finalAction,
    toAction: "fallback",
  };

  return {
    ...validated,
    finalAction: "fallback",
    customerMessage,
    ui: {
      primitive: "safe_fallback",
      message: customerMessage,
      links: [],
    },
    requestedFields: [],
    validatorOverrides: [...validated.validatorOverrides, override],
  };
}

function buildCompletedHandoffMessage({
  facts,
  reference,
  safetyFlags,
}: {
  facts: Record<string, string>;
  reference: string;
  safetyFlags: readonly ConversationState["safetyFlags"][number][];
}): string {
  const contactText = buildContactText(facts);
  const referenceText = `Your customer services support reference is ${reference}.`;

  if (safetyFlags.includes("complaint")) {
    return `I've passed your complaint to the Loanslam team. ${contactText}\n\n${referenceText}`;
  }

  if (hasVulnerabilitySafetyFlag(safetyFlags)) {
    return `I've passed this to the Loanslam team so a person can help you carefully. ${contactText}\n\n${referenceText}`;
  }

  return `I've passed this to the Loanslam team. ${contactText}\n\n${referenceText}`;
}

function buildContactText(facts: Record<string, string>): string {
  const email = facts.email?.trim();
  const phone = facts.phone?.trim();

  if (email && phone) {
    return `They will contact you on ${email} or ${phone} within the next 48 hours.`;
  }

  if (email) {
    return `They will contact you on ${email} within the next 48 hours.`;
  }

  if (phone) {
    return `They will contact you on ${phone} within the next 48 hours.`;
  }

  return "They will contact you using the details you provided within the next 48 hours.";
}

function buildSupportReference(conversationRef: string): string {
  const normalized = conversationRef.replace(/[^a-z0-9]/gi, "").toUpperCase();
  const suffix = normalized.slice(0, 16);

  return suffix ? `LS-${suffix}` : "LS-SUPPORT";
}

const handoffFieldLabels = {
  fullName: "your full name",
  dateOfBirth: "your date of birth",
  address: "your address",
  phone: "your phone number",
  email: "your email address",
  situationSummary: "a short summary of what you need help with",
} as const satisfies Record<IntakeField, string>;

function buildHandoffIntakeMessage(
  missingFields: readonly IntakeField[],
): string {
  const fields = missingFields.map((field) => handoffFieldLabels[field]);
  const firstField = fields[0];

  if (firstField === undefined) {
    return "I have the details needed to pass this to the Loanslam team.";
  }

  const needText =
    missingFields.length === standardHandoffFields.length
      ? "I need"
      : "I still need";

  return `To pass this to the Loanslam team, ${needText} ${formatList(fields)}. Let's start with ${firstField}.`;
}

function buildPendingHandoffReasonMessage(
  safetyFlags: readonly ConversationState["safetyFlags"][number][],
): string {
  if (safetyFlags.includes("complaint")) {
    return "Because you said you want to complain, a person at Loanslam should handle it rather than this chat debating the issue. You do not have to share details here. If you want me to pass it to the team, they need enough details to identify the case.";
  }

  if (hasVulnerabilitySafetyFlag(safetyFlags)) {
    return "Because you mentioned losing your job or financial difficulty, a person at Loanslam should handle it rather than me giving a general chat answer. You do not have to share details here. If you want me to pass it to the team, they need enough details to identify the request.";
  }

  return "Because this looks like something the Loanslam team needs to handle directly, they need enough details to identify the request. You do not have to share details here, and I can still answer general Loanslam questions.";
}

function buildHandoffDetailsDeclinedMessage(): string {
  return "That's okay. You do not have to share details here. Without those details, I can only answer general Loanslam questions in this chat. If you want a person to help with this, the team will need enough details to identify the request.";
}

function buildHandoffHostileAbortMessage(): string {
  return "I will not keep asking for details. You do not have to share them here. If you want help later, ask a general Loanslam question or say you want the Loanslam team.";
}

function buildHandoffEmergencyMessage(): string {
  return "If anyone is in immediate danger, contact emergency services now. This chat cannot handle emergencies. I will stop asking for personal details here, and I can still answer general Loanslam questions.";
}

function shouldApplyExtractedHandoffFacts(
  state: ConversationState,
  validated: ValidatedPlanFragment,
): boolean {
  return (
    state.handoffPending ||
    validated.finalAction === "request_handoff_intake" ||
    validated.finalAction === "create_ticket" ||
    validated.finalAction === "escalate"
  );
}

function shouldCompleteHandoffNow(
  state: ConversationState,
  validated: ValidatedPlanFragment,
  extractedFacts: Record<string, string>,
  userMessage: string,
): boolean {
  if (!state.handoffPending) {
    return false;
  }

  return (
    validated.finalAction === "create_ticket" ||
    validated.finalAction === "request_handoff_intake" ||
    validated.finalAction === "escalate" ||
    validated.finalAction === "fallback" ||
    hasAnyStandardHandoffFact(extractedFacts) ||
    isCompletedHandoffFollowUp(userMessage)
  );
}

function extractHandoffFacts(message: string): Record<string, string> {
  const facts: Record<string, string> = {};

  captureFact(message, facts, "fullName", [
    /\bfull name\s*:\s*([^.\n]+)/i,
    /\bmy name is\s+([^,.\n]+)/i,
  ]);
  captureFact(message, facts, "dateOfBirth", [
    /\bdate of birth\s*:\s*([^.\n]+)/i,
    /\bmy dob is\s+([^,.\n]+)/i,
  ]);
  captureFact(message, facts, "address", [
    /\baddress\s*:\s*([\s\S]*?)(?=\.\s*(?:phone|email|situation summary)\s*:|$)/i,
    /\baddress is\s+([\s\S]*?)(?=\s+if that is enough|\.|$)/i,
  ]);
  captureFact(message, facts, "phone", [
    /\bphone\s*:\s*([^.\n]+)/i,
    /\bmy phone is\s+([^,.\n]+)/i,
  ]);
  captureFact(message, facts, "email", [
    /\bemail\s*:\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
    /\bmy email is\s+([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  ]);
  captureFact(message, facts, "situationSummary", [
    /\bsituation summary\s*:\s*([\s\S]+)$/i,
    /\band i want to\s+([\s\S]*?)(?=\.|$)/i,
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

function formatList(items: readonly string[]): string {
  if (items.length === 0) {
    return "";
  }

  if (items.length === 1) {
    return items[0] ?? "";
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
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

function isCompletedHandoffFollowUp(message: string): boolean {
  return completedHandoffFollowUpPattern.test(message);
}

const completedHandoffFollowUpPattern =
  /\b(what\s+(happens|happen|now|next)|what'?s\s+next|what\s+is\s+next|so\s+what\s+happens|what\s+(details|fields)|which\s+(details|fields)|still\s+missing|anything\s+missing|do\s+you\s+need|stored\s+details|hidden\s+state)\b/i;

function isPendingHandoffReferentialFollowUp(message: string): boolean {
  return pendingHandoffReferencePattern.test(message);
}

const pendingHandoffReferencePattern =
  /\b(?:can|could|will|would)\s+you\s+(?:give|show|tell|send)\s+(?:it|that|this|them)\s+(?:to\s+me|me)?\b|\b(?:give|show|send|tell)\s+(?:it|that|this|them)\s+(?:to\s+me|me)\b|\bwhat\s+is\s+(?:it|that)\b/i;

function isPendingHandoffWhyQuestion(message: string): boolean {
  return pendingHandoffWhyPattern.test(message);
}

const pendingHandoffWhyPattern =
  /^\s*(?:why|why\s+(?:do\s+you|does\s+the\s+team|is\s+that|is\s+this)|what\s+for|for\s+what)(?:\s+(?:need|want|ask|asking|details|that|this|my\s+details|those\s+details))*\s*[?!.\s]*$/i;

function isPendingHandoffDetailsRefusal(message: string): boolean {
  return (
    pendingHandoffDetailsRefusalPattern.test(message) ||
    pendingHandoffDetailsRefusalTextPattern.test(message)
  );
}

const pendingHandoffDetailsRefusalPattern = /^\s*(?:no+|nope|nah)\s*[!?.\s]*$/i;

const pendingHandoffDetailsRefusalTextPattern =
  /\b(?:i\s+)?(?:do\s+not|don't|dont|won't|wont|will\s+not|cannot|can't|cant)\s+(?:want\s+to\s+)?(?:give|share|provide|send|enter)\s+(?:my\s+)?(?:details|personal\s+(?:details|information|info)|info|information|name|dob|date\s+of\s+birth|address|phone|email)\b|\b(?:i\s+)?(?:do\s+not|don't|dont|won't|wont|will\s+not)\s+(?:want\s+to|want\s+this|like\s+this)\b|\b(?:i\s+)?(?:do\s+not|don't|dont)\s+like\s+this\b|\b(?:no|nope|nah)\b.{0,50}\b(?:details|personal\s+(?:details|information|info)|info|information)\b|\b(?:stop\s+asking|cancel\s+this|forget\s+it)\b/i;

function isPendingHandoffHostileAbort(message: string): boolean {
  return pendingHandoffHostileAbortPattern.test(message);
}

const pendingHandoffHostileAbortPattern =
  /\b(?:fuck\s+off|fuck\s+you|piss\s+off|shut\s+up|go\s+away)\b/i;

function isPendingHandoffEmergencyText(message: string): boolean {
  return pendingHandoffEmergencyPattern.test(message);
}

const pendingHandoffEmergencyPattern =
  /\b(?:police|death|blood|murder|kill|killed|dead|dying)\b/i;

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
}): Promise<{ plan: TurnPlan; validated: ValidatedPlanFragment }> {
  let plan: TurnPlan;

  try {
    plan = await planner.planTurn(plannerInput);
  } catch (error) {
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

    return {
      plan,
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
    validated: validateTurnPlan(plan, retrievedMatches, {
      userMessage,
      ...(signalBundle ? { signalBundle } : {}),
    }),
  };
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
    safetyFlags: [...new Set([...state.safetyFlags, ...safetyFlags])],
    lastAction: finalAction,
    handoffPending: nextHandoffPending(state, finalAction),
  };
}

function nextHandoffPending(
  state: ConversationState,
  finalAction: ConversationState["lastAction"],
): boolean {
  if (
    finalAction === "request_handoff_intake" ||
    finalAction === "escalate" ||
    finalAction === "create_ticket"
  ) {
    return true;
  }

  if (
    finalAction === "answer" ||
    finalAction === "refuse" ||
    finalAction === "fallback" ||
    finalAction === "ask_clarifying_question"
  ) {
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
