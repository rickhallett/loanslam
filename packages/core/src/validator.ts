import type {
  IntakeField,
  RetrievedMatch,
  SafetyFlag,
  ServingMode,
  TurnAction,
  TurnPlan,
  UiPlan,
  ValidatorOverride,
} from "@loanslam/contracts";

import {
  buildExcludedCopy,
  buildFallbackCopy,
  buildHandoffCopy,
  buildVulnerabilityCopy,
  containsForbiddenCredentialTerm,
  detectForbiddenCredentialRequest,
  detectPromisedAccountValueOrOutcome,
  detectSensitiveOvershare,
  hasHandoffSafetyFlag,
  hasVulnerabilitySafetyFlag,
  standardHandoffFields,
  uiMatchesAction,
} from "./policy";

export interface ValidateTurnPlanOptions {
  safetyFlags?: readonly SafetyFlag[];
  userMessage?: string;
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
  const allSafetyFlags = uniqueSafetyFlags([
    ...(options.safetyFlags ?? []),
    ...plan.safetyFlags,
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

    if (isChangeRequestMatch(match)) {
      flags.push("change_request");
    }
  }

  return uniqueSafetyFlags(flags);
}

function inferSafetyFlagsFromMessage(message: string): SafetyFlag[] {
  if (!detectSensitiveOvershare(message)) {
    return [];
  }

  const flags: SafetyFlag[] = ["sensitive_overshare"];

  if (containsForbiddenCredentialTerm(message)) {
    flags.push("forbidden_credentials");
  }

  return flags;
}

function isChangeRequestMatch(match: RetrievedMatch): boolean {
  if (match.servingMode !== "handoff_account_specific") {
    return false;
  }

  const item = match.item;
  const text = [
    match.itemId,
    item?.intent,
    item?.question,
    item?.route_reason,
    ...(item?.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /\b(change|changed|changing|move|moved|update|updating|switch)\b/.test(
    text,
  );
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
      base.finalAction === "refuse" &&
      base.ui.primitive === "safe_fallback" &&
      isSafeExcludedRefusal(base)
    );
  }

  return (
    base.finalAction === "request_handoff_intake" &&
    base.ui.primitive === "intake_form" &&
    sameFields(base.ui.fields, standardHandoffFields) &&
    sameFields(base.requestedFields, standardHandoffFields)
  );
}

function isSafeExcludedRefusal(base: ValidatedPlanFragment): boolean {
  const text = [
    base.customerMessage,
    "message" in base.ui ? base.ui.message : "",
  ]
    .join(" ")
    .toLowerCase();

  return (
    refusalLanguagePattern.test(text) && !regulatedAdvicePattern.test(text)
  );
}

const refusalLanguagePattern =
  /\b(i|we)\s+(cannot|can't|cant|am unable|are unable|won't|will not)\b|\bnot able\b|\bmust not\b|\bdo not\b/;

const regulatedAdvicePattern =
  /\byou\s+should\s+(enter|start|take|prioritise|prioritize|pay|choose|use|do)\b|\b(i|we)\s+(recommend|suggest|advise)\b|\bit\s+(is|would be)\s+(best|better|a good idea)\b|\b(iva|debt\s+management\s+plan)\b.{0,120}\b(lets?|allows?|means|may|can|could|will|write\s+off|reduce|affordable\s+monthly\s+payment|monthly\s+payment)\b/;

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
