export type DotenvValues = Map<string, string>;

export function parseDotenv(text: string): DotenvValues {
  const values = new Map<string, string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(
      /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/,
    );
    if (!match) continue;
    let value = match[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values.set(match[1] ?? "", value);
  }
  values.delete("");
  return values;
}

export function serializeDotenv(
  values: DotenvValues,
  manifestKeys: string[] = [],
): string {
  const extraKeys = [...values.keys()]
    .filter((key) => !manifestKeys.includes(key))
    .sort();
  const keys = [...manifestKeys, ...extraKeys].filter((key) => values.has(key));
  return `${keys.map((key) => `${key}=${serializeValue(values.get(key) ?? "")}`).join("\n")}\n`;
}

export function serializeValue(value: string): string {
  if (/^[A-Za-z0-9_./:@?&=%+\-]*$/.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}
