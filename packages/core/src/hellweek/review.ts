import { copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type {
  CorpusItem,
  PlannerMetadata,
  SignalExtractor,
  TurnPlanner,
} from "@loanslam/contracts";

import {
  hellWeekReviewTierProfile,
  isHellWeekReviewTierProfile,
} from "./scenarios";
import {
  executeHellWeek,
  loadJudgeVerdicts,
  renderFromRun,
  storeHellWeekReport,
  type HellWeekRunArtifacts,
  type HellWeekTheme,
} from "./run";
import {
  judgeHellWeekRun,
  type JudgeHellWeekRunResult,
  type OpenAiHellWeekJudgeClient,
} from "./openaiJudge";

type PlannerWithMetadata = TurnPlanner & { metadata?: PlannerMetadata };

export interface RunHellWeekReviewInput {
  profile?: string;
  corpus: readonly CorpusItem[];
  planner: PlannerWithMetadata;
  signalExtractor?: SignalExtractor;
  outBaseDir: string;
  concurrency?: number;
  judgeConcurrency?: number;
  judgeModel: string;
  verifierModel: string;
  finalAdjudicatorModel: string;
  apiKey?: string;
  judgeClient?: OpenAiHellWeekJudgeClient;
  theme?: HellWeekTheme;
  storeDb?: boolean;
  databaseUrl?: string;
  now?: () => Date;
  onProgress?: (message: string) => void;
}

export interface HellWeekReviewOrchestrationArtifact {
  schemaVersion: 1;
  generatedAt: string;
  command: "hell-week-review";
  profile: string;
  reviewTierProfile: typeof hellWeekReviewTierProfile;
  reviewTierDefinition: string;
  mode: "ladder";
  stages: {
    deterministicCapture: {
      runDir: string;
      reportJsonPath: string;
      snapshotJsonPath: string;
    };
    ladderJudge: {
      verdictsPath: string;
      model: string;
      verifierModel: string;
      finalAdjudicatorModel: string;
      initialDemoKillers: number;
      finalDemoKillers: number;
      safetyFloorEscalations: number;
      demoKillerVerifications: number;
      hardDisputeAdjudications: number;
    };
    regrade: {
      reportJsonPath: string;
      reportHtmlPath: string;
      judged: boolean;
      verdict: HellWeekRunArtifacts["report"]["verdict"];
    };
  };
}

export interface HellWeekReviewArtifacts extends HellWeekRunArtifacts {
  deterministicReportJsonPath: string;
  judgeVerdictsPath: string;
  orchestrationJsonPath: string;
  orchestration: HellWeekReviewOrchestrationArtifact;
  judgeResult: JudgeHellWeekRunResult;
}

export async function runHellWeekReviewOrchestration(
  input: RunHellWeekReviewInput,
): Promise<HellWeekReviewArtifacts> {
  const profile = input.profile ?? hellWeekReviewTierProfile;
  if (!isHellWeekReviewTierProfile(profile)) {
    throw new Error(
      `Hell Week review-tier orchestration uses profile "${hellWeekReviewTierProfile}". ` +
        `Use hell-week for deterministic-only ${profile} runs.`,
    );
  }

  const now = input.now ?? (() => new Date());
  const theme = input.theme ?? "minimal";

  input.onProgress?.(
    `Review-tier profile: ${profile} (full battery -> ladder judge -> regrade).`,
  );

  const captured = await executeHellWeek({
    profile,
    corpus: input.corpus,
    planner: input.planner,
    ...(input.signalExtractor
      ? { signalExtractor: input.signalExtractor }
      : {}),
    outBaseDir: input.outBaseDir,
    theme,
    ...(input.concurrency ? { concurrency: input.concurrency } : {}),
    now,
    ...(input.onProgress ? { onProgress: input.onProgress } : {}),
  });

  const deterministicReportJsonPath = join(
    captured.runDir,
    "report.deterministic-only.json",
  );
  copyFileSync(captured.reportJsonPath, deterministicReportJsonPath);

  const judgeResult = await judgeHellWeekRun({
    runDir: captured.runDir,
    judgeModel: input.judgeModel,
    verifierModel: input.verifierModel,
    finalAdjudicatorModel: input.finalAdjudicatorModel,
    outputPath: join(captured.runDir, "judge-verdicts.json"),
    ...(input.apiKey ? { apiKey: input.apiKey } : {}),
    ...(input.judgeClient ? { client: input.judgeClient } : {}),
    ...(input.judgeConcurrency ? { concurrency: input.judgeConcurrency } : {}),
    now,
    ...(input.onProgress ? { onProgress: input.onProgress } : {}),
  });

  const regraded = renderFromRun({
    runDir: captured.runDir,
    judgeVerdicts: loadJudgeVerdicts(judgeResult.outputPath),
    theme,
    now,
  });

  if (input.storeDb) {
    await storeHellWeekReport({
      report: regraded.report,
      ...(input.databaseUrl ? { databaseUrl: input.databaseUrl } : {}),
    });
  }

  const orchestration: HellWeekReviewOrchestrationArtifact = {
    schemaVersion: 1,
    generatedAt: now().toISOString(),
    command: "hell-week-review",
    profile,
    reviewTierProfile: hellWeekReviewTierProfile,
    reviewTierDefinition:
      "Hell Week full is the review tier: smoke gate plus sections A-M.",
    mode: "ladder",
    stages: {
      deterministicCapture: {
        runDir: captured.runDir,
        reportJsonPath: captured.reportJsonPath,
        snapshotJsonPath: deterministicReportJsonPath,
      },
      ladderJudge: {
        verdictsPath: judgeResult.outputPath,
        model: judgeResult.model,
        verifierModel: judgeResult.verifierModel,
        finalAdjudicatorModel: judgeResult.finalAdjudicatorModel,
        initialDemoKillers: judgeResult.initialDemoKillers,
        finalDemoKillers: judgeResult.finalDemoKillers,
        safetyFloorEscalations: judgeResult.safetyFloorEscalations,
        demoKillerVerifications: judgeResult.demoKillerVerifications,
        hardDisputeAdjudications: judgeResult.hardDisputeAdjudications,
      },
      regrade: {
        reportJsonPath: regraded.reportJsonPath,
        reportHtmlPath: regraded.reportHtmlPath,
        judged: regraded.report.judged,
        verdict: regraded.report.verdict,
      },
    },
  };
  const orchestrationJsonPath = join(
    captured.runDir,
    "review-orchestration.json",
  );
  writeFileSync(
    orchestrationJsonPath,
    `${JSON.stringify(orchestration, null, 2)}\n`,
    "utf8",
  );

  return {
    ...regraded,
    deterministicReportJsonPath,
    judgeVerdictsPath: judgeResult.outputPath,
    orchestrationJsonPath,
    orchestration,
    judgeResult,
  };
}
