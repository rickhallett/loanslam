export type CheckStatus = "pass" | "fail" | "skip";

export interface CheckResult {
  id: string;
  status: CheckStatus;
  detail?: string;
  artifacts?: string[];
  infrastructure?: boolean;
}

export interface CheckRunSummary {
  id: string;
  startedAt: string;
  base?: string;
  passed: number;
  failed: number;
  skipped: number;
  results: CheckResult[];
}

export interface CheckRunOptions {
  base?: string;
  log?: Pick<Console, "log">;
}

export class CheckRun {
  readonly id: string;
  readonly startedAt = new Date().toISOString();
  readonly results: CheckResult[] = [];
  private readonly base: string | undefined;
  private readonly log: Pick<Console, "log">;

  constructor(id: string, options: CheckRunOptions = {}) {
    this.id = id;
    this.base = options.base;
    this.log = options.log ?? console;
  }

  pass(id: string, detail = "", artifacts: string[] = []): CheckResult {
    return this.add({ id, status: "pass", detail, artifacts });
  }

  fail(
    id: string,
    detail = "",
    artifacts: string[] = [],
    infrastructure = false,
  ): CheckResult {
    return this.add({ id, status: "fail", detail, artifacts, infrastructure });
  }

  skip(id: string, detail = "", artifacts: string[] = []): CheckResult {
    return this.add({ id, status: "skip", detail, artifacts });
  }

  check(
    id: string,
    ok: boolean,
    detail = "",
    artifacts: string[] = [],
  ): CheckResult {
    return ok
      ? this.pass(id, detail, artifacts)
      : this.fail(id, detail, artifacts);
  }

  infrastructureError(id: string, error: unknown): CheckResult {
    return this.fail(id, errorDetail(error), [], true);
  }

  summary(): CheckRunSummary {
    const passed = this.results.filter(
      (result) => result.status === "pass",
    ).length;
    const failed = this.results.filter(
      (result) => result.status === "fail",
    ).length;
    const skipped = this.results.filter(
      (result) => result.status === "skip",
    ).length;
    const summary: CheckRunSummary = {
      id: this.id,
      startedAt: this.startedAt,
      passed,
      failed,
      skipped,
      results: [...this.results],
    };
    if (this.base) summary.base = this.base;
    return summary;
  }

  printSummary(artifactLabel?: string): void {
    const summary = this.summary();
    const suffix = artifactLabel ? ` Artifacts: ${artifactLabel}` : "";
    this.log.log(
      `\n${summary.passed}/${summary.results.length} checks passed (${summary.failed} failed, ${summary.skipped} skipped).${suffix}`,
    );
  }

  private add(input: CheckResult): CheckResult {
    const result = normalizeResult(input);
    this.results.push(result);
    this.log.log(formatCheckResult(result));
    return result;
  }
}

export function formatCheckResult(result: CheckResult): string {
  const label =
    result.status === "pass"
      ? "PASS"
      : result.status === "fail"
        ? "FAIL"
        : "SKIP";
  const detail = result.detail ? `  ${result.detail}` : "";
  const prefix = result.infrastructure ? "INFRA " : "";
  return `${prefix}${label.padEnd(5)} ${result.id}${detail}`;
}

export function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeResult(input: CheckResult): CheckResult {
  const result: CheckResult = {
    id: input.id,
    status: input.status,
  };
  if (input.detail) result.detail = input.detail;
  if (input.artifacts?.length) result.artifacts = input.artifacts;
  if (input.infrastructure) result.infrastructure = true;
  return result;
}
