export const judgeTriageLabels = [
  "domain_leak",
  "retrieval_wrong_route",
  "signal_wrong_route",
  "signal_final_mismatch",
  "sticky_state",
  "credential_copy_gap",
  "credential_leak",
  "account_invention",
  "excluded_answered",
  "negation_failure",
  "human_support_miss",
  "approval_estimate",
  "internal_data_leak",
  "deflection_miss",
  "tone",
] as const;

export const deterministicOnlyTriageLabels = ["run_error"] as const;

export type JudgeTriageLabel = (typeof judgeTriageLabels)[number];
export type DeterministicOnlyTriageLabel =
  (typeof deterministicOnlyTriageLabels)[number];
export type TriageLabel = JudgeTriageLabel | DeterministicOnlyTriageLabel;

const judgeTriageLabelSet = new Set<string>(judgeTriageLabels);
const triageLabelSet = new Set<string>([
  ...judgeTriageLabels,
  ...deterministicOnlyTriageLabels,
]);

export function isJudgeTriageLabel(value: string): value is JudgeTriageLabel {
  return judgeTriageLabelSet.has(value);
}

export function isTriageLabel(value: string): value is TriageLabel {
  return triageLabelSet.has(value);
}
