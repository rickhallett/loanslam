#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const args = parseArgs(process.argv.slice(2));

if (args.help) {
  process.stdout.write(helpText());
  process.exit(0);
}

if (args.testNotification || args.testIMessageTo) {
  if (args.testNotification) {
    await notify({
      title: "LoanSlam demo",
      subtitle: "Notification test",
      body: "Apple notifications are working for the demo watcher.",
      sound: args.sound,
    });
  }

  if (args.testIMessageTo) {
    await sendIMessage({
      recipient: args.testIMessageTo,
      body: "LoanSlam demo notification test.",
    });
  }

  process.exit(0);
}

if (args.once) {
  const snapshot = await readSnapshot(args);
  process.stdout.write(formatSnapshot(snapshot));
  process.exit(0);
}

await watchMessages(args);

async function watchMessages(options) {
  let lastSnapshot = await readSnapshot(options);
  let lastCount = lastSnapshot.messageEvents;

  process.stdout.write(
    [
      `Watching demo messages every ${options.intervalSeconds}s.`,
      `Baseline: ${lastCount} processed message${lastCount === 1 ? "" : "s"}.`,
      "Notifications fire only for messages processed after this watcher starts.",
      "",
      formatSnapshot(lastSnapshot),
    ].join("\n"),
  );

  for (;;) {
    await sleep(options.intervalSeconds * 1000);

    try {
      const snapshot = await readSnapshot(options);
      const delta = snapshot.messageEvents - lastCount;

      if (delta > 0) {
        const body = [
          `${delta} new processed message${delta === 1 ? "" : "s"}. Total: ${snapshot.messageEvents}.`,
          latestNotificationLine(snapshot.latest),
        ]
          .filter(Boolean)
          .join("\n");
        let notificationSent = false;
        let iMessageSent = false;

        try {
          await notify({
            title: "LoanSlam demo",
            subtitle: `${delta} new message${delta === 1 ? "" : "s"}`,
            body,
            sound: options.sound,
          });
          notificationSent = true;
        } catch (error) {
          process.stderr.write(
            `\n${new Date().toISOString()} notification failed: ${formatError(error)}\n`,
          );
        }

        if (options.iMessageTo) {
          try {
            await sendIMessage({
              recipient: options.iMessageTo,
              body: `LoanSlam demo: ${body}`,
            });
            iMessageSent = true;
          } catch (error) {
            process.stderr.write(
              `\n${new Date().toISOString()} iMessage failed: ${formatError(error)}\n`,
            );
          }
        }

        process.stdout.write(
          `\n${new Date().toISOString()} macOS notification ${notificationSent ? "sent" : "skipped"}${options.iMessageTo ? `, iMessage ${iMessageSent ? "sent" : "skipped"}` : ""}\n`,
        );
        process.stdout.write(formatSnapshot(snapshot));
      } else {
        process.stdout.write(".");
      }

      lastSnapshot = snapshot;
      lastCount = snapshot.messageEvents;
    } catch (error) {
      process.stderr.write(
        `\n${new Date().toISOString()} poll failed: ${formatError(error)}\n`,
      );
      process.stderr.write(formatSnapshot(lastSnapshot));
    }
  }
}

async function readSnapshot(options) {
  const remoteCommand = [
    "cd /app && npm exec -- node -e",
    shellQuote(remoteQuerySource()),
    shellQuote(options.dbPath),
  ].join(" ");
  const { stdout } = await execFileAsync(
    "railway",
    [
      "ssh",
      "--project",
      options.project,
      "--environment",
      options.environment,
      "--service",
      options.service,
      "--",
      "sh",
      "-lc",
      remoteCommand,
    ],
    {
      timeout: options.timeoutMs,
      maxBuffer: 1024 * 1024,
    },
  );
  const json = extractJsonObject(stdout);

  return JSON.parse(json);
}

function remoteQuerySource() {
  return `
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.argv[1], { readOnly: true });
const summary = db.prepare(\`
  SELECT
    COUNT(*) AS messageEvents,
    COUNT(DISTINCT conversation_ref) AS conversationsWithMessages,
    MIN(created_at) AS firstMessageAt,
    MAX(created_at) AS lastMessageAt
  FROM demo_interaction_events
  WHERE event_type = ?
\`).get("message");
const latest = db.prepare(\`
  SELECT
    conversation_ref AS conversationRef,
    turn,
    created_at AS createdAt,
    substr(customer_message, 1, 140) AS customerPreview
  FROM demo_interaction_events
  WHERE event_type = ?
  ORDER BY id DESC
  LIMIT 1
\`).get("message") ?? null;
console.log(JSON.stringify({ ...summary, latest }));
db.close();
`.trim();
}

function formatSnapshot(snapshot) {
  return (
    [
      `Processed messages: ${snapshot.messageEvents}`,
      `Conversations: ${snapshot.conversationsWithMessages}`,
      `First message: ${snapshot.firstMessageAt ?? "-"}`,
      `Last message: ${snapshot.lastMessageAt ?? "-"}`,
      latestLine(snapshot.latest),
    ]
      .filter(Boolean)
      .join("\n") + "\n"
  );
}

function latestLine(latest) {
  if (!latest) {
    return "";
  }

  return `Latest: ${latest.createdAt} ${latest.conversationRef ?? "-"} turn ${latest.turn ?? "-"}${latest.customerPreview ? ` - ${latest.customerPreview}` : ""}`;
}

function latestNotificationLine(latest) {
  if (!latest) {
    return "";
  }

  return `Latest: ${latest.conversationRef ?? "-"} turn ${latest.turn ?? "-"}`;
}

async function notify({ title, subtitle, body, sound }) {
  const script = [
    "display notification",
    appleScriptString(body),
    "with title",
    appleScriptString(title),
    "subtitle",
    appleScriptString(subtitle),
    sound === "none" ? "" : `sound name ${appleScriptString(sound)}`,
  ]
    .filter(Boolean)
    .join(" ");

  await execFileAsync("osascript", ["-e", script], {
    timeout: 5000,
  });
}

async function sendIMessage({ recipient, body }) {
  const script = [
    'tell application "Messages"',
    "set targetService to 1st service whose service type = iMessage",
    `set targetBuddy to buddy ${appleScriptString(recipient)} of targetService`,
    `send ${appleScriptString(body)} to targetBuddy`,
    "end tell",
  ].join("\n");

  await execFileAsync("osascript", ["-e", script], {
    timeout: 10000,
  });
}

function extractJsonObject(output) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Railway query did not return JSON. Output: ${output}`);
  }

  return output.slice(start, end + 1);
}

function parseArgs(rawArgs) {
  const parsed = {
    project: "",
    environment: "production",
    service: "",
    dbPath: "/app/var/demo-interactions.sqlite",
    intervalSeconds: 30,
    timeoutMs: 30000,
    sound: "Glass",
    iMessageTo: "",
    once: false,
    testNotification: false,
    testIMessageTo: "",
    help: false,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--once") {
      parsed.once = true;
      continue;
    }

    if (arg === "--test-notification") {
      parsed.testNotification = true;
      continue;
    }

    if (arg === "--test-imessage-to") {
      parsed.testIMessageTo = readNext(rawArgs, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--project") {
      parsed.project = readNext(rawArgs, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--environment") {
      parsed.environment = readNext(rawArgs, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--service") {
      parsed.service = readNext(rawArgs, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--db") {
      parsed.dbPath = readNext(rawArgs, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--interval") {
      parsed.intervalSeconds = Number(readNext(rawArgs, index, arg));
      index += 1;
      continue;
    }

    if (arg === "--sound") {
      parsed.sound = readNext(rawArgs, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--imessage-to") {
      parsed.iMessageTo = readNext(rawArgs, index, arg);
      index += 1;
      continue;
    }
  }

  if (parsed.help) {
    return parsed;
  }

  if (!isLocalTest(parsed) && !parsed.project) {
    throw new Error("--project is required.");
  }

  if (!isLocalTest(parsed) && !parsed.service) {
    throw new Error("--service is required.");
  }

  if (
    !Number.isInteger(parsed.intervalSeconds) ||
    parsed.intervalSeconds <= 0
  ) {
    throw new Error("--interval must be a positive integer.");
  }

  return parsed;
}

function isLocalTest(parsed) {
  return parsed.testNotification || parsed.testIMessageTo;
}

function readNext(args, index, option) {
  const value = args[index + 1];

  if (!value) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}

function helpText() {
  return [
    "Usage:",
    "  node scripts/railway-demo-message-notifier.mjs --once --project <id> --service <id>",
    "  node scripts/railway-demo-message-notifier.mjs --project <id> --service <id> [--interval <seconds>]",
    "  node scripts/railway-demo-message-notifier.mjs --project <id> --service <id> --imessage-to <phone-or-apple-id>",
    "",
    "Polls the deployed demo interaction SQLite log read-only and sends local Apple notifications, optionally with iMessage alerts for iOS.",
  ].join("\n");
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function appleScriptString(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
