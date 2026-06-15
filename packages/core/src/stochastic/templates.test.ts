import { describe, expect, it } from "vitest";

import {
  stochasticForbiddenBehaviorMarkers,
  stochasticProfileConfigs,
  stochasticTemplates,
  stochasticTemplateAxes,
} from "./templates";

describe("STS templates", () => {
  it("targets every STS hard-failure category", () => {
    const targetCategories = new Set(
      stochasticTemplates.flatMap((template) => template.hardFailureTargets),
    );

    expect(targetCategories).toEqual(
      new Set([
        "account_specific_answer",
        "ungrounded_answer",
        "missed_vulnerability",
        "excluded_advice_answered",
        "forbidden_credential_request",
        "clarification_loop",
        "malformed_or_unsupported_state",
        "replayability_loss",
      ]),
    );
  });

  it("keeps profile scenario counts exact", () => {
    expect(stochasticProfileConfigs).toEqual({
      smoke: { scenarioCount: 12 },
      review: { scenarioCount: 60 },
      soak: { scenarioCount: 180 },
    });
  });

  it("keeps stochastic axis values exact", () => {
    expect(stochasticTemplateAxes).toEqual({
      intent: [
        "faq",
        "account_specific",
        "vulnerability",
        "complaint",
        "excluded",
        "ambiguous",
      ],
      personaStyle: [
        "cooperative",
        "terse",
        "confused",
        "impatient",
        "adversarial",
        "vulnerable",
      ],
      journeyShape: ["single_turn", "multi_turn", "repeated", "topic_switch"],
      languageNoise: ["clean", "typo", "vague", "emotional", "overshare"],
      riskMarker: [
        "none",
        "pii",
        "forbidden_credentials",
        "hardship",
        "legal_threat",
      ],
    });
  });

  it("keeps forbidden behavior markers aligned with the evaluator vocabulary", () => {
    expect(stochasticForbiddenBehaviorMarkers).toEqual([
      "forbidden_credential_requests",
      "malformed_plan",
      "normal_routing_after_vulnerability",
      "promised_outcomes",
      "ungrounded_answers",
    ]);

    const markerVocabulary = new Set<string>(
      stochasticForbiddenBehaviorMarkers,
    );
    const templateMarkers = new Set<string>(
      stochasticTemplates.flatMap(
        (template) => template.expectation.forbiddenBehaviors,
      ),
    );

    expect(
      [...templateMarkers].every((marker) => markerVocabulary.has(marker)),
    ).toBe(true);
    expect(templateMarkers.has("forbidden_credential_requests")).toBe(true);
    expect(templateMarkers.has("forbidden_credential_request")).toBe(false);
    expect(templateMarkers.has("account_specific_answer")).toBe(false);
    expect(templateMarkers.has("unsupported_ui_primitive")).toBe(false);

    const hardFailureOnlyMarkers = [
      "account_specific_answer",
      "ungrounded_answer",
      "missed_vulnerability",
      "excluded_advice_answered",
      "forbidden_credential_request",
      "clarification_loop",
      "malformed_or_unsupported_state",
      "replayability_loss",
    ];

    expect(
      hardFailureOnlyMarkers.every((marker) => !templateMarkers.has(marker)),
    ).toBe(true);
  });
});
