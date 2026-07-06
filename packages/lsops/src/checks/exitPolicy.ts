import type { CheckRunSummary } from "./CheckRun";

export interface ExitPolicyOptions {
  allowFailures?: boolean;
  measurementOnly?: boolean;
}

export function hasFailures(summary: CheckRunSummary): boolean {
  return summary.failed > 0;
}

export function exitCodeForSummary(
  summary: CheckRunSummary,
  options: ExitPolicyOptions = {},
): number {
  if (summary.failed === 0) return 0;
  if (options.allowFailures || options.measurementOnly) return 0;
  return 1;
}

export function failIfAnyFailure(summary: CheckRunSummary): void {
  if (hasFailures(summary)) {
    throw new Error(
      `${summary.id} failed ${summary.failed}/${summary.results.length} checks`,
    );
  }
}
