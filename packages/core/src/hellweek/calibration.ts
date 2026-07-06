import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  createOpenAiJudgeClient,
  defaultOpenAiHellWeekFinalAdjudicatorModel,
  defaultOpenAiHellWeekJudgeConcurrency,
  defaultOpenAiHellWeekJudgeModel,
  defaultOpenAiHellWeekVerifierModel,
  judgeScenarioPacket,
  judgeScenarioPacketWithEscalation,
  openAiHellWeekJudgePromptVersion,
  openAiHellWeekJudgeRubricHash,
  openAiHellWeekJudgeTool,
  sanitizeScenarioPacketJsonForJudge,
  type OpenAiHellWeekJudgeClient,
} from "./openaiJudge";
import { mapLimit } from "./concurrency";
import {
  goldLabelToJudgeVerdict,
  hellWeekGoldSet,
  hellWeekGoldSetVersion,
  type HellWeekGoldItem,
} from "./goldSet";
import { severityRank, type JudgeVerdict, type Severity } from "./types";

export interface CountRate {
  count: number;
  total: number;
  rate: number | null;
}

export type HellWeekJudgeCalibrationMode = "single_model" | "ladder";

export interface HellWeekJudgeCalibrationInput {
  goldSet?: readonly HellWeekGoldItem[];
  passes?: number;
  client?: OpenAiHellWeekJudgeClient;
  apiKey?: string;
  mode?: HellWeekJudgeCalibrationMode;
  model?: string;
  verifierModel?: string;
  finalAdjudicatorModel?: string;
  promptVersion?: string;
  concurrency?: number;
  repoRoot?: string;
  outputPath?: string;
  now?: () => Date;
  onProgress?: (message: string) => void;
}

export interface HellWeekJudgeCalibrationReport {
  schemaVersion: 1;
  generatedAt: string;
  goldSetVersion: string;
  judge: {
    provider: "openai";
    mode: HellWeekJudgeCalibrationMode;
    model: string;
    verifierModel?: string;
    finalAdjudicatorModel?: string;
    tool: typeof openAiHellWeekJudgeTool;
    promptVersion: string;
    rubricHash: string;
    passesPerItem: number;
    itemCount: number;
    verdictCount: number;
  };
  metrics: {
    labelAgreement: {
      severity: CountRate;
      pass: CountRate;
      safetyFloorSeverity: CountRate;
      missedBreach: CountRate;
      missedSafetyFloorBreach: CountRate;
      missedDemoKillerBreach: CountRate;
      harshCall: CountRate;
      safetyFloorHarshCall: CountRate;
      overFlag: CountRate;
      averageSeverityDistance: number | null;
    };
    interRunSelfAgreement: {
      severityPairwise: CountRate;
      passPairwise: CountRate;
    };
    confidence: {
      correctAverage: number | null;
      correctCount: number;
      incorrectAverage: number | null;
      incorrectCount: number;
    };
    escalation: {
      safetyFloorEscalations: CountRate;
      demoKillerVerifications: CountRate;
      hardDisputeAdjudications: CountRate;
    };
    confusion: Array<{
      label: Severity;
      judged: Severity;
      count: number;
    }>;
  };
  items: HellWeekJudgeCalibrationItemResult[];
}

export interface HellWeekJudgeCalibrationItemResult {
  id: string;
  scenarioId: string;
  dimension: HellWeekGoldItem["dimension"];
  safetyFloor: boolean;
  packetPath: string;
  sourcePath: string;
  label: JudgeVerdict;
  verdicts: Array<{
    passIndex: number;
    pass: boolean;
    severity: Severity;
    initialSeverity?: Severity;
    verificationSeverity?: Severity;
    finalAdjudicationSeverity?: Severity;
    safetyFloorEscalated?: boolean;
    demoKillerVerified?: boolean;
    hardDisputeAdjudicated?: boolean;
    confidence?: number;
    rationale: string;
  }>;
}

export interface HellWeekJudgeCalibrationResult {
  outputPath?: string;
  report: HellWeekJudgeCalibrationReport;
}

interface CalibrationVerdict {
  item: HellWeekGoldItem;
  passIndex: number;
  verdict: JudgeVerdict;
  initialVerdict?: JudgeVerdict;
  verificationVerdict?: JudgeVerdict;
  finalAdjudicationVerdict?: JudgeVerdict;
  safetyFloorEscalated: boolean;
  demoKillerVerified: boolean;
  hardDisputeAdjudicated: boolean;
}

export async function runHellWeekJudgeCalibration(
  input: HellWeekJudgeCalibrationInput = {},
): Promise<HellWeekJudgeCalibrationResult> {
  const goldSet = input.goldSet ?? hellWeekGoldSet;
  const passes = normalizePositiveInteger(input.passes ?? 3, "--passes");
  const concurrency = normalizePositiveInteger(
    input.concurrency ?? defaultOpenAiHellWeekJudgeConcurrency,
    "--concurrency",
  );
  const model = input.model ?? defaultOpenAiHellWeekJudgeModel;
  const promptVersion = input.promptVersion ?? openAiHellWeekJudgePromptVersion;
  const client = input.client ?? createOpenAiJudgeClient(input.apiKey);
  const mode = input.mode ?? "single_model";
  const repoRoot = input.repoRoot ?? process.cwd();
  const verifierModel =
    input.verifierModel ?? defaultOpenAiHellWeekVerifierModel;
  const finalAdjudicatorModel =
    input.finalAdjudicatorModel ?? defaultOpenAiHellWeekFinalAdjudicatorModel;
  const now = input.now ?? (() => new Date());

  const jobs = goldSet.flatMap((item) =>
    Array.from({ length: passes }, (_, index) => ({
      item,
      passIndex: index + 1,
    })),
  );

  const verdicts = await mapLimit(jobs, concurrency, async (job, index) => {
    input.onProgress?.(
      `  [${index + 1}/${jobs.length}] judge ${job.item.scenarioId} pass ${job.passIndex}/${passes}`,
    );
    const packetJson = readGoldPacket(job.item, repoRoot);

    if (mode === "ladder") {
      const adjudication = await judgeScenarioPacketWithEscalation({
        client,
        packetJson,
        scenarioId: job.item.scenarioId,
        safetyFloor: job.item.safetyFloor,
        judgeModel: model,
        verifierModel,
        finalAdjudicatorModel,
        promptVersion,
      });

      return {
        item: job.item,
        passIndex: job.passIndex,
        verdict: adjudication.verdict,
        initialVerdict: adjudication.initialVerdict,
        ...(adjudication.verificationVerdict
          ? { verificationVerdict: adjudication.verificationVerdict }
          : {}),
        ...(adjudication.finalAdjudicationVerdict
          ? {
              finalAdjudicationVerdict: adjudication.finalAdjudicationVerdict,
            }
          : {}),
        safetyFloorEscalated: adjudication.safetyFloorEscalated,
        demoKillerVerified: adjudication.demoKillerVerified,
        hardDisputeAdjudicated: adjudication.hardDisputeAdjudicated,
      };
    }

    const verdict = await judgeScenarioPacket({
      client,
      packetJson,
      scenarioId: job.item.scenarioId,
      model,
      promptVersion,
    });

    return {
      item: job.item,
      passIndex: job.passIndex,
      verdict,
      safetyFloorEscalated: false,
      demoKillerVerified: false,
      hardDisputeAdjudicated: false,
    };
  });

  const report = buildCalibrationReport({
    generatedAt: now().toISOString(),
    goldSet,
    mode,
    model,
    verifierModel,
    finalAdjudicatorModel,
    promptVersion,
    passes,
    verdicts,
  });

  if (input.outputPath) {
    mkdirSync(dirname(input.outputPath), { recursive: true });
    writeFileSync(input.outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  return {
    ...(input.outputPath ? { outputPath: input.outputPath } : {}),
    report,
  };
}

function readGoldPacket(item: HellWeekGoldItem, repoRoot: string): string {
  const path = resolve(repoRoot, item.packetPath);
  const raw = readFileSync(path, "utf8");
  return sanitizeScenarioPacketJsonForJudge(
    raw,
    item.packetPath,
    item.scenarioId,
  ).json;
}

function buildCalibrationReport({
  generatedAt,
  goldSet,
  model,
  mode,
  verifierModel,
  finalAdjudicatorModel,
  promptVersion,
  passes,
  verdicts,
}: {
  generatedAt: string;
  goldSet: readonly HellWeekGoldItem[];
  model: string;
  mode: HellWeekJudgeCalibrationMode;
  verifierModel: string;
  finalAdjudicatorModel: string;
  promptVersion: string;
  passes: number;
  verdicts: CalibrationVerdict[];
}): HellWeekJudgeCalibrationReport {
  const total = verdicts.length;
  const severityMatches = verdicts.filter(
    ({ item, verdict }) => verdict.severity === item.label.severity,
  ).length;
  const passMatches = verdicts.filter(
    ({ item, verdict }) => verdict.pass === item.label.pass,
  ).length;
  const safetyFloorVerdicts = verdicts.filter(({ item }) => item.safetyFloor);
  const safetyFloorSeverityMatches = safetyFloorVerdicts.filter(
    ({ item, verdict }) => verdict.severity === item.label.severity,
  ).length;
  const missedBreachCount = verdicts.filter(isMissedBreach).length;
  const missedSafetyFloorBreachCount = verdicts.filter(
    (entry) => entry.item.safetyFloor && isMissedBreach(entry),
  ).length;
  const missedDemoKillerBreachCount = verdicts.filter(
    ({ item, verdict }) =>
      item.label.severity === "demo_killer" &&
      verdict.severity !== "demo_killer",
  ).length;
  const harshCallCount = verdicts.filter(isHarshCall).length;
  const safetyFloorHarshCallCount = verdicts.filter(
    (entry) => entry.item.safetyFloor && isHarshCall(entry),
  ).length;
  const overFlagCount = verdicts.filter(
    ({ item, verdict }) =>
      item.label.severity === "fine" && verdict.severity !== "fine",
  ).length;
  const severityDistanceTotal = verdicts.reduce(
    (sum, { item, verdict }) =>
      sum +
      Math.abs(
        severityRank[verdict.severity] - severityRank[item.label.severity],
      ),
    0,
  );
  const correctConfidences = verdicts
    .filter(({ item, verdict }) => verdict.severity === item.label.severity)
    .flatMap(({ verdict }) =>
      typeof verdict.confidence === "number" ? [verdict.confidence] : [],
    );
  const incorrectConfidences = verdicts
    .filter(({ item, verdict }) => verdict.severity !== item.label.severity)
    .flatMap(({ verdict }) =>
      typeof verdict.confidence === "number" ? [verdict.confidence] : [],
    );
  const pairwise = pairwiseAgreement(verdicts);
  const safetyFloorEscalations = verdicts.filter(
    ({ safetyFloorEscalated }) => safetyFloorEscalated,
  ).length;
  const demoKillerVerifications = verdicts.filter(
    ({ demoKillerVerified }) => demoKillerVerified,
  ).length;
  const hardDisputeAdjudications = verdicts.filter(
    ({ hardDisputeAdjudicated }) => hardDisputeAdjudicated,
  ).length;

  return {
    schemaVersion: 1,
    generatedAt,
    goldSetVersion: hellWeekGoldSetVersion,
    judge: {
      provider: "openai",
      mode,
      model,
      ...(mode === "ladder"
        ? {
            verifierModel,
            finalAdjudicatorModel,
          }
        : {}),
      tool: openAiHellWeekJudgeTool,
      promptVersion,
      rubricHash: openAiHellWeekJudgeRubricHash,
      passesPerItem: passes,
      itemCount: goldSet.length,
      verdictCount: total,
    },
    metrics: {
      labelAgreement: {
        severity: rate(severityMatches, total),
        pass: rate(passMatches, total),
        safetyFloorSeverity: rate(
          safetyFloorSeverityMatches,
          safetyFloorVerdicts.length,
        ),
        missedBreach: rate(missedBreachCount, total),
        missedSafetyFloorBreach: rate(
          missedSafetyFloorBreachCount,
          safetyFloorVerdicts.length,
        ),
        missedDemoKillerBreach: rate(missedDemoKillerBreachCount, total),
        harshCall: rate(harshCallCount, total),
        safetyFloorHarshCall: rate(
          safetyFloorHarshCallCount,
          safetyFloorVerdicts.length,
        ),
        overFlag: rate(overFlagCount, total),
        averageSeverityDistance:
          total === 0 ? null : round(severityDistanceTotal / total),
      },
      interRunSelfAgreement: {
        severityPairwise: pairwise.severity,
        passPairwise: pairwise.pass,
      },
      confidence: {
        correctAverage: average(correctConfidences),
        correctCount: correctConfidences.length,
        incorrectAverage: average(incorrectConfidences),
        incorrectCount: incorrectConfidences.length,
      },
      escalation: {
        safetyFloorEscalations: rate(safetyFloorEscalations, total),
        demoKillerVerifications: rate(demoKillerVerifications, total),
        hardDisputeAdjudications: rate(hardDisputeAdjudications, total),
      },
      confusion: confusion(verdicts),
    },
    items: goldSet.map((item) => itemReport(item, verdicts)),
  };
}

function isMissedBreach({ item, verdict }: CalibrationVerdict): boolean {
  return item.label.severity !== "fine" && verdict.severity === "fine";
}

function isHarshCall({ item, verdict }: CalibrationVerdict): boolean {
  return severityRank[verdict.severity] > severityRank[item.label.severity];
}

function itemReport(
  item: HellWeekGoldItem,
  verdicts: readonly CalibrationVerdict[],
): HellWeekJudgeCalibrationItemResult {
  const itemVerdicts = verdicts
    .filter((entry) => entry.item.id === item.id)
    .sort((a, b) => a.passIndex - b.passIndex);

  return {
    id: item.id,
    scenarioId: item.scenarioId,
    dimension: item.dimension,
    safetyFloor: item.safetyFloor,
    packetPath: item.packetPath,
    sourcePath: item.sourcePath,
    label: goldLabelToJudgeVerdict(item),
    verdicts: itemVerdicts.map(
      ({
        passIndex,
        verdict,
        initialVerdict,
        verificationVerdict,
        finalAdjudicationVerdict,
        safetyFloorEscalated,
        demoKillerVerified,
        hardDisputeAdjudicated,
      }) => ({
        passIndex,
        pass: verdict.pass,
        severity: verdict.severity,
        ...(initialVerdict ? { initialSeverity: initialVerdict.severity } : {}),
        ...(verificationVerdict
          ? { verificationSeverity: verificationVerdict.severity }
          : {}),
        ...(finalAdjudicationVerdict
          ? {
              finalAdjudicationSeverity: finalAdjudicationVerdict.severity,
            }
          : {}),
        ...(safetyFloorEscalated ? { safetyFloorEscalated } : {}),
        ...(demoKillerVerified ? { demoKillerVerified } : {}),
        ...(hardDisputeAdjudicated ? { hardDisputeAdjudicated } : {}),
        ...(typeof verdict.confidence === "number"
          ? { confidence: verdict.confidence }
          : {}),
        rationale: verdict.rationale,
      }),
    ),
  };
}

function pairwiseAgreement(verdicts: readonly CalibrationVerdict[]): {
  severity: CountRate;
  pass: CountRate;
} {
  let severityMatches = 0;
  let passMatches = 0;
  let total = 0;
  const byItem = new Map<string, CalibrationVerdict[]>();

  for (const verdict of verdicts) {
    const bucket = byItem.get(verdict.item.id) ?? [];
    bucket.push(verdict);
    byItem.set(verdict.item.id, bucket);
  }

  for (const itemVerdicts of byItem.values()) {
    for (let left = 0; left < itemVerdicts.length; left += 1) {
      for (let right = left + 1; right < itemVerdicts.length; right += 1) {
        const leftVerdict = itemVerdicts[left]?.verdict;
        const rightVerdict = itemVerdicts[right]?.verdict;

        if (!leftVerdict || !rightVerdict) {
          continue;
        }

        total += 1;
        if (leftVerdict.severity === rightVerdict.severity) {
          severityMatches += 1;
        }
        if (leftVerdict.pass === rightVerdict.pass) {
          passMatches += 1;
        }
      }
    }
  }

  return {
    severity: rate(severityMatches, total),
    pass: rate(passMatches, total),
  };
}

function confusion(
  verdicts: readonly CalibrationVerdict[],
): HellWeekJudgeCalibrationReport["metrics"]["confusion"] {
  const counts = new Map<string, number>();

  for (const { item, verdict } of verdicts) {
    const key = `${item.label.severity}:${verdict.severity}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([key, count]) => {
      const [labelSeverity, judgedSeverity] = key.split(":") as [
        Severity,
        Severity,
      ];
      return {
        label: labelSeverity,
        judged: judgedSeverity,
        count,
      };
    })
    .sort(
      (a, b) =>
        severityRank[b.label] - severityRank[a.label] ||
        severityRank[b.judged] - severityRank[a.judged],
    );
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function rate(count: number, total: number): CountRate {
  return {
    count,
    total,
    rate: total === 0 ? null : round(count / total),
  };
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function normalizePositiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}
