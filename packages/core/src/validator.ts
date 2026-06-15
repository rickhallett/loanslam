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
  buildExcludedCopy,
  buildFallbackCopy,
  buildHandoffCopy,
  buildInternalDataBoundaryCopy,
  buildVulnerabilityCopy,
  containsForbiddenCredentialTerm,
  detectForbiddenCredentialRequest,
  detectInternalDataExposureRequest,
  detectPromisedAccountValueOrOutcome,
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

export function validateTurnPlan(
  plan: TurnPlan,
  retrievedMatches: readonly RetrievedMatch[],
  options: ValidateTurnPlanOptions = {},
): ValidatedPlanFragment {
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

  if (detectInternalDataExposureRequest(options.userMessage ?? "")) {
    const boundaryReason =
      "Requests for internal traces, hidden instructions, customer data, or policy bypass must not be served in chat.";
    const boundary = buildInternalDataBoundaryCopy(boundaryReason);

    if (
      base.finalAction === "refuse" &&
      base.ui.primitive === "safe_fallback"
    ) {
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

  if (detectForbiddenCredentialRequest(planText(plan))) {
    const handoff = buildHandoffCopy(
      "Do not share bank, card, payment, or online banking credentials in chat.",
    );

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
        safetyFlags: uniqueSafetyFlags([
          ...base.safetyFlags,
          "forbidden_credentials",
        ]),
      },
    );
  }

  if (collectedFactsContainForbiddenCredentials(plan.collectedFacts)) {
    const handoff = buildHandoffCopy(
      "Do not share bank, card, payment, or online banking credentials in chat.",
    );

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
        safetyFlags: uniqueSafetyFlags([
          ...base.safetyFlags,
          "forbidden_credentials",
        ]),
      },
    );
  }

  if (detectPromisedAccountValueOrOutcome(planText(plan))) {
    const copy =
      hasHandoffSafetyFlag(allSafetyFlags) ||
      selectedMatch?.servingMode === "handoff_account_specific"
        ? buildHandoffCopy(
            selectedMatch?.item?.route_reason ??
              "Account-specific values, dates, rates, approvals, or account changes must be handled by the Loanslam team.",
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
  // fallback. The genuine backstop below still fires when there is a real safety
  // flag from the message, signal, or plan.
  if (isOutOfDomainFallback(plan, options.signalBundle)) {
    const genuineSafetyFlags = uniqueSafetyFlags([
      ...(options.safetyFlags ?? []),
      ...inferSafetyFlagsFromSignal(options.signalBundle),
      ...planSafetyFlags,
      ...inferSafetyFlagsFromMessage(options.userMessage ?? ""),
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
  }

  if (vulnerabilityMatch || hasVulnerabilitySafetyFlag(allSafetyFlags)) {
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

  if (selectedMatch && selectedMatch.servingMode !== "answer") {
    if (isCompliantRoutePlan(base, selectedMatch.servingMode)) {
      return acceptPolicyRoute(base, selectedMatch);
    }

    return applyServingModeOverride(base, selectedMatch);
  }

  if (plan.action === "answer") {
    const answerFailure = answerGroundingFailure(plan, retrievedMatches);
    if (answerFailure) {
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
  }

  if (!uiMatchesAction(base.finalAction, base.ui)) {
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

  return base;
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

  if (detectSensitiveOvershare(message)) {
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

function applyServingModeOverride(
  base: ValidatedPlanFragment,
  match: RetrievedMatch,
): ValidatedPlanFragment {
  if (match.servingMode === "handoff_account_specific") {
    const handoff = buildHandoffCopy(
      match.item?.route_reason ??
        "This needs account-specific handling by the Loanslam team.",
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
