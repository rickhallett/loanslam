export function safePathSegment(input: string): string {
  return input
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function timestampPathSegment(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}
