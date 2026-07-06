export const REDACTION = "[REDACTED]";

export function redactSecrets(text: string, secrets: Iterable<string>): string {
  let redacted = text;
  for (const secret of secrets) {
    if (!secret) continue;
    redacted = redacted.replaceAll(secret, REDACTION);
  }
  return redacted;
}

export function redactedSubprocessFailure(input: {
  provider: string;
  key: string;
  status: number | null;
}): Error {
  const status = input.status === null ? "unknown" : String(input.status);
  return new Error(
    `${input.provider} set ${input.key} failed (exit ${status})`,
  );
}
