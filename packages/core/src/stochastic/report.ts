import type {
  PlannerMetadata,
  StochasticCoverageReport,
  StochasticFinding,
  StochasticHardFailure,
  StochasticHardFailureCategory,
  StochasticProfile,
  StochasticRunArtifact,
  StochasticVerdict,
} from "@loanslam/contracts";
import {
  stochasticHardFailureCategorySchema,
  stochasticRunArtifactSchema,
} from "@loanslam/contracts";

import { policyVersion } from "../policy";
import type { StochasticScenarioResult } from "./evaluate";

const stsVersion = "sts-v1";
const templateSetVersion = "sts-templates-v1";
const promotionSentence =
  "Promotion is provisional and applies only to this STS version, seed/profile, and generator coverage.";

export function buildStochasticRunReport(input: {
  seed: string;
  profile: StochasticProfile;
  planner: PlannerMetadata;
  corpusFingerprint: string;
  scenarioResults: readonly StochasticScenarioResult[];
  coverage: StochasticCoverageReport;
  artifacts: StochasticRunArtifact["artifacts"];
  generatedAt?: Date;
}): StochasticRunArtifact {
  if (input.scenarioResults.length === 0) {
    throw new Error(
      "Stochastic run reports require at least one scenario result.",
    );
  }

  const hardFailures = input.scenarioResults.flatMap(
    (result) => result.hardFailures,
  );
  const findings = input.scenarioResults.flatMap((result) => result.findings);
  const replay = buildReplayCommands({
    seed: input.seed,
    profile: input.profile,
    hardFailures,
    findings,
  });
  const replayMetadataComplete = hasCompleteReplayMetadata(
    input.scenarioResults,
  );
  const verdict = chooseVerdict({
    hardFailures,
    findings,
    coverage: input.coverage,
    replayMetadataComplete,
  });
  const base = {
    seed: input.seed,
    profile: input.profile,
    stsVersion,
    templateSetVersion,
    policyVersion,
    corpusFingerprint: input.corpusFingerprint,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    planner: input.planner,
    scenarioCount: input.scenarioResults.length,
    artifacts: input.artifacts,
    verdictReasons: buildVerdictReasons({
      verdict,
      hardFailures,
      findings,
      coverage: input.coverage,
      replayMetadataComplete,
    }),
    hardFailures,
    findings,
    coverage: input.coverage,
    replay,
  };
  const report =
    verdict === "promote_to_v2_planning"
      ? { ...base, verdict, promotionStatus: "provisional" }
      : { ...base, verdict };

  return stochasticRunArtifactSchema.parse(report);
}

export function renderStochasticSummaryMarkdown(
  report: StochasticRunArtifact,
): string {
  return [
    "# Stochastic Test Simulator Summary",
    "",
    "## Practical Takeaway",
    practicalTakeaway(report),
    "",
    "## Run Metadata",
    ...runMetadataLines(report),
    "",
    "## Verdict",
    `Verdict: ${report.verdict}`,
    ...report.verdictReasons.map((reason) => `- ${reason}`),
    "",
    "## Coverage",
    ...coverageLines(report.coverage),
    "",
    "## Hard Failures",
    ...hardFailureLines(report.hardFailures),
    "",
    "## Findings",
    ...findingLines(report.findings),
    "",
    "## Replay Commands",
    ...replayLines(report),
    "",
    "## Promotion Notes",
    ...promotionLines(report),
    "",
    "## Next Gaps",
    ...nextGapLines(report),
    "",
  ].join("\n");
}

function chooseVerdict(input: {
  hardFailures: readonly StochasticHardFailure[];
  findings: readonly StochasticFinding[];
  coverage: StochasticCoverageReport;
  replayMetadataComplete: boolean;
}): StochasticVerdict {
  if (input.hardFailures.length > 0 || !input.replayMetadataComplete) {
    return "blocked";
  }

  if (
    input.coverage.coverageGaps.length > 0 ||
    missingHardFailureTemplateCoverageCategories(input.coverage).length > 0 ||
    input.findings.length > 0
  ) {
    return "useful_with_findings";
  }

  return "promote_to_v2_planning";
}

function buildVerdictReasons(input: {
  verdict: StochasticVerdict;
  hardFailures: readonly StochasticHardFailure[];
  findings: readonly StochasticFinding[];
  coverage: StochasticCoverageReport;
  replayMetadataComplete: boolean;
}): string[] {
  const reasons: string[] = [];

  if (input.hardFailures.length > 0) {
    reasons.push(
      `${input.hardFailures.length} hard failure(s) block promotion.`,
    );
  } else {
    reasons.push("No hard failures observed.");
  }

  if (!input.replayMetadataComplete) {
    reasons.push("Replay metadata is incomplete.");
  }

  if (input.coverage.coverageGaps.length > 0) {
    reasons.push(
      `${input.coverage.coverageGaps.length} coverage gap(s) remain.`,
    );
  }

  const missingTemplateCategories =
    missingHardFailureTemplateCoverageCategories(input.coverage);
  if (missingTemplateCategories.length > 0) {
    reasons.push(
      `${missingTemplateCategories.length} hard-failure template coverage gap(s) remain.`,
    );
  }

  if (input.findings.length > 0) {
    reasons.push(`${input.findings.length} behavioral finding(s) need review.`);
  }

  if (input.verdict === "promote_to_v2_planning") {
    reasons.push("Replay metadata is complete.");
    reasons.push("Coverage gaps are clear.");
  }

  return reasons;
}

function buildReplayCommands(input: {
  seed: string;
  profile: StochasticProfile;
  hardFailures: readonly StochasticHardFailure[];
  findings: readonly StochasticFinding[];
}): StochasticRunArtifact["replay"] {
  const fullRunCommand = fullReplayCommand(input.seed, input.profile);

  return {
    fullRunCommand,
    topFindingCommands: uniqueCommands(
      input.findings.flatMap((finding) =>
        replayCommandsForFinding(finding, input.seed, input.profile),
      ),
    ).slice(0, 5),
    hardFailureCommands: uniqueCommands(
      input.hardFailures.map(
        (failure) =>
          failure.replayCommand ??
          scenarioReplayCommand(
            input.seed,
            input.profile,
            failure.scenarioPath,
          ),
      ),
    ),
  };
}

function replayCommandsForFinding(
  finding: StochasticFinding,
  seed: string,
  profile: StochasticProfile,
): string[] {
  if (finding.replayCommand !== undefined) {
    return [finding.replayCommand];
  }

  if (finding.scenarioPath !== undefined) {
    return [scenarioReplayCommand(seed, profile, finding.scenarioPath)];
  }

  return (finding.scenarioPaths ?? []).map((scenarioPath) =>
    scenarioReplayCommand(seed, profile, scenarioPath),
  );
}

function fullReplayCommand(seed: string, profile: StochasticProfile): string {
  return `just core-stochastic -- --seed ${seed} --profile ${profile}`;
}

function scenarioReplayCommand(
  seed: string,
  profile: StochasticProfile,
  scenarioPath: string,
): string {
  return `${fullReplayCommand(seed, profile)} --scenario ${scenarioPath}`;
}

function uniqueCommands(commands: readonly string[]): string[] {
  return [...new Set(commands.filter((command) => command.trim() !== ""))];
}

function hasCompleteReplayMetadata(
  scenarioResults: readonly StochasticScenarioResult[],
): boolean {
  return scenarioResults.every(
    (result) =>
      result.traces.length > 0 &&
      result.traces.every(
        (trace) =>
          trace.scenarioPath === result.scenarioPath &&
          trace.scenarioPath.trim() !== "" &&
          trace.traceId.trim() !== "" &&
          trace.requestRef.trim() !== "",
      ),
  );
}

function practicalTakeaway(report: StochasticRunArtifact): string {
  if (report.verdict === "blocked") {
    return "This STS run is blocked. Fix the hard or replayability failures before treating it as Phase 0 promotion evidence.";
  }

  if (report.verdict === "useful_with_findings") {
    return "This STS run is useful evidence, but it still has findings or coverage gaps to review before promotion.";
  }

  return "This STS run has no hard failures, complete replay metadata, and clear sampled coverage. It can be used as provisional v2 planning evidence.";
}

function runMetadataLines(report: StochasticRunArtifact): string[] {
  return [
    `- Seed: ${report.seed}`,
    `- Profile: ${report.profile}`,
    `- Generated: ${report.generatedAt}`,
    `- Planner: ${report.planner.provider}/${report.planner.model} (${report.planner.promptVersion})`,
    `- Policy: ${report.policyVersion}`,
    `- Corpus: ${report.corpusFingerprint}`,
    `- Scenarios: ${report.scenarioCount}`,
    `- Run JSON: ${report.artifacts.runJson}`,
    `- Scenarios JSONL: ${report.artifacts.scenariosJsonl}`,
    `- Traces JSONL: ${report.artifacts.tracesJsonl}`,
  ];
}

function coverageLines(coverage: StochasticCoverageReport): string[] {
  const lines: string[] = [];

  if (coverage.coverageGaps.length === 0) {
    lines.push("- No sampled axis coverage gaps.");
  } else {
    lines.push(...coverage.coverageGaps.map((gap) => `- ${gap}`));
  }

  for (const [axis, entry] of Object.entries(coverage.axisCoverage)) {
    if (entry === undefined) {
      continue;
    }

    lines.push(
      `- ${axis}: ${entry.coveredValues.length} covered, ${entry.missingValues.length} missing.`,
    );
  }

  for (const spread of coverage.highRiskIntentSpread) {
    lines.push(
      `- High-risk ${spread.intent}: ${spread.coveredPersonaStyles.length} persona style(s) covered, ${spread.missingPersonaStyles.length} missing.`,
    );
  }

  const uncoveredHardFailureCategories =
    missingHardFailureTemplateCoverageCategories(coverage);
  if (uncoveredHardFailureCategories.length === 0) {
    lines.push("- Every hard-failure category has template coverage.");
  } else {
    lines.push(
      `- Missing hard-failure template coverage: ${uncoveredHardFailureCategories.join(", ")}.`,
    );
  }

  return lines;
}

function hardFailureLines(
  hardFailures: readonly StochasticHardFailure[],
): string[] {
  if (hardFailures.length === 0) {
    return ["None."];
  }

  return hardFailures.map(
    (failure) =>
      `- ${failure.category}: ${failure.message} (${failure.scenarioPath})`,
  );
}

function findingLines(findings: readonly StochasticFinding[]): string[] {
  if (findings.length === 0) {
    return ["None."];
  }

  return findings.map((finding) => {
    const scope =
      finding.scenarioPath ?? finding.scenarioPaths?.join(", ") ?? "run";

    return `- ${finding.category}: ${finding.message} (${scope})`;
  });
}

function replayLines(report: StochasticRunArtifact): string[] {
  const lines = [`Full run:`, codeLine(report.replay.fullRunCommand)];

  if (report.replay.hardFailureCommands.length > 0) {
    lines.push("Hard failures:");
    lines.push(...report.replay.hardFailureCommands.map(codeLine));
  }

  if (report.replay.topFindingCommands.length > 0) {
    lines.push("Top findings:");
    lines.push(...report.replay.topFindingCommands.map(codeLine));
  }

  return lines;
}

function promotionLines(report: StochasticRunArtifact): string[] {
  if (report.verdict === "promote_to_v2_planning") {
    return [promotionSentence];
  }

  return ["No provisional promotion was issued for this run."];
}

function nextGapLines(report: StochasticRunArtifact): string[] {
  if (report.hardFailures.length > 0) {
    return uniqueCommands(
      report.hardFailures.map(
        (failure) => `Resolve ${failure.category} in ${failure.scenarioPath}.`,
      ),
    ).map((line) => `- ${line}`);
  }

  if (report.coverage.coverageGaps.length > 0) {
    return [
      ...report.coverage.coverageGaps.map((gap) => `- ${gap}`),
      ...missingHardFailureTemplateCoverageCategories(report.coverage).map(
        (category) => `- Add hard-failure template coverage for ${category}.`,
      ),
    ];
  }

  const missingTemplateCategories =
    missingHardFailureTemplateCoverageCategories(report.coverage);
  if (missingTemplateCategories.length > 0) {
    return missingTemplateCategories.map(
      (category) => `- Add hard-failure template coverage for ${category}.`,
    );
  }

  if (report.findings.length > 0) {
    return uniqueCommands(
      report.findings.map((finding) => `Review ${finding.category}.`),
    ).map((line) => `- ${line}`);
  }

  return ["- Compare another seed/profile before widening the product build."];
}

function codeLine(command: string): string {
  return `\`${command}\``;
}

function missingHardFailureTemplateCoverageCategories(
  coverage: StochasticCoverageReport,
): StochasticHardFailureCategory[] {
  return stochasticHardFailureCategorySchema.options.filter((category) =>
    coverage.hardFailureTemplateCoverage.every(
      (entry) => entry.category !== category || !entry.covered,
    ),
  );
}
