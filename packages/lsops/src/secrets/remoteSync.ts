import { spawnSync } from "node:child_process";

import { redactedSubprocessFailure } from "../artifacts/redaction";

export interface SyncMode {
  apply: boolean;
  dryRun: boolean;
}

export interface RemoteSyncSummary {
  planned: string[];
  pushed: string[];
  failed: string[];
}

export function parseSyncMode(args: string[]): SyncMode {
  const apply = args.includes("--apply");
  return { apply, dryRun: args.includes("--dry-run") || !apply };
}

export function formatRemoteSyncSummary(summary: RemoteSyncSummary): string {
  return [
    `planned: ${formatKeyList(summary.planned)}`,
    `pushed: ${formatKeyList(summary.pushed)}`,
    `failed: ${formatKeyList(summary.failed)}`,
  ].join("\n");
}

export function formatKeyList(keys: string[]): string {
  return keys.length ? keys.join(", ") : "(none)";
}

export function runSecretSetCommand(input: {
  provider: string;
  key: string;
  command: string;
  args: string[];
  cwd: string;
  value: string;
}): void {
  const result = spawnSync(input.command, input.args, {
    cwd: input.cwd,
    input: input.value,
    stdio: ["pipe", "inherit", "pipe"],
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw redactedSubprocessFailure({
      provider: input.provider,
      key: input.key,
      status: result.status,
    });
  }
}
