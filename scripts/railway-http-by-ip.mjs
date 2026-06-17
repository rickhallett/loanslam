#!/usr/bin/env node

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  process.stdout.write(helpText());
  process.exit(0);
}

const input = await readStdin();
const { rows, skipped } = parseJsonLines(input);

if (skipped > 0) {
  process.stderr.write(`Skipped ${skipped} non-JSON log line(s).\n`);
}

if (rows.length === 0) {
  process.stdout.write(
    [
      "No HTTP log rows found.",
      `Query window: ${args.queryWindow || "unspecified"}`,
      "Try hitting the deployed URL, then rerun:",
      "  just railway-http-by-ip",
    ].join("\n") + "\n",
  );
  process.exit(0);
}

const mineIps = new Set(splitIps(args.mine));
const observedWindow = getObservedWindow(rows);
const deploymentIds = uniqueValues(rows, "deploymentId");
const groups = groupByIp(rows, mineIps);
const summaryRows = [...groups.values()].sort((left, right) => {
  if (right.count !== left.count) {
    return right.count - left.count;
  }

  return right.latestSortTime - left.latestSortTime;
});

const otherRequestCount = summaryRows
  .filter((group) => !group.isMine)
  .reduce((total, group) => total + group.count, 0);

process.stdout.write(
  [
    `Traffic by source IP (${rows.length} HTTP log row${rows.length === 1 ? "" : "s"})`,
    `Query window: ${args.queryWindow || "unspecified"}`,
    `Observed logs: ${observedWindow}`,
    `Deployments: ${deploymentIds.length > 0 ? deploymentIds.join(", ") : "unknown"}`,
    `Mine: ${mineIps.size > 0 ? [...mineIps].join(", ") : "not set"}`,
    `Other requests: ${otherRequestCount}`,
    "",
    renderTable([
      ["IP", "Owner", "Requests", "Latest", "Statuses", "Methods", "Paths"],
      ...summaryRows.map((group) => [
        group.ip,
        group.isMine ? "mine" : "other",
        String(group.count),
        group.latestDisplay,
        summarizeCounts(group.statuses),
        summarizeCounts(group.methods),
        summarizeCounts(group.paths, 4, 48),
      ]),
    ]),
  ].join("\n") + "\n",
);

function parseArgs(rawArgs) {
  const parsed = {
    help: false,
    mine: "",
    queryWindow: "",
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--mine") {
      parsed.mine = rawArgs[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg.startsWith("--mine=")) {
      parsed.mine = arg.slice("--mine=".length);
      continue;
    }

    if (arg === "--query-window") {
      parsed.queryWindow = rawArgs[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg.startsWith("--query-window=")) {
      parsed.queryWindow = arg.slice("--query-window=".length);
    }
  }

  return parsed;
}

function helpText() {
  return [
    "Usage: railway logs --http --json --since 24h | node scripts/railway-http-by-ip.mjs [--mine <ip[,ip]>] [--query-window <label>]",
    "",
    "Groups Railway HTTP JSON logs by source IP and marks the current operator's IP.",
  ].join("\n");
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => resolve(input));
    process.stdin.on("error", reject);
  });
}

function parseJsonLines(input) {
  const result = {
    rows: [],
    skipped: 0,
  };

  for (const line of input.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      continue;
    }

    try {
      result.rows.push(JSON.parse(trimmed));
    } catch {
      result.skipped += 1;
    }
  }

  return result;
}

function splitIps(value) {
  return value
    .split(",")
    .map((ip) => ip.trim())
    .filter((ip) => ip.length > 0 && ip !== "auto");
}

function groupByIp(rows, mineIps) {
  const groups = new Map();

  for (const row of rows) {
    const ip = findValue(row, [
      "srcIp",
      "sourceIp",
      "clientIp",
      "remoteIp",
      "requestIp",
      "xForwardedFor",
      "cfConnectingIp",
    ]);
    const groupIp = normalizeIp(ip) ?? "(unknown)";
    const group = groups.get(groupIp) ?? {
      ip: groupIp,
      isMine: mineIps.has(groupIp),
      count: 0,
      latestDisplay: "unknown",
      latestSortTime: 0,
      methods: new Map(),
      paths: new Map(),
      statuses: new Map(),
    };

    group.count += 1;
    bump(
      group.methods,
      findValue(row, ["method", "httpMethod", "requestMethod"]) ?? "unknown",
    );
    bump(
      group.paths,
      findValue(row, ["path", "requestPath", "pathname", "url", "route"]) ??
        "unknown",
    );
    bump(
      group.statuses,
      statusBucket(findValue(row, ["httpStatus", "statusCode", "status"])),
    );

    const timestamp = findValue(row, [
      "timestamp",
      "time",
      "createdAt",
      "date",
    ]);
    const sortTime = timestamp ? Date.parse(timestamp) : NaN;

    if (Number.isFinite(sortTime) && sortTime >= group.latestSortTime) {
      group.latestSortTime = sortTime;
      group.latestDisplay = formatTimestamp(timestamp);
    }

    groups.set(groupIp, group);
  }

  return groups;
}

function getObservedWindow(rows) {
  const timestamps = rows
    .map((row) => findValue(row, ["timestamp", "time", "createdAt", "date"]))
    .map((timestamp) => (timestamp ? Date.parse(timestamp) : NaN))
    .filter(Number.isFinite);

  if (timestamps.length === 0) {
    return "unknown";
  }

  return `${formatTimestamp(Math.min(...timestamps))} -> ${formatTimestamp(Math.max(...timestamps))}`;
}

function uniqueValues(rows, key) {
  return [
    ...new Set(
      rows
        .map((row) => findValue(row, [key]))
        .filter((value) => value !== undefined && value.length > 0),
    ),
  ];
}

function normalizeIp(value) {
  if (!value) {
    return undefined;
  }

  return String(value).split(",")[0].trim();
}

function findValue(root, keys) {
  const wantedKeys = new Set(keys.map(normalizeKey));
  const stack = [root];
  const seen = new Set();

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current || typeof current !== "object" || seen.has(current)) {
      continue;
    }

    seen.add(current);

    for (const [key, value] of Object.entries(current)) {
      if (
        wantedKeys.has(normalizeKey(key)) &&
        value !== null &&
        value !== undefined
      ) {
        return String(value);
      }

      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }

  return undefined;
}

function normalizeKey(key) {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function bump(counts, rawValue) {
  const value = String(rawValue).trim() || "unknown";
  counts.set(value, (counts.get(value) ?? 0) + 1);
}

function statusBucket(value) {
  if (!value) {
    return "unknown";
  }

  const status = Number.parseInt(value, 10);

  if (!Number.isFinite(status)) {
    return value;
  }

  return `${Math.floor(status / 100)}xx`;
}

function formatTimestamp(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function summarizeCounts(counts, limit = 3, maxKeyLength = 32) {
  const entries = [...counts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }

    return left[0].localeCompare(right[0]);
  });
  const visible = entries
    .slice(0, limit)
    .map(([key, count]) => `${clip(key, maxKeyLength)}:${count}`);
  const hiddenCount = entries.length - visible.length;

  if (hiddenCount > 0) {
    visible.push(`+${hiddenCount}`);
  }

  return visible.join(", ") || "unknown";
}

function clip(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
}

function renderTable(rows) {
  const widths = rows[0].map((_, columnIndex) =>
    Math.max(...rows.map((row) => row[columnIndex].length)),
  );

  return rows
    .map((row, rowIndex) => {
      const rendered = row
        .map((cell, columnIndex) => cell.padEnd(widths[columnIndex]))
        .join("  ");

      if (rowIndex === 0) {
        return `${rendered}\n${widths.map((width) => "-".repeat(width)).join("  ")}`;
      }

      return rendered;
    })
    .join("\n");
}
