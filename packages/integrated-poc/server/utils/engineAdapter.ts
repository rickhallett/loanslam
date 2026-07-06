import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import type { IntakeField, ValidatedTurnResult } from "@loanslam/contracts";
import { loadCorpusFromFile } from "@loanslam/core/corpus";
import { processTurn } from "@loanslam/core/engine";
import {
  loadOpenAiPlannerConfig,
  PlannerConfigurationError,
} from "@loanslam/core/planners/config";
import { OpenAiTurnPlanner } from "@loanslam/core/planners/openai";

import type { IpocTicket } from "../domains/ipoc/models/ipoc.model";
import type { IpocSession } from "../domains/ipoc/stores/ipocSession.store";

// The dev server runs with cwd=packages/integrated-poc; the built Nitro
// output runs from the repo root or a deploy artifact directory. Resolve the
// corpus against whichever exists, with an env override for deploys.
function resolveCorpusPath(): string {
  if (process.env.IPOC_CORPUS_PATH) {
    return process.env.IPOC_CORPUS_PATH;
  }

  const relativePath = "data/public-info/loanslam-synthetic-kb.json";
  const candidates = [
    resolve(process.cwd(), relativePath),
    resolve(process.cwd(), "../..", relativePath),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));

  if (!found) {
    // Plain Error: this runs at module init, before the class declaration
    // below is initialized.
    throw new Error(
      `Corpus file not found. Checked: ${candidates.join(", ")}. Set IPOC_CORPUS_PATH to override.`,
    );
  }

  return found;
}

const corpus = loadCorpusFromFile(resolveCorpusPath()).items;
const handoffActions = new Set([
  "request_handoff_intake",
  "create_ticket",
  "escalate",
]);

export class IpocEngineConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IpocEngineConfigurationError";
  }
}

export async function runIpocTurn({
  session,
  message,
}: {
  session: IpocSession;
  message: string;
}): Promise<ValidatedTurnResult> {
  try {
    const result = await processTurn({
      state: session.state,
      userMessage: message,
      planner: new OpenAiTurnPlanner({
        config: loadOpenAiPlannerConfig(process.env),
      }),
      corpus,
    });
    session.state = result.state;
    session.traces.push(result.trace);
    return result;
  } catch (error) {
    if (error instanceof PlannerConfigurationError) {
      throw new IpocEngineConfigurationError(error.message);
    }

    throw error;
  }
}

export function maybeBuildTicketFromTurn({
  result,
  createdAt = new Date(),
}: {
  result: ValidatedTurnResult;
  createdAt?: Date;
}): IpocTicket | null {
  if (
    !handoffActions.has(result.finalAction) &&
    result.ui.primitive !== "intake_form" &&
    result.ui.primitive !== "handoff_confirmation"
  ) {
    return null;
  }

  return {
    id: `TCK-${randomUUID().slice(0, 8).toUpperCase()}`,
    conversationRef: result.conversationRef,
    requestRef: result.requestRef ?? null,
    status: "open",
    queue: "support",
    createdAt: createdAt.toISOString(),
    customerContext: {
      journey: "application-help",
      summary: summarizeHandoffContext(result),
      piiPolicy: "raw_customer_message_omitted",
    },
    structuredIntake: null,
    agentNotes: [],
    engine: {
      finalAction: result.finalAction,
      uiPrimitive: result.ui.primitive,
      servingMode:
        result.trace.effectiveServingMode ??
        result.trace.selectedServingMode ??
        null,
      safetyFlags: [...result.trace.safetyFlags],
      requestedFields: requestedFieldsForTicket(result),
      validatorOverrideCodes: result.validatorOverrides.map(
        (override) => override.code,
      ),
    },
    assistantPreview: result.customerMessage,
  };
}

function summarizeHandoffContext(result: ValidatedTurnResult): string {
  if (result.trace.safetyFlags.includes("account_specific_request")) {
    return "Customer needs account-specific support and should be handled by a human agent.";
  }

  if (result.trace.safetyFlags.includes("change_request")) {
    return "Customer asked for a change request that remains outside the read-only POC scope.";
  }

  if (result.finalAction === "escalate") {
    return "Customer support turn was escalated by the engine safety path.";
  }

  return "Customer asked for application help or support handoff.";
}

function requestedFieldsForTicket(result: ValidatedTurnResult): IntakeField[] {
  if (result.ui.primitive === "intake_form") {
    return [...result.ui.fields];
  }

  return [...result.state.requestedFields];
}
