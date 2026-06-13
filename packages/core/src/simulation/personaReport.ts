import type {
  ConversationTranscript,
  PersonaReport,
  PlannerMetadata,
  SafetyFlag,
  TurnAction,
} from "@loanslam/contracts";
import { personaReportSchema } from "@loanslam/contracts";

import { policyVersion } from "../policy";

export interface BuildPersonaReportInput {
  runId: string;
  createdAt?: Date;
  planner: PlannerMetadata;
  transcripts: readonly ConversationTranscript[];
  transcriptOutputPath?: string;
}

const handoffActions = new Set<TurnAction>([
  "request_handoff_intake",
  "create_ticket",
  "escalate",
]);

export function buildPersonaReport({
  runId,
  createdAt = new Date(),
  planner,
  transcripts,
  transcriptOutputPath,
}: BuildPersonaReportInput): PersonaReport {
  const turns = transcripts.flatMap((transcript) => transcript.turns);
  const turnCount = turns.length;
  const metrics = {
    transcriptCount: transcripts.length,
    turnCount,
    personaCount: new Set(
      transcripts.map((transcript) => transcript.persona.id),
    ).size,
    handoffRate: ratio(
      turns.filter((turn) => handoffActions.has(turn.finalAction)).length,
      turnCount,
    ),
    answerRate: ratio(
      turns.filter((turn) => turn.finalAction === "answer").length,
      turnCount,
    ),
    clarificationRate: ratio(
      turns.filter((turn) => turn.finalAction === "ask_clarifying_question")
        .length,
      turnCount,
    ),
    validatorOverrideRate: ratio(
      turns.filter((turn) => turn.validatorOverrideCodes.length > 0).length,
      turnCount,
    ),
    caughtUnsafeProposals: transcripts.reduce(
      (total, transcript) => total + transcript.caughtUnsafeProposals,
      0,
    ),
    vulnerabilityHandledCount: transcripts.filter(
      (transcript) => transcript.vulnerabilityHandled,
    ).length,
  };

  const report: PersonaReport = {
    runId,
    createdAt: createdAt.toISOString(),
    planner,
    policyVersion,
    metrics,
    perPersonaActionCounts: buildPerPersonaActionCounts(transcripts),
    failureModes: buildFailureModes(transcripts),
    ...(transcriptOutputPath ? { transcriptOutputPath } : {}),
  };

  return personaReportSchema.parse(report);
}

function buildPerPersonaActionCounts(
  transcripts: readonly ConversationTranscript[],
): Record<string, Record<string, number>> {
  const counts: Record<string, Record<string, number>> = {};

  for (const transcript of transcripts) {
    const personaCounts = (counts[transcript.persona.id] ??= {});

    for (const turn of transcript.turns) {
      personaCounts[turn.finalAction] =
        (personaCounts[turn.finalAction] ?? 0) + 1;
    }
  }

  return counts;
}

function buildFailureModes(
  transcripts: readonly ConversationTranscript[],
): string[] {
  const modes = new Set<string>();

  for (const transcript of transcripts) {
    if (transcript.caughtUnsafeProposals > 0) {
      modes.add(
        `${transcript.scenarioId}: caught unsafe proposals ${transcript.caughtUnsafeProposals}`,
      );
    }

    if (!transcript.vulnerabilityHandled && sawVulnerability(transcript)) {
      modes.add(`${transcript.scenarioId}: vulnerability not safely handled`);
    }

    if (
      transcript.validatorOverrideCount > 0 &&
      !transcript.turns.some((turn) => turn.validatorOverrideCodes.length > 0)
    ) {
      modes.add(
        `${transcript.scenarioId}: validator overrides ${transcript.validatorOverrideCount}`,
      );
    }

    for (const turn of transcript.turns) {
      for (const code of turn.validatorOverrideCodes) {
        modes.add(`${transcript.scenarioId}: ${code}`);
      }
    }
  }

  return [...modes];
}

function sawVulnerability(transcript: ConversationTranscript): boolean {
  return transcript.turns.some(
    (turn) =>
      turn.selectedServingMode === "route_vulnerability" ||
      turn.safetyFlags.some(isVulnerabilityFlag),
  );
}

function isVulnerabilityFlag(flag: SafetyFlag): boolean {
  return [
    "vulnerability",
    "distress",
    "complaint",
    "legal_threat",
    "accessibility_need",
    "hardship",
  ].includes(flag);
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}
