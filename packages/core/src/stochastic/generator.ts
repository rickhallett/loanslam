import {
  stochasticScenarioSchema,
  type StochasticAxisValues,
  type StochasticProfile,
  type StochasticScenario,
} from "@loanslam/contracts";

import { createSeededRandom, deriveScenarioSeed } from "./seededRandom";
import {
  stochasticProfileConfigs,
  stochasticTemplateAxes,
  stochasticTemplates,
  type StochasticTemplate,
} from "./templates";

export interface GenerateStochasticScenariosInput {
  seed: string;
  profile?: StochasticProfile;
}

export function generateStochasticScenarios(
  input: GenerateStochasticScenariosInput,
): StochasticScenario[] {
  const profile = input.profile ?? "review";
  const count = stochasticProfileConfigs[profile].scenarioCount;
  const templateOrder = createSeededRandom(
    `${input.seed}:${profile}:templates`,
  ).shuffle(stochasticTemplates);
  const coverageRequirements = buildCoverageRequirements(input.seed, profile);
  const scenarios = Array.from({ length: count }, (_, index) => {
    const coverageRequirement = coverageRequirements[index];
    const template = selectTemplate({
      coverageRequirement,
      index,
      profile,
      runSeed: input.seed,
      templateOrder,
    });

    if (template === undefined) {
      throw new Error("Cannot generate stochastic scenarios without templates");
    }

    return generateScenario({
      coverageRequirement,
      runSeed: input.seed,
      profile,
      index,
      template,
    });
  });

  return stochasticScenarioSchema.array().parse(scenarios);
}

export interface ReplayStochasticScenarioInput {
  seed: string;
  profile?: StochasticProfile;
  scenarioPath: string;
}

export function replayStochasticScenario(
  input: ReplayStochasticScenarioInput,
): StochasticScenario {
  const profile = input.profile ?? "review";
  const scenario = generateStochasticScenarios({
    seed: input.seed,
    profile,
  }).find((candidate) => candidate.scenarioPath === input.scenarioPath);

  if (scenario === undefined) {
    throw new Error(
      `No stochastic scenario found for seed "${input.seed}", profile "${profile}", scenarioPath "${input.scenarioPath}"`,
    );
  }

  return scenario;
}

interface GenerateScenarioInput {
  runSeed: string;
  profile: StochasticProfile;
  index: number;
  template: StochasticTemplate;
  coverageRequirement: AxisCoverageRequirement | undefined;
}

function generateScenario(input: GenerateScenarioInput): StochasticScenario {
  const ordinal = input.index + 1;
  const scenarioNumber = ordinal.toString().padStart(3, "0");
  const random = createSeededRandom(
    deriveScenarioSeed(
      input.runSeed,
      `${input.profile}/${scenarioNumber}/${input.template.id}`,
    ),
  );
  const axisValues = buildAxisValues(
    input.template,
    random,
    input.coverageRequirement,
  );
  const scenarioPath = [
    input.profile,
    scenarioNumber,
    slugAxisValue(axisValues.intent),
    slugAxisValue(axisValues.personaStyle),
    slugAxisValue(axisValues.journeyShape),
  ].join("/");
  const seed = deriveScenarioSeed(input.runSeed, scenarioPath);

  return {
    scenarioPath,
    persona: {
      id: `${axisValues.personaStyle}-${scenarioNumber}`,
      label: titleCaseAxisValue(axisValues.personaStyle),
      traits: buildPersonaTraits(axisValues),
      styleNotes: buildPersonaStyleNotes(axisValues),
    },
    objective: input.template.objective,
    customerTurns: materializeTurns(input.template, axisValues),
    axisValues,
    expectation: input.template.expectation,
    generatorTemplateId: input.template.id,
    seed,
  };
}

type AxisCoverageRequirement = {
  [Axis in keyof StochasticAxisValues]: {
    axis: Axis;
    value: StochasticAxisValues[Axis];
  };
}[keyof StochasticAxisValues];

type PickableAxis = Exclude<keyof StochasticAxisValues, "intent">;

interface SelectTemplateInput {
  coverageRequirement: AxisCoverageRequirement | undefined;
  index: number;
  profile: StochasticProfile;
  runSeed: string;
  templateOrder: readonly StochasticTemplate[];
}

function buildCoverageRequirements(
  seed: string,
  profile: StochasticProfile,
): AxisCoverageRequirement[] {
  if (profile !== "review" && profile !== "soak") {
    return [];
  }

  return createSeededRandom(`${seed}:${profile}:coverage`).shuffle([
    ...stochasticTemplateAxes.intent.map((value) => ({
      axis: "intent" as const,
      value,
    })),
    ...stochasticTemplateAxes.personaStyle.map((value) => ({
      axis: "personaStyle" as const,
      value,
    })),
    ...stochasticTemplateAxes.journeyShape.map((value) => ({
      axis: "journeyShape" as const,
      value,
    })),
    ...stochasticTemplateAxes.languageNoise.map((value) => ({
      axis: "languageNoise" as const,
      value,
    })),
    ...stochasticTemplateAxes.riskMarker.map((value) => ({
      axis: "riskMarker" as const,
      value,
    })),
  ]);
}

function selectTemplate(input: SelectTemplateInput): StochasticTemplate {
  const coverageRequirement = input.coverageRequirement;

  if (coverageRequirement !== undefined) {
    const compatibleTemplates = stochasticTemplates.filter((template) =>
      templateSupportsRequirement(template, coverageRequirement),
    );

    if (compatibleTemplates.length === 0) {
      throw new Error(
        `No stochastic template supports ${describeRequirement(
          coverageRequirement,
        )}`,
      );
    }

    return createSeededRandom(
      deriveScenarioSeed(
        input.runSeed,
        `${input.profile}/${input.index + 1}/coverage-template/${describeRequirement(
          coverageRequirement,
        )}`,
      ),
    ).pick(compatibleTemplates);
  }

  const template =
    input.templateOrder[input.index % input.templateOrder.length];
  if (template === undefined) {
    throw new Error("Cannot generate stochastic scenarios without templates");
  }

  return template;
}

function templateSupportsRequirement(
  template: StochasticTemplate,
  requirement: AxisCoverageRequirement,
): boolean {
  switch (requirement.axis) {
    case "intent":
      return template.intent === requirement.value;
    case "personaStyle":
      return template.personaStyles.includes(requirement.value);
    case "journeyShape":
      return template.turns[requirement.value].length > 0;
    case "languageNoise":
      return template.languageNoise.includes(requirement.value);
    case "riskMarker":
      return template.riskMarkers.includes(requirement.value);
  }
}

function buildAxisValues(
  template: StochasticTemplate,
  random: ReturnType<typeof createSeededRandom>,
  coverageRequirement?: AxisCoverageRequirement,
): StochasticAxisValues {
  const axisValues = {
    intent: template.intent,
    personaStyle: pickAxisValue(
      "personaStyle",
      template.personaStyles,
      random,
      coverageRequirement,
    ),
    journeyShape: pickAxisValue(
      "journeyShape",
      stochasticTemplateAxes.journeyShape,
      random,
      coverageRequirement,
    ),
    languageNoise: pickAxisValue(
      "languageNoise",
      template.languageNoise,
      random,
      coverageRequirement,
    ),
    riskMarker: pickAxisValue(
      "riskMarker",
      template.riskMarkers,
      random,
      coverageRequirement,
    ),
  };

  if (
    coverageRequirement !== undefined &&
    axisValues[coverageRequirement.axis] !== coverageRequirement.value
  ) {
    throw new Error(
      `Generated scenario missed ${describeRequirement(coverageRequirement)}`,
    );
  }

  return axisValues;
}

function pickAxisValue<Axis extends PickableAxis>(
  axis: Axis,
  values: readonly StochasticAxisValues[Axis][],
  random: ReturnType<typeof createSeededRandom>,
  coverageRequirement?: AxisCoverageRequirement,
): StochasticAxisValues[Axis] {
  if (coverageRequirement?.axis === axis) {
    const value = coverageRequirement.value as StochasticAxisValues[Axis];

    if (!(values as readonly unknown[]).includes(value)) {
      throw new Error(
        `Template cannot satisfy ${describeRequirement(coverageRequirement)}`,
      );
    }

    return value;
  }

  return random.pick(values);
}

function describeRequirement(requirement: AxisCoverageRequirement): string {
  return `${requirement.axis}: ${requirement.value}`;
}

function materializeTurns(
  template: StochasticTemplate,
  axisValues: StochasticAxisValues,
): string[] {
  const turns = template.turns[axisValues.journeyShape];

  if (turns.length === 0) {
    throw new Error(`Template "${template.id}" has no turns for journey shape`);
  }

  return turns.map((turn, index) =>
    applyRiskMarker(
      applyLanguageNoise(turn, axisValues.languageNoise, index),
      axisValues.riskMarker,
      index,
    ),
  );
}

function applyLanguageNoise(
  turn: string,
  languageNoise: StochasticAxisValues["languageNoise"],
  turnIndex: number,
): string {
  switch (languageNoise) {
    case "clean":
      return turn;
    case "typo":
      return turnIndex === 0 ? `${turn} pls` : turn;
    case "vague":
      return turnIndex === 0
        ? `${turn} I am not sure how to explain it.`
        : turn;
    case "emotional":
      return turnIndex === 0
        ? `${turn} I am really stressed about this.`
        : turn;
    case "overshare":
      return turnIndex === 0
        ? `${turn} I can send extra personal details if needed.`
        : turn;
  }
}

function applyRiskMarker(
  turn: string,
  riskMarker: StochasticAxisValues["riskMarker"],
  turnIndex: number,
): string {
  if (turnIndex !== 0) {
    return turn;
  }

  switch (riskMarker) {
    case "none":
      return turn;
    case "pii":
      return `${turn} My full name is Jamie Taylor, date of birth 12 April 1988, address 24 Market Street, Leeds LS1 1AA, phone 07123 456789, and email jamie.taylor@example.com.`;
    case "forbidden_credentials":
      return `${turn} I can share my card number and CVV here if needed.`;
    case "hardship":
      return `${turn} I cannot afford the repayment this month and I am in financial hardship.`;
    case "legal_threat":
      return `${turn} I want to make a formal complaint and may take legal action.`;
  }
}

function buildPersonaTraits(axisValues: StochasticAxisValues): string[] {
  return [
    slugAxisValue(axisValues.personaStyle),
    slugAxisValue(axisValues.languageNoise),
    slugAxisValue(axisValues.riskMarker),
  ];
}

function buildPersonaStyleNotes(axisValues: StochasticAxisValues): string {
  return `${titleCaseAxisValue(axisValues.personaStyle)} style with ${slugAxisValue(
    axisValues.languageNoise,
  )} language and ${slugAxisValue(axisValues.riskMarker)} risk marker.`;
}

function slugAxisValue(value: string): string {
  return value.replaceAll("_", "-");
}

function titleCaseAxisValue(value: string): string {
  return value
    .split("_")
    .map((word) => {
      const first = word[0];
      if (first === undefined) {
        return word;
      }

      return `${first.toUpperCase()}${word.slice(1)}`;
    })
    .join(" ");
}
