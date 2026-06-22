import type { SafetyFlag, ServingMode, TurnAction } from "@loanslam/contracts";
import type { JudgeTriageLabel, TriageLabel } from "./triageLabels";

/**
 * Hell Week drives the live, model-backed engine across a broad, deliberately
 * hostile scenario set and grades the result the way Phase 0 stakeholders read
 * it: a tiny non-negotiable safety floor, then judged behaviour for everything
 * else. The encoded scenario set in this package is the current source; imported
 * historical runs are indexed in artifacts/evidence-index/hell-week-runs.md.
 */

/** Stakeholder-facing severity, inherited from the prior stakeholder reports. */
export type Severity = "demo_killer" | "dent" | "fine";

export const severityRank: Record<Severity, number> = {
  fine: 0,
  dent: 1,
  demo_killer: 2,
};

export function worstSeverity(a: Severity, b: Severity): Severity {
  return severityRank[a] >= severityRank[b] ? a : b;
}

/**
 * The behaviour classes stakeholders care about. Each maps to a column in the
 * dashboard scorecard. `*_HARD` dimensions back the safety floor.
 */
export type StakeholderDimension =
  | "domain_boundary"
  | "faq_deflection"
  | "clarification"
  | "account_boundary"
  | "intake_flow"
  | "human_support"
  | "regulatory_boundary"
  | "credential_safety"
  | "prompt_injection"
  | "negation_robustness"
  | "sticky_state"
  | "trace_integrity"
  | "ux_quality";

export const dimensionLabels: Record<StakeholderDimension, string> = {
  domain_boundary: "Domain boundary",
  faq_deflection: "FAQ deflection",
  clarification: "Clarification",
  account_boundary: "Account boundary",
  intake_flow: "Intake flow",
  human_support: "Human support routing",
  regulatory_boundary: "Regulatory boundary",
  credential_safety: "Credential safety",
  prompt_injection: "Prompt injection / data",
  negation_robustness: "Negation robustness",
  sticky_state: "Sticky state",
  trace_integrity: "Trace integrity",
  ux_quality: "Conversation quality",
};

/**
 * The dimensions that form the compliance/safety floor. A failure here is a
 * go/no-go demo-killer, not a tuning dent.
 */
export const safetyFloorDimensions: StakeholderDimension[] = [
  "credential_safety",
  "account_boundary",
  "regulatory_boundary",
  "prompt_injection",
  "human_support",
];

/**
 * Deterministic content backstops applied to the bot's visible copy. Only the
 * `HARD` subset is treated as a non-negotiable safety invariant that the LLM
 * judge cannot clear. Everything else is advisory: a signal the judge weighs,
 * not a brittle gate (see CLAUDE.md on burning static restraints).
 */
export type ContentCheck =
  | "no_credential_request"
  | "no_account_invention"
  | "no_internal_data_leak"
  | "no_approval_estimate"
  | "no_excluded_advice"
  | "no_offdomain_help"
  | "english_only";

export const hardContentChecks: ContentCheck[] = [
  "no_credential_request",
  "no_account_invention",
  "no_internal_data_leak",
  "no_approval_estimate",
];

export interface HellWeekExpectation {
  allowedFinalActions?: TurnAction[];
  requiredFinalAction?: TurnAction;
  requiredServingModes?: ServingMode[];
  forbiddenServingModes?: ServingMode[];
  requiredSafetyFlags?: SafetyFlag[];
  forbiddenSafetyFlags?: SafetyFlag[];
  maxClarificationTurns?: number;
  contentChecks?: ContentCheck[];
}

export interface HellWeekScenario {
  id: string;
  /** "smoke" or a battery section letter A-M. */
  category: string;
  categoryTitle: string;
  title: string;
  dimension: StakeholderDimension;
  /**
   * Customer messages, one per turn. The token `<<intake-bundle>>` expands to
   * the standard synthetic intake bundle so handoff flows can complete.
   */
  customerTurns: string[];
  expected: HellWeekExpectation;
  /** Human-readable failure markers, handed to the LLM judge. */
  failureMarkers: string;
  watch?: string;
  /** Worst-case severity if this scenario's core invariant breaks. */
  severityFloor: Severity;
}

export interface HellWeekProfile {
  id: string;
  description: string;
  /** Category ids included. Empty means all. */
  categories: string[];
}

// ---------------------------------------------------------------------------
// Captured evidence (live, model-backed run)
// ---------------------------------------------------------------------------

export interface HellWeekRetrieved {
  itemId: string;
  servingMode: ServingMode;
  score: number;
}

export interface HellWeekTurnEvidence {
  turnIndex: number;
  userMessage: string;
  botMessage: string;
  finalAction: TurnAction;
  proposedAction: TurnAction;
  selectedServingMode: ServingMode | null;
  effectiveServingMode: ServingMode | null;
  routeForScoring: ServingMode | null;
  selectedRouteReason: string | null;
  safetyFlags: SafetyFlag[];
  validatorOverrideCodes: string[];
  retrieved: HellWeekRetrieved[];
  uiPrimitive: string;
  signalStatus?: string;
  signalPrimaryIntent?: string;
  signalRecommendedServingMode?: ServingMode | null;
  signalNegatedOrCorrected?: boolean;
  signalComparisonStatus?: string;
  signalLatencyMs?: number;
  plannerLatencyMs?: number;
}

export interface HellWeekScenarioEvidence {
  scenarioId: string;
  conversationRef: string;
  turns: HellWeekTurnEvidence[];
  durationMs: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

export interface DeterministicResult {
  envelopeFailures: string[];
  contentViolations: ContentCheck[];
  hardSafetyViolations: ContentCheck[];
  triageLabels: TriageLabel[];
  severity: Severity;
  pass: boolean;
}

export interface JudgeVerdict {
  scenarioId: string;
  pass: boolean;
  severity: Severity;
  triageLabels: JudgeTriageLabel[];
  uxScore: number;
  rationale: string;
  confidence?: number;
}

export interface JudgeMetadata {
  generatedAt: string;
  provider?: string;
  model?: string;
  tool?: string;
  promptVersion?: string;
  sourceRunId?: string;
  sourceRunPath?: string;
  scenarioCount?: number;
  rubricHash?: string;
}

export interface JudgeVerdictArtifact {
  schemaVersion: 1;
  metadata: JudgeMetadata;
  verdicts: JudgeVerdict[];
}

export interface LoadedJudgeVerdicts {
  verdicts: Map<string, JudgeVerdict>;
  metadata?: JudgeMetadata;
  artifact?: JudgeVerdictArtifact;
}

export interface HellWeekJudgeReportMetadata extends Partial<JudgeMetadata> {
  verdictCount: number;
  artifactSchemaVersion?: 1;
}

export interface HellWeekGrade {
  scenarioId: string;
  category: string;
  categoryTitle: string;
  title: string;
  dimension: StakeholderDimension;
  deterministic: DeterministicResult;
  judge?: JudgeVerdict;
  /** Authoritative merged outcome. */
  pass: boolean;
  severity: Severity;
  triageLabels: TriageLabel[];
  uxScore?: number;
  rationale: string;
  hardFloorTriggered: boolean;
  graderSource: "hard_floor" | "judge" | "deterministic";
}

// ---------------------------------------------------------------------------
// Aggregate report
// ---------------------------------------------------------------------------

export type HellWeekVerdict = "blocked" | "needs_work" | "ship_ready";

export interface CountPair {
  pass: number;
  total: number;
}

export interface CategoryStat extends CountPair {
  category: string;
  categoryTitle: string;
  demoKillers: number;
  dents: number;
}

export interface DimensionStat extends CountPair {
  dimension: StakeholderDimension;
  label: string;
  demoKillers: number;
  dents: number;
  isSafetyFloor: boolean;
}

export interface RiskItem {
  scenarioId: string;
  category: string;
  title: string;
  dimension: StakeholderDimension;
  severity: Severity;
  triageLabels: TriageLabel[];
  rationale: string;
  lastUserMessage: string;
  lastBotMessage: string;
}

export interface HellWeekReport {
  runId: string;
  generatedAt: string;
  profile: string;
  planner: { provider: string; model: string; promptVersion: string };
  signalExtractor: {
    enabled: boolean;
    model?: string;
    promptVersion?: string;
  };
  policyVersion: string;
  judged: boolean;
  judge?: HellWeekJudgeReportMetadata;
  durationMs: number;
  runtime?: HellWeekRuntimeSummary;

  verdict: HellWeekVerdict;
  verdictReasons?: string[];
  headline: string;

  totals: {
    scenarios: number;
    passed: number;
    failed: number;
    passRate: number;
    demoKillers: number;
    dents: number;
    fine: number;
    errored: number;
  };

  safetyFloor: {
    pass: number;
    total: number;
    breached: boolean;
    dimensions: DimensionStat[];
    demoKillers: RiskItem[];
    dents?: RiskItem[];
  };

  deflection: {
    answered: number;
    total: number;
    rate: number;
    leaked: RiskItem[];
  };

  routingPrecision: {
    inScopeScenarios: number;
    misroutes: number;
    rate: number;
    signalTurns: number;
    signalAgreements: number;
    signalAgreementRate: number;
  };

  uxQuality: {
    scored: number;
    averageScore: number | null;
  };

  categories: CategoryStat[];
  dimensions: DimensionStat[];
  severityCounts: Record<Severity, number>;
  triageCounts: { label: TriageLabel; count: number }[];

  topRisks: RiskItem[];
  grades: HellWeekGrade[];
  evidence: HellWeekScenarioEvidence[];
  scenarios: HellWeekScenario[];
}

export interface HellWeekRuntimeStat {
  count: number;
  missing: number;
  totalMs: number;
  averageMs: number | null;
  medianMs: number | null;
  p95Ms: number | null;
  maxMs: number | null;
}

export interface HellWeekRuntimeSummary {
  scenarioWallTimeMs: HellWeekRuntimeStat;
  signalLatencyMs: HellWeekRuntimeStat;
  plannerLatencyMs: HellWeekRuntimeStat;
}
