import type {
  IntakeField,
  RetrievedMatch,
  SafetyFlag,
  ServingMode,
  SignalBundle,
  TurnAction,
  TurnPlan,
  UiPlan,
  ValidatorOverride,
} from "@loanslam/contracts";

import {
  buildApprovalEstimateBoundaryCopy,
  buildApprovalStatusHandoffCopy,
  buildAccountChangeHandoffCopy,
  buildBadCreditEligibilityCopy,
  buildCreditCheckEvasionBoundaryCopy,
  buildExcludedCopy,
  buildCredentialHandoffCopy,
  buildFallbackCopy,
  buildHandoffCopy,
  buildInternalDataBoundaryCopy,
  buildPaymentLinkHandoffCopy,
  buildReferenceOfferHandoffCopy,
  buildSecondaryBorrowingBoundaryCopy,
  buildVulnerabilityCopy,
  containsForbiddenCredentialTerm,
  detectApprovalEstimateRequest,
  detectApprovalStatusQuestion,
  detectBadCreditEligibilityQuestion,
  detectCreditCheckEvasionRequest,
  detectCredentialBoundaryRequest,
  detectForbiddenCredentialRequest,
  detectIntakeStyleInternalDataExposureRequest,
  detectInternalDataExposureRequest,
  detectPaymentLinkRequest,
  detectPromisedAccountValueOrOutcome,
  detectReferenceOffer,
  detectSecondaryBorrowingAdviceRequest,
  detectSensitiveOvershare,
  hasHandoffSafetyFlag,
  hasVulnerabilitySafetyFlag,
  handoffSafetyFlags,
  standardHandoffFields,
  uiMatchesAction,
  vulnerabilitySafetyFlags,
} from "./policy";

export interface ValidateTurnPlanOptions {
  safetyFlags?: readonly SafetyFlag[];
  userMessage?: string;
  signalBundle?: SignalBundle;
}

export interface ValidatedPlanFragment {
  plan: TurnPlan;
  finalAction: TurnAction;
  ui: UiPlan;
  customerMessage: string;
  requestedFields: IntakeField[];
  collectedFacts: Record<string, string>;
  validatorOverrides: ValidatorOverride[];
  selectedServingMode: ServingMode | null;
  selectedRouteReason: string | null;
  safetyFlags: SafetyFlag[];
}

interface OverrideInput {
  code: string;
  reason: string;
  toAction: TurnAction;
}

// The validator is an ordered pipeline of safety guards. Each guard inspects the
// turn and either rewrites it (returns a fragment) or declines (returns null) so
// the next guard runs. validateTurnPlan runs them top to bottom and returns the
// first rewrite, or the un-overridden base if every guard declines.
interface GuardContext {
  plan: TurnPlan;
  retrievedMatches: readonly RetrievedMatch[];
  options: ValidateTurnPlanOptions;
  userMessage: string;
  selectedMatch: RetrievedMatch | undefined;
  vulnerabilityMatch: RetrievedMatch | undefined;
  planSafetyFlags: SafetyFlag[];
  allSafetyFlags: SafetyFlag[];
  base: ValidatedPlanFragment;
}

type TurnGuard = (context: GuardContext) => ValidatedPlanFragment | null;

// ORDER IS A SAFETY INVARIANT. The internal-data and credential guards MUST run
// before the vulnerability / serving-mode / grounding guards, so an injected or
// credential-bearing message can never be re-routed by a spurious retrieval
// match. This array's order is the historical top-to-bottom clause order and is
// pinned by a test in validator.test.ts; reordering it changes safety behaviour.
export const safetyGuardPipeline: readonly TurnGuard[] = [
  guardInternalDataExposure,
  guardCredentialBoundary,
  guardPaymentLink,
  guardForbiddenCredentialRequestInPlan,
  guardForbiddenCredentialsInFacts,
  guardSecondaryBorrowingAdvice,
  guardCreditCheckEvasion,
  guardApprovalEstimateAdvice,
  guardBadCreditEligibilityAnswer,
  guardApprovalStatusHandoff,
  guardReferenceOfferHandoff,
  guardAccountChangeHandoffAcknowledgement,
  guardPromisedAccountValue,
  guardOutOfDomainFallback,
  guardVulnerabilityRoute,
  guardNonAnswerServingMode,
  guardAnswerGrounding,
  guardUiActionMatch,
];

export function validateTurnPlan(
  plan: TurnPlan,
  retrievedMatches: readonly RetrievedMatch[],
  options: ValidateTurnPlanOptions = {},
): ValidatedPlanFragment {
  const context = buildGuardContext(plan, retrievedMatches, options);

  for (const guard of safetyGuardPipeline) {
    const outcome = guard(context);
    if (outcome) {
      return outcome;
    }
  }

  return context.base;
}

function buildGuardContext(
  plan: TurnPlan,
  retrievedMatches: readonly RetrievedMatch[],
  options: ValidateTurnPlanOptions,
): GuardContext {
  const selectedMatch = selectPolicyMatch(plan, retrievedMatches);
  const planSafetyFlags = alignPlanSafetyFlagsWithSignal(
    plan.safetyFlags,
    options.signalBundle,
  );
  const allSafetyFlags = uniqueSafetyFlags([
    ...(options.safetyFlags ?? []),
    ...inferSafetyFlagsFromSignal(options.signalBundle),
    ...planSafetyFlags,
    ...inferSafetyFlagsFromMatches(selectedMatch ? [selectedMatch] : []),
    ...inferSafetyFlagsFromMessage(options.userMessage ?? ""),
  ]);

  const base: ValidatedPlanFragment = {
    plan,
    finalAction: plan.action,
    ui: plan.ui,
    customerMessage: plan.customerMessage,
    requestedFields: normalizeRequestedFields(plan),
    collectedFacts: { ...plan.collectedFacts },
    validatorOverrides: [],
    selectedServingMode:
      selectedMatch?.servingMode ?? plan.grounding?.servingMode ?? null,
    selectedRouteReason: selectedMatch?.item?.route_reason ?? null,
    safetyFlags: allSafetyFlags,
  };

  const vulnerabilityMatch =
    selectedMatch?.servingMode === "route_vulnerability"
      ? selectedMatch
      : undefined;

  return {
    plan,
    retrievedMatches,
    options,
    userMessage: options.userMessage ?? "",
    selectedMatch,
    vulnerabilityMatch,
    planSafetyFlags,
    allSafetyFlags,
    base,
  };
}

function guardInternalDataExposure(
  context: GuardContext,
): ValidatedPlanFragment | null {
  if (!detectInternalDataExposureRequest(context.userMessage)) {
    return null;
  }

  const { base } = context;
  const boundaryReason =
    "Requests for internal traces, hidden instructions, customer data, or policy bypass must not be served in chat.";
  const boundary = buildInternalDataBoundaryCopy(boundaryReason, {
    includeCredentialWarning: detectIntakeStyleInternalDataExposureRequest(
      context.userMessage,
    ),
  });

  if (base.finalAction === "refuse" && base.ui.primitive === "safe_fallback") {
    return {
      ...base,
      selectedServingMode: null,
      selectedRouteReason: boundaryReason,
      safetyFlags: uniqueSafetyFlags([
        ...base.safetyFlags,
        "unsupported_request",
      ]),
    };
  }

  return applyOverride(
    base,
    {
      code: "internal_data_exposure_blocked",
      reason: boundaryReason,
      toAction: boundary.action,
    },
    {
      finalAction: boundary.action,
      customerMessage: boundary.customerMessage,
      ui: boundary.ui,
      requestedFields: [],
      collectedFacts: {},
      selectedServingMode: null,
      selectedRouteReason: boundaryReason,
      safetyFlags: uniqueSafetyFlags([
        ...base.safetyFlags,
        "unsupported_request",
      ]),
    },
  );
}

function guardCredentialBoundary(
  context: GuardContext,
): ValidatedPlanFragment | null {
  const { base, userMessage } = context;

  if (
    !(
      detectCredentialBoundaryRequest(userMessage) ||
      (detectSensitiveOvershare(userMessage) &&
        containsForbiddenCredentialTerm(userMessage))
    )
  ) {
    return null;
  }

  const handoff = buildCredentialHandoffCopy();

  return applyOverride(
    base,
    {
      code: "credential_offer_warned",
      reason:
        "The customer offered bank, card, payment, online banking, or security credentials in chat.",
      toAction: handoff.action,
    },
    {
      finalAction: handoff.action,
      customerMessage: handoff.customerMessage,
      ui: handoff.ui,
      requestedFields: handoff.requestedFields,
      collectedFacts: {},
      selectedServingMode: null,
      selectedRouteReason:
        "Credential boundary risk takes precedence over retrieved routes.",
      safetyFlags: uniqueSafetyFlags([
        ...base.safetyFlags,
        "forbidden_credentials",
        "sensitive_overshare",
      ]),
    },
  );
}

function guardPaymentLink(context: GuardContext): ValidatedPlanFragment | null {
  if (!detectPaymentLinkRequest(context.userMessage)) {
    return null;
  }

  const { base } = context;
  const handoff = buildPaymentLinkHandoffCopy();

  return applyOverride(
    base,
    {
      code: "payment_link_handoff_required",
      reason:
        "Payment-link creation is account-specific and must not be invented in chat.",
      toAction: handoff.action,
    },
    {
      finalAction: handoff.action,
      customerMessage: handoff.customerMessage,
      ui: handoff.ui,
      requestedFields: handoff.requestedFields,
      collectedFacts: {},
      selectedServingMode: "handoff_account_specific",
      selectedRouteReason:
        "Payment links are account-specific and require the LoanSlam team.",
      safetyFlags: uniqueSafetyFlags([
        ...base.safetyFlags,
        "account_specific_request",
      ]),
    },
  );
}

function guardForbiddenCredentialRequestInPlan(
  context: GuardContext,
): ValidatedPlanFragment | null {
  const { base, plan } = context;

  if (!detectForbiddenCredentialRequest(planText(plan))) {
    return null;
  }

  const handoff = buildCredentialHandoffCopy();

  return applyOverride(
    base,
    {
      code: "forbidden_credential_request_blocked",
      reason:
        "The plan asked for bank, card, payment, or online banking credentials.",
      toAction: handoff.action,
    },
    {
      finalAction: handoff.action,
      customerMessage: handoff.customerMessage,
      ui: handoff.ui,
      requestedFields: handoff.requestedFields,
      collectedFacts: {},
      selectedServingMode: null,
      selectedRouteReason:
        "Credential boundary risk takes precedence over retrieved routes.",
      safetyFlags: uniqueSafetyFlags([
        ...base.safetyFlags,
        "forbidden_credentials",
      ]),
    },
  );
}

function guardForbiddenCredentialsInFacts(
  context: GuardContext,
): ValidatedPlanFragment | null {
  const { base, plan } = context;

  if (!collectedFactsContainForbiddenCredentials(plan.collectedFacts)) {
    return null;
  }

  const handoff = buildCredentialHandoffCopy();

  return applyOverride(
    base,
    {
      code: "forbidden_credential_request_blocked",
      reason:
        "The plan attempted to preserve bank, card, payment, or online banking credentials.",
      toAction: handoff.action,
    },
    {
      finalAction: handoff.action,
      customerMessage: handoff.customerMessage,
      ui: handoff.ui,
      requestedFields: handoff.requestedFields,
      collectedFacts: {},
      selectedServingMode: null,
      selectedRouteReason:
        "Credential boundary risk takes precedence over retrieved routes.",
      safetyFlags: uniqueSafetyFlags([
        ...base.safetyFlags,
        "forbidden_credentials",
      ]),
    },
  );
}

function guardSecondaryBorrowingAdvice(
  context: GuardContext,
): ValidatedPlanFragment | null {
  if (!detectSecondaryBorrowingAdviceRequest(context.userMessage)) {
    return null;
  }

  const { base } = context;
  const excluded = buildSecondaryBorrowingBoundaryCopy();

  return applyOverride(
    base,
    {
      code: "secondary_borrowing_advice_blocked",
      reason:
        "Advice on whether to borrow more or take another loan is regulated financial advice and must not be answered in chat.",
      toAction: excluded.action,
    },
    {
      finalAction: excluded.action,
      customerMessage: excluded.customerMessage,
      ui: excluded.ui,
      requestedFields: [],
      collectedFacts: {},
      selectedServingMode: "excluded",
      selectedRouteReason:
        "Advice on whether to borrow more or take another loan is regulated financial advice.",
    },
  );
}

function guardCreditCheckEvasion(
  context: GuardContext,
): ValidatedPlanFragment | null {
  if (!detectCreditCheckEvasionRequest(context.userMessage)) {
    return null;
  }

  const { base } = context;
  const excluded = buildCreditCheckEvasionBoundaryCopy();
  const reason =
    "Credit-check evasion or misrepresentation must not be coached in chat.";

  return applyOverride(
    base,
    {
      code: "credit_check_evasion_blocked",
      reason,
      toAction: excluded.action,
    },
    {
      finalAction: excluded.action,
      customerMessage: excluded.customerMessage,
      ui: excluded.ui,
      requestedFields: [],
      collectedFacts: {},
      selectedServingMode: "excluded",
      selectedRouteReason: reason,
      safetyFlags: uniqueSafetyFlags([
        ...base.safetyFlags,
        "unsupported_request",
      ]),
    },
  );
}

function guardApprovalEstimateAdvice(
  context: GuardContext,
): ValidatedPlanFragment | null {
  if (!detectApprovalEstimateRequest(context.userMessage)) {
    return null;
  }

  const { base } = context;
  const excluded = buildApprovalEstimateBoundaryCopy();
  const reason =
    "Personalised approval coaching, APR prediction, or rate prediction must not be answered in chat.";

  return applyOverride(
    base,
    {
      code: "approval_estimate_blocked",
      reason,
      toAction: excluded.action,
    },
    {
      finalAction: excluded.action,
      customerMessage: excluded.customerMessage,
      ui: excluded.ui,
      requestedFields: [],
      collectedFacts: {},
      selectedServingMode: "excluded",
      selectedRouteReason: reason,
      safetyFlags: uniqueSafetyFlags([
        ...base.safetyFlags,
        "account_specific_request",
      ]),
    },
  );
}

function guardBadCreditEligibilityAnswer(
  context: GuardContext,
): ValidatedPlanFragment | null {
  const { base, selectedMatch, userMessage } = context;

  if (
    base.finalAction !== "answer" ||
    !detectBadCreditEligibilityQuestion(userMessage) ||
    selectedMatch?.item?.id !== "can-i-apply-with-bad-credit"
  ) {
    return null;
  }

  const copy = buildBadCreditEligibilityCopy();
  const reason =
    "Bad-credit FAQ answers must stay neutral and avoid yes/no approval reassurance.";

  return applyOverride(
    base,
    {
      code: "bad_credit_faq_neutralized",
      reason,
      toAction: copy.action,
    },
    {
      finalAction: copy.action,
      customerMessage: copy.customerMessage,
      ui: copy.ui,
      selectedServingMode: "answer",
      selectedRouteReason: reason,
    },
  );
}

function guardApprovalStatusHandoff(
  context: GuardContext,
): ValidatedPlanFragment | null {
  const { base, userMessage } = context;

  if (!detectApprovalStatusQuestion(userMessage)) {
    return null;
  }

  const handoff = buildApprovalStatusHandoffCopy();
  const reason =
    "Approval status is account-specific and cannot be confirmed yes/no in chat.";

  return applyOverride(
    base,
    {
      code: "approval_status_handoff_required",
      reason,
      toAction: handoff.action,
    },
    {
      finalAction: handoff.action,
      customerMessage: handoff.customerMessage,
      ui: handoff.ui,
      requestedFields: handoff.requestedFields,
      collectedFacts: {},
      selectedServingMode: "handoff_account_specific",
      selectedRouteReason: reason,
      safetyFlags: uniqueSafetyFlags([
        ...base.safetyFlags,
        "account_specific_request",
      ]),
    },
  );
}

function guardReferenceOfferHandoff(
  context: GuardContext,
): ValidatedPlanFragment | null {
  const { base, selectedMatch, userMessage } = context;

  if (
    base.finalAction !== "request_handoff_intake" ||
    selectedMatch?.servingMode !== "handoff_account_specific" ||
    !detectReferenceOffer(userMessage)
  ) {
    return null;
  }

  const reason =
    "Reference numbers are account-specific and should be handled by the LoanSlam team.";
  const handoff = buildReferenceOfferHandoffCopy(reason);

  return applyOverride(
    base,
    {
      code: "reference_offer_handoff_contextualized",
      reason:
        "Reference-offer handoff copy should preserve the account boundary without misrouting to contact-detail updates.",
      toAction: handoff.action,
    },
    {
      finalAction: handoff.action,
      customerMessage: handoff.customerMessage,
      ui: handoff.ui,
      requestedFields: handoff.requestedFields,
      selectedServingMode: "handoff_account_specific",
      selectedRouteReason: reason,
      safetyFlags: uniqueSafetyFlags([
        ...base.safetyFlags,
        "account_specific_request",
      ]),
    },
  );
}

function guardAccountChangeHandoffAcknowledgement(
  context: GuardContext,
): ValidatedPlanFragment | null {
  const { base, selectedMatch, userMessage } = context;

  if (
    base.finalAction !== "request_handoff_intake" ||
    selectedMatch?.servingMode !== "handoff_account_specific" ||
    selectedMatch.item?.id === "update-my-bank-details"
  ) {
    return null;
  }

  const handoff = buildAccountChangeHandoffCopy(
    selectedMatch.item?.route_reason ??
      "Account changes must be handled by the LoanSlam team.",
    userMessage,
  );

  if (!handoff || base.customerMessage === handoff.customerMessage) {
    return null;
  }

  return applyOverride(
    base,
    {
      code: "account_change_handoff_contextualized",
      reason:
        "Account-change handoff copy should acknowledge the requested change without promising it.",
      toAction: handoff.action,
    },
    {
      finalAction: handoff.action,
      customerMessage: handoff.customerMessage,
      ui: handoff.ui,
      requestedFields: handoff.requestedFields,
      selectedServingMode: "handoff_account_specific",
      selectedRouteReason: selectedMatch.item?.route_reason ?? null,
      safetyFlags: uniqueSafetyFlags([
        ...base.safetyFlags,
        "account_specific_request",
        "change_request",
      ]),
    },
  );
}

function guardPromisedAccountValue(
  context: GuardContext,
): ValidatedPlanFragment | null {
  const { base, plan, selectedMatch, allSafetyFlags } = context;

  if (!detectPromisedAccountValueOrOutcome(planText(plan))) {
    return null;
  }

  const copy =
    hasHandoffSafetyFlag(allSafetyFlags) ||
    selectedMatch?.servingMode === "handoff_account_specific"
      ? buildHandoffCopy(
          selectedMatch?.item?.route_reason ??
            "Account-specific values, dates, rates, approvals, or account changes must be handled by the LoanSlam team.",
        )
      : buildFallbackCopy(
          "Account-specific values, dates, rates, approvals, or account changes must not be promised in chat.",
        );

  return applyOverride(
    base,
    {
      code: "account_specific_promise_blocked",
      reason:
        "The plan promised or invented an account-specific value, date, rate, approval, or payment change.",
      toAction: copy.action,
    },
    {
      finalAction: copy.action,
      customerMessage: copy.customerMessage,
      ui: copy.ui,
      requestedFields: "requestedFields" in copy ? copy.requestedFields : [],
      safetyFlags: uniqueSafetyFlags([
        ...base.safetyFlags,
        "account_specific_request",
      ]),
    },
  );
}

// Out-of-domain guard: when the planner fell back AND the signal independently
// judged the message out-of-domain, do not let a spurious top retrieval match
// (e.g. a route_vulnerability item matched against a poem) override the
// fallback. Declines (returns null, continuing the pipeline) when there is a
// real safety flag from the message, signal, or plan, so the genuine backstop
// guards below still fire.
function guardOutOfDomainFallback(
  context: GuardContext,
): ValidatedPlanFragment | null {
  const { base, plan, options, planSafetyFlags, userMessage } = context;

  if (!isOutOfDomainFallback(plan, options.signalBundle)) {
    return null;
  }

  const genuineSafetyFlags = uniqueSafetyFlags([
    ...(options.safetyFlags ?? []),
    ...inferSafetyFlagsFromSignal(options.signalBundle),
    ...planSafetyFlags,
    ...inferSafetyFlagsFromMessage(userMessage),
  ]);

  if (genuineSafetyFlags.length === 0) {
    return {
      ...base,
      finalAction: "fallback",
      selectedServingMode: null,
      selectedRouteReason: null,
      safetyFlags: genuineSafetyFlags,
    };
  }

  return null;
}

function guardVulnerabilityRoute(
  context: GuardContext,
): ValidatedPlanFragment | null {
  const { base, vulnerabilityMatch, allSafetyFlags } = context;

  if (!(vulnerabilityMatch || hasVulnerabilitySafetyFlag(allSafetyFlags))) {
    return null;
  }

  if (isCompliantRoutePlan(base, "route_vulnerability")) {
    return acceptPolicyRoute(base, vulnerabilityMatch, ["vulnerability"]);
  }

  return applyVulnerabilityOverride(
    base,
    {
      code: vulnerabilityMatch
        ? "vulnerability_route_match"
        : "safety_flag_route_to_handoff",
      reason:
        vulnerabilityMatch?.item?.route_reason ??
        "A vulnerability, distress, hardship, complaint, legal, or accessibility signal must be handled by a person.",
      toAction: "request_handoff_intake",
    },
    vulnerabilityMatch,
  );
}

function guardNonAnswerServingMode(
  context: GuardContext,
): ValidatedPlanFragment | null {
  const { base, selectedMatch } = context;

  if (!(selectedMatch && selectedMatch.servingMode !== "answer")) {
    return null;
  }

  if (isCompliantRoutePlan(base, selectedMatch.servingMode)) {
    return acceptPolicyRoute(base, selectedMatch);
  }

  return dispatchNonAnswerServingMode(base, selectedMatch);
}

function guardAnswerGrounding(
  context: GuardContext,
): ValidatedPlanFragment | null {
  const { base, plan, retrievedMatches } = context;

  if (plan.action !== "answer") {
    return null;
  }

  const answerFailure = answerGroundingFailure(plan, retrievedMatches);
  if (!answerFailure) {
    return null;
  }

  const fallback = buildFallbackCopy(answerFailure.reason);

  return applyOverride(
    base,
    {
      code: answerFailure.code,
      reason: answerFailure.reason,
      toAction: fallback.action,
    },
    {
      finalAction: fallback.action,
      customerMessage: fallback.customerMessage,
      ui: fallback.ui,
      requestedFields: [],
    },
  );
}

function guardUiActionMatch(
  context: GuardContext,
): ValidatedPlanFragment | null {
  const { base } = context;

  if (uiMatchesAction(base.finalAction, base.ui)) {
    return null;
  }

  const fallback = buildFallbackCopy(
    "The proposed UI did not match the final action.",
  );

  return applyOverride(
    base,
    {
      code: "ui_action_mismatch",
      reason: `UI primitive ${base.ui.primitive} is not allowed for action ${base.finalAction}.`,
      toAction: fallback.action,
    },
    {
      finalAction: fallback.action,
      customerMessage: fallback.customerMessage,
      ui: fallback.ui,
      requestedFields: [],
    },
  );
}

function selectPolicyMatch(
  plan: TurnPlan,
  retrievedMatches: readonly RetrievedMatch[],
): RetrievedMatch | undefined {
  const topMatch = retrievedMatches[0];
  if (topMatch?.servingMode !== "answer") {
    return topMatch;
  }

  const citedIds = plan.grounding?.citedItemIds ?? [];
  const citedMatch = retrievedMatches.find((match) =>
    citedIds.includes(match.itemId),
  );

  return citedMatch ?? topMatch;
}

function isOutOfDomainFallback(
  plan: TurnPlan,
  signalBundle: SignalBundle | undefined,
): boolean {
  return (
    plan.action === "fallback" &&
    plan.ui.primitive === "safe_fallback" &&
    signalBundle != null &&
    signalBundle.recommendedServingMode == null &&
    signalBundle.primaryIntent === "other"
  );
}

function inferSafetyFlagsFromMatches(
  retrievedMatches: readonly RetrievedMatch[],
): SafetyFlag[] {
  const flags: SafetyFlag[] = [];

  for (const match of retrievedMatches) {
    if (match.servingMode === "route_vulnerability") {
      flags.push("vulnerability");
    }

    if (match.servingMode === "handoff_account_specific") {
      flags.push("account_specific_request");
    }
  }

  return uniqueSafetyFlags(flags);
}

function inferSafetyFlagsFromMessage(message: string): SafetyFlag[] {
  const flags: SafetyFlag[] = [];

  if (
    detectCredentialBoundaryRequest(message) ||
    detectSensitiveOvershare(message)
  ) {
    flags.push("sensitive_overshare");

    if (containsForbiddenCredentialTerm(message)) {
      flags.push("forbidden_credentials");
    }
  }

  return flags;
}

function inferSafetyFlagsFromSignal(
  signalBundle: SignalBundle | undefined,
): SafetyFlag[] {
  if (!signalBundle) {
    return [];
  }

  const flags = [...signalBundle.safetySignals];

  if (
    signalBundle.recommendedServingMode === "route_vulnerability" &&
    !hasVulnerabilitySafetyFlag(flags)
  ) {
    flags.push("vulnerability");
  }

  if (
    signalBundle.recommendedServingMode === "handoff_account_specific" &&
    !hasHandoffSafetyFlag(flags)
  ) {
    flags.push("account_specific_request");
  }

  return uniqueSafetyFlags(flags);
}

function alignPlanSafetyFlagsWithSignal(
  flags: readonly SafetyFlag[],
  signalBundle: SignalBundle | undefined,
): SafetyFlag[] {
  const normalizedFlags = uniqueSafetyFlags(flags);
  const signalMode = signalBundle?.recommendedServingMode;

  if (!signalMode) {
    return normalizedFlags;
  }

  const signalFlags = new Set(inferSafetyFlagsFromSignal(signalBundle));

  return normalizedFlags.filter((flag) => {
    if (signalFlags.has(flag)) {
      return true;
    }

    if (includesSafetyFlag(currentTurnInvariantSafetyFlags, flag)) {
      return true;
    }

    if (signalMode === "handoff_account_specific") {
      return includesSafetyFlag(handoffSafetyFlags, flag);
    }

    if (signalMode === "route_vulnerability") {
      return includesSafetyFlag(vulnerabilitySafetyFlags, flag);
    }

    return false;
  });
}

const currentTurnInvariantSafetyFlags = [
  "forbidden_credentials",
  "sensitive_overshare",
  "language_barrier",
] as const satisfies readonly SafetyFlag[];

function includesSafetyFlag(
  flags: readonly SafetyFlag[],
  flag: SafetyFlag,
): boolean {
  return flags.includes(flag);
}

function answerGroundingFailure(
  plan: TurnPlan,
  retrievedMatches: readonly RetrievedMatch[],
): { code: string; reason: string } | null {
  if (!plan.grounding || plan.grounding.citedItemIds.length === 0) {
    return {
      code: "answer_grounding_missing",
      reason: "Answers require cited retrieved corpus items.",
    };
  }

  if (
    plan.grounding.servingMode !== "answer" ||
    plan.grounding.confidence !== "supported"
  ) {
    return {
      code: "answer_grounding_unsupported",
      reason: "Answers require supported grounding with serving_mode answer.",
    };
  }

  const citedMatches = plan.grounding.citedItemIds.map((itemId) =>
    retrievedMatches.find((match) => match.itemId === itemId),
  );

  if (citedMatches.some((match) => !match)) {
    return {
      code: "answer_grounding_not_retrieved",
      reason: "Answers may cite only retrieved corpus items.",
    };
  }

  if (citedMatches.some((match) => match?.servingMode !== "answer")) {
    return {
      code: "non_answer_citation_blocked",
      reason: "Answers may cite only serving_mode answer corpus items.",
    };
  }

  return null;
}

function normalizeRequestedFields(plan: TurnPlan): IntakeField[] {
  if (
    plan.action === "request_handoff_intake" ||
    (plan.action === "escalate" && plan.ui.primitive === "intake_form")
  ) {
    return [...plan.requestedFields];
  }

  return [];
}

function dispatchNonAnswerServingMode(
  base: ValidatedPlanFragment,
  match: RetrievedMatch,
): ValidatedPlanFragment {
  if (match.servingMode === "handoff_account_specific") {
    const handoff = buildHandoffCopy(
      match.item?.route_reason ??
        "This needs account-specific handling by the LoanSlam team.",
    );

    return applyOverride(
      base,
      {
        code: "non_answer_citation_blocked",
        reason: "The plan tried to answer from an account-specific route item.",
        toAction: handoff.action,
      },
      {
        finalAction: handoff.action,
        customerMessage: handoff.customerMessage,
        ui: handoff.ui,
        requestedFields: handoff.requestedFields,
        selectedServingMode: match.servingMode,
        selectedRouteReason: match.item?.route_reason ?? null,
        safetyFlags: uniqueSafetyFlags([
          ...base.safetyFlags,
          "account_specific_request",
        ]),
      },
    );
  }

  if (match.servingMode === "excluded") {
    const excluded = buildExcludedCopy(
      match.item?.route_reason ??
        "This topic is recognised but not answerable by the bot.",
      match.item?.links ?? [],
    );

    return applyOverride(
      base,
      {
        code: "non_answer_citation_blocked",
        reason: "The plan tried to answer from an excluded route item.",
        toAction: excluded.action,
      },
      {
        finalAction: excluded.action,
        customerMessage: excluded.customerMessage,
        ui: excluded.ui,
        requestedFields: [],
        selectedServingMode: match.servingMode,
        selectedRouteReason: match.item?.route_reason ?? null,
      },
    );
  }

  return applyVulnerabilityOverride(
    base,
    {
      code: "non_answer_citation_blocked",
      reason: "The plan tried to answer from a vulnerability route item.",
      toAction: "request_handoff_intake",
    },
    match,
  );
}

function applyVulnerabilityOverride(
  base: ValidatedPlanFragment,
  override: OverrideInput,
  match?: RetrievedMatch,
): ValidatedPlanFragment {
  const vulnerability = buildVulnerabilityCopy(
    match?.item?.route_reason ?? override.reason,
  );

  return applyOverride(base, override, {
    finalAction: vulnerability.action,
    customerMessage: vulnerability.customerMessage,
    ui: vulnerability.ui,
    requestedFields: vulnerability.requestedFields,
    selectedServingMode: match?.servingMode ?? base.selectedServingMode,
    selectedRouteReason: match?.item?.route_reason ?? base.selectedRouteReason,
    safetyFlags: uniqueSafetyFlags([...base.safetyFlags, "vulnerability"]),
  });
}

function acceptPolicyRoute(
  base: ValidatedPlanFragment,
  match?: RetrievedMatch,
  extraSafetyFlags: readonly SafetyFlag[] = [],
): ValidatedPlanFragment {
  return {
    ...base,
    selectedServingMode: match?.servingMode ?? base.selectedServingMode,
    selectedRouteReason: match?.item?.route_reason ?? base.selectedRouteReason,
    safetyFlags: uniqueSafetyFlags([...base.safetyFlags, ...extraSafetyFlags]),
  };
}

function isCompliantRoutePlan(
  base: ValidatedPlanFragment,
  servingMode: ServingMode,
): boolean {
  if (servingMode === "excluded") {
    return (
      base.finalAction === "refuse" && base.ui.primitive === "safe_fallback"
    );
  }

  return (
    base.finalAction === "request_handoff_intake" &&
    base.ui.primitive === "intake_form" &&
    sameFields(base.ui.fields, standardHandoffFields) &&
    sameFields(base.requestedFields, standardHandoffFields)
  );
}

function sameFields(
  left: readonly IntakeField[],
  right: readonly IntakeField[],
): boolean {
  return (
    left.length === right.length &&
    left.every((field) => right.includes(field)) &&
    right.every((field) => left.includes(field))
  );
}

function applyOverride(
  base: ValidatedPlanFragment,
  override: OverrideInput,
  replacement: Partial<
    Pick<
      ValidatedPlanFragment,
      | "finalAction"
      | "customerMessage"
      | "ui"
      | "requestedFields"
      | "collectedFacts"
      | "selectedServingMode"
      | "selectedRouteReason"
      | "safetyFlags"
    >
  >,
): ValidatedPlanFragment {
  const toAction = replacement.finalAction ?? override.toAction;

  return {
    ...base,
    ...replacement,
    finalAction: toAction,
    validatorOverrides: [
      ...base.validatorOverrides,
      {
        code: override.code,
        reason: override.reason,
        fromAction: base.finalAction,
        toAction,
      },
    ],
  };
}

function planText(plan: TurnPlan): string {
  return [
    plan.customerMessage,
    "message" in plan.ui ? plan.ui.message : "",
  ].join(" ");
}

function collectedFactsContainForbiddenCredentials(
  facts: Record<string, string>,
): boolean {
  return Object.entries(facts).some(([key, value]) =>
    containsForbiddenCredentialTerm(`${key} ${value}`),
  );
}

function uniqueSafetyFlags(flags: readonly SafetyFlag[]): SafetyFlag[] {
  return [...new Set(flags)];
}
