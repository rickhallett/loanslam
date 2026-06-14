import type {
  StochasticAxisValues,
  StochasticCoverageReport,
  StochasticHardFailureCategory,
  StochasticScenario,
} from "@loanslam/contracts";
import {
  stochasticCoverageReportSchema,
  stochasticHardFailureCategorySchema,
} from "@loanslam/contracts";

import { stochasticTemplateAxes, stochasticTemplates } from "./templates";

type StochasticCoverageTemplate = {
  id: string;
  hardFailureTargets: readonly StochasticHardFailureCategory[];
};

const highRiskIntents = [
  "account_specific",
  "vulnerability",
  "complaint",
  "excluded",
] as const satisfies readonly StochasticAxisValues["intent"][];

export function buildStochasticCoverageReport(
  scenarios: readonly StochasticScenario[],
  options: {
    templates?: readonly StochasticCoverageTemplate[];
  } = {},
): StochasticCoverageReport {
  const templates = options.templates ?? stochasticTemplates;
  const axisCoverage = {
    intent: buildAxisCoverageEntry(
      scenarios,
      "intent",
      stochasticTemplateAxes.intent,
    ),
    personaStyle: buildAxisCoverageEntry(
      scenarios,
      "personaStyle",
      stochasticTemplateAxes.personaStyle,
    ),
    journeyShape: buildAxisCoverageEntry(
      scenarios,
      "journeyShape",
      stochasticTemplateAxes.journeyShape,
    ),
    languageNoise: buildAxisCoverageEntry(
      scenarios,
      "languageNoise",
      stochasticTemplateAxes.languageNoise,
    ),
    riskMarker: buildAxisCoverageEntry(
      scenarios,
      "riskMarker",
      stochasticTemplateAxes.riskMarker,
    ),
  };
  const highRiskIntentSpread = buildHighRiskIntentSpread(scenarios);
  const coverageGaps = [
    ...formatAxisCoverageGaps("intent", axisCoverage.intent.missingValues),
    ...formatAxisCoverageGaps(
      "personaStyle",
      axisCoverage.personaStyle.missingValues,
    ),
    ...formatAxisCoverageGaps(
      "journeyShape",
      axisCoverage.journeyShape.missingValues,
    ),
    ...formatAxisCoverageGaps(
      "languageNoise",
      axisCoverage.languageNoise.missingValues,
    ),
    ...formatAxisCoverageGaps(
      "riskMarker",
      axisCoverage.riskMarker.missingValues,
    ),
    ...formatHighRiskIntentSpreadGaps(highRiskIntentSpread),
  ];
  const report: StochasticCoverageReport = {
    axisCoverage,
    coverageGaps,
    highRiskIntentSpread,
    hardFailureTemplateCoverage: buildHardFailureTemplateCoverage(
      scenarios,
      templates,
    ),
  };

  return stochasticCoverageReportSchema.parse(report);
}

function buildHighRiskIntentSpread(
  scenarios: readonly StochasticScenario[],
): StochasticCoverageReport["highRiskIntentSpread"] {
  return highRiskIntents.map((intent) => {
    const coveredPersonaStyles = coveredValues(
      stochasticTemplateAxes.personaStyle,
      scenarios
        .filter((scenario) => scenario.axisValues.intent === intent)
        .map((scenario) => scenario.axisValues.personaStyle),
    );

    return {
      intent,
      coveredPersonaStyles,
      missingPersonaStyles: missingValues(
        stochasticTemplateAxes.personaStyle,
        coveredPersonaStyles,
      ),
    };
  });
}

function buildHardFailureTemplateCoverage(
  scenarios: readonly StochasticScenario[],
  templates: readonly StochasticCoverageTemplate[],
): StochasticCoverageReport["hardFailureTemplateCoverage"] {
  const sampledTemplateIds = new Set(
    scenarios.map((scenario) => scenario.generatorTemplateId),
  );

  return stochasticHardFailureCategorySchema.options.map((category) => {
    const templateIds = templates
      .filter(
        (template) =>
          sampledTemplateIds.has(template.id) &&
          template.hardFailureTargets.includes(category),
      )
      .map((template) => template.id);

    return {
      category,
      templateIds,
      covered: templateIds.length > 0,
    };
  });
}

function buildAxisCoverageEntry<Axis extends keyof StochasticAxisValues>(
  scenarios: readonly StochasticScenario[],
  axis: Axis,
  expectedValues: readonly StochasticAxisValues[Axis][],
): {
  coveredValues: StochasticAxisValues[Axis][];
  missingValues: StochasticAxisValues[Axis][];
  sampleCount: number;
} {
  const covered = coveredValues(
    expectedValues,
    scenarios.map((scenario) => scenario.axisValues[axis]),
  );

  return {
    coveredValues: covered,
    missingValues: missingValues(expectedValues, covered),
    sampleCount: scenarios.length,
  };
}

function coveredValues<Value extends string>(
  expectedValues: readonly Value[],
  observedValues: readonly Value[],
): Value[] {
  const observed = new Set(observedValues);

  return expectedValues.filter((value) => observed.has(value));
}

function missingValues<Value extends string>(
  expectedValues: readonly Value[],
  covered: readonly Value[],
): Value[] {
  const coveredSet = new Set(covered);

  return expectedValues.filter((value) => !coveredSet.has(value));
}

function formatAxisCoverageGaps(
  axis: keyof StochasticAxisValues,
  missing: readonly string[],
): string[] {
  return missing.map((value) => `Missing axis ${axis} value ${value}.`);
}

function formatHighRiskIntentSpreadGaps(
  spreadEntries: readonly StochasticCoverageReport["highRiskIntentSpread"][number][],
): string[] {
  return spreadEntries
    .filter((entry) => entry.coveredPersonaStyles.length < 2)
    .map(
      (entry) =>
        `High-risk intent ${entry.intent} is represented by ${entry.coveredPersonaStyles.length} persona style(s); need at least 2.`,
    );
}
