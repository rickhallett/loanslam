#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
  chmodSync,
  rmSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const manifestPath = resolve(root, "secrets/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const defaultAgeKeyFile = `${process.env.HOME}/.config/sops/age/keys.txt`;

function sopsEnv() {
  if (process.env.SOPS_AGE_KEY_FILE || !existsSync(defaultAgeKeyFile)) {
    return process.env;
  }
  return { ...process.env, SOPS_AGE_KEY_FILE: defaultAgeKeyFile };
}

function usage() {
  console.error(`Usage:
  node scripts/secrets.mjs status [env]
  node scripts/secrets.mjs init <env> [--force]
  node scripts/secrets.mjs edit <env>
  node scripts/secrets.mjs set <env> <key>
  node scripts/secrets.mjs render <env>
  node scripts/secrets.mjs run <env> -- <command...>
  node scripts/secrets.mjs sync-vercel <env> [--dry-run|--apply]
  node scripts/secrets.mjs sync-railway <env> [--dry-run|--apply] [--service <name>]
`);
  process.exit(2);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const detail =
      result.stderr?.trim() ||
      result.stdout?.trim() ||
      `${command} exited ${result.status}`;
    throw new Error(detail);
  }
  return result.stdout ?? "";
}

function requireEnv(name) {
  const config = manifest.environments[name];
  if (!config) {
    throw new Error(`Unknown environment: ${name}`);
  }
  return config;
}

function decrypt(name) {
  const config = requireEnv(name);
  const file = resolve(root, config.encryptedFile);
  if (!existsSync(file)) {
    throw new Error(`Missing encrypted file: ${config.encryptedFile}`);
  }
  return run(
    "sops",
    [
      "--decrypt",
      "--input-type",
      "dotenv",
      "--output-type",
      "dotenv",
      config.encryptedFile,
    ],
    {
      env: sopsEnv(),
      maxBuffer: 1024 * 1024 * 8,
    },
  );
}

function parseDotenv(text) {
  const values = new Map();
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
    values.set(match[1], value);
  }
  return values;
}

function requiredKeys(name) {
  return Object.entries(manifest.variables)
    .filter(([, meta]) => meta.required?.includes(name))
    .map(([key]) => key)
    .sort();
}

function serializeValue(value) {
  if (/^[A-Za-z0-9_./:@?&=%+\-]*$/.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

function serializeDotenv(values) {
  const manifestKeys = Object.keys(manifest.variables);
  const extraKeys = [...values.keys()]
    .filter((key) => !manifest.variables[key])
    .sort();
  const keys = [...manifestKeys, ...extraKeys].filter((key) => values.has(key));
  return `${keys.map((key) => `${key}=${serializeValue(values.get(key) ?? "")}`).join("\n")}\n`;
}

function encryptText(name, plaintext) {
  const config = requireEnv(name);
  const output = resolve(root, config.encryptedFile);
  const temp = resolve(root, `var/secrets-${name}-${process.pid}.env`);
  mkdirSync(dirname(temp), { recursive: true });
  writeFileSync(temp, plaintext, { mode: 0o600 });
  chmodSync(temp, 0o600);
  try {
    const encrypted = run(
      "sops",
      [
        "--encrypt",
        "--input-type",
        "dotenv",
        "--output-type",
        "dotenv",
        "--filename-override",
        config.encryptedFile,
        temp,
      ],
      { env: sopsEnv(), maxBuffer: 1024 * 1024 * 8 },
    );
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, encrypted);
  } finally {
    try {
      writeFileSync(temp, "");
    } catch {
      // best effort cleanup
    }
    rmSync(temp, { force: true });
  }
}

function syncableKeys(name, provider, values) {
  return Object.entries(manifest.variables)
    .filter(
      ([key, meta]) =>
        values.has(key) &&
        values.get(key) !== "" &&
        meta.targets?.includes(provider),
    )
    .map(([key]) => key)
    .sort();
}

function initialKeys(name) {
  return Object.entries(manifest.variables)
    .filter(([, meta]) => meta.required?.includes(name) || meta.targets?.length)
    .map(([key]) => key)
    .sort();
}

function init(name, args) {
  const config = requireEnv(name);
  const output = resolve(root, config.encryptedFile);
  const force = args.includes("--force");
  if (existsSync(output) && !force) {
    throw new Error(
      `${config.encryptedFile} already exists; pass --force to replace it`,
    );
  }
  const keys = initialKeys(name);
  const plaintext = `${keys.map((key) => `${key}=`).join("\n")}\n`;
  encryptText(name, plaintext);
  console.log(
    `${name}: initialized ${config.encryptedFile} (${keys.length} empty keys)`,
  );
}

function edit(name) {
  const config = requireEnv(name);
  if (!existsSync(resolve(root, config.encryptedFile))) {
    throw new Error(
      `Missing encrypted file: ${config.encryptedFile}; run secrets-init first`,
    );
  }
  const result = spawnSync(
    "sops",
    ["--input-type", "dotenv", "--output-type", "dotenv", config.encryptedFile],
    {
      cwd: root,
      env: sopsEnv(),
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

function setValue(name, key) {
  if (!key) usage();
  let input = readFileSync(0, "utf8");
  if (input.length === 0) {
    throw new Error("No value received on stdin");
  }
  input = input.replace(/\r?\n$/, "");
  const config = requireEnv(name);
  let values;
  if (existsSync(resolve(root, config.encryptedFile))) {
    values = parseDotenv(decrypt(name));
  } else {
    values = new Map(initialKeys(name).map((initialKey) => [initialKey, ""]));
  }
  values.set(key, input);
  encryptText(name, serializeDotenv(values));
  const note = manifest.variables[key] ? "" : " (untracked key)";
  console.log(`${name}: set ${key}${note}`);
}

function status(envName) {
  const names = envName ? [envName] : Object.keys(manifest.environments);
  for (const name of names) {
    const config = requireEnv(name);
    if (!existsSync(resolve(root, config.encryptedFile))) {
      console.log(`${name}: missing ${config.encryptedFile}`);
      continue;
    }
    const values = parseDotenv(decrypt(name));
    const required = requiredKeys(name);
    const missing = required.filter(
      (key) => !values.has(key) || values.get(key) === "",
    );
    const known = new Set(Object.keys(manifest.variables));
    const extra = [...values.keys()].filter((key) => !known.has(key)).sort();
    const state = missing.length === 0 ? "ok" : "missing";
    console.log(
      `${name}: ${state} (${values.size} keys, ${required.length - missing.length}/${required.length} required present)`,
    );
    if (missing.length) console.log(`  missing: ${missing.join(", ")}`);
    if (extra.length) console.log(`  untracked: ${extra.join(", ")}`);
  }
}

function render(name) {
  const config = requireEnv(name);
  const plaintext = decrypt(name);
  const output = resolve(root, config.plaintextFile);
  mkdirSync(dirname(output), { recursive: true });
  const temp = `${output}.tmp-${process.pid}`;
  writeFileSync(temp, plaintext.endsWith("\n") ? plaintext : `${plaintext}\n`, {
    mode: 0o600,
  });
  chmodSync(temp, 0o600);
  renameSync(temp, output);
  const count = parseDotenv(plaintext).size;
  console.log(
    `${name}: rendered ${config.plaintextFile} (${count} keys, mode 0600)`,
  );
}

function runWithSecrets(name, commandArgs) {
  while (commandArgs[0] === "--") commandArgs.shift();
  if (!commandArgs.length) usage();
  const values = parseDotenv(decrypt(name));
  const child = spawnSync(commandArgs[0], commandArgs.slice(1), {
    cwd: root,
    env: { ...process.env, ...Object.fromEntries(values) },
    stdio: "inherit",
  });
  if (child.error) throw child.error;
  process.exit(child.status ?? 1);
}

function parseMode(args) {
  const apply = args.includes("--apply");
  const dryRun = args.includes("--dry-run") || !apply;
  return { apply, dryRun };
}

function assertApply(mode, provider, envName, keys, target) {
  console.log(
    `${provider}/${envName}: ${mode.dryRun ? "dry-run" : "apply"} ${keys.length} keys -> ${target}`,
  );
  for (const key of keys) console.log(`  ${key}`);
  if (mode.dryRun) {
    console.log("Use --apply to mutate remote environment variables.");
  }
}

function syncVercel(name, args) {
  const target = manifest.deployTargets.vercel?.[name];
  if (!target) throw new Error(`No Vercel target configured for ${name}`);
  const values = parseDotenv(decrypt(name));
  const keys = syncableKeys(name, "vercel", values);
  const mode = parseMode(args);
  const targetLabel = target.gitBranch
    ? `${target.environment} branch ${target.gitBranch}`
    : target.environment;
  assertApply(mode, "vercel", name, keys, targetLabel);
  if (mode.dryRun) return;
  for (const key of keys) {
    const commandArgs = [
      "env",
      "add",
      key,
      target.environment,
      "--sensitive",
      "--force",
      "--yes",
    ];
    if (target.gitBranch) commandArgs.push("--git-branch", target.gitBranch);
    run("vercel", commandArgs, {
      input: values.get(key),
      stdio: ["pipe", "inherit", "pipe"],
    });
  }
}

function syncRailway(name, args) {
  const target = manifest.deployTargets.railway?.[name];
  if (!target) throw new Error(`No Railway target configured for ${name}`);
  const values = parseDotenv(decrypt(name));
  const keys = syncableKeys(name, "railway", values);
  const mode = parseMode(args);
  const serviceIndex = args.indexOf("--service");
  const service = serviceIndex >= 0 ? args[serviceIndex + 1] : target.service;
  const targetLabel = service
    ? `${target.environment} service ${service}`
    : target.environment;
  assertApply(mode, "railway", name, keys, targetLabel);
  if (mode.dryRun) return;
  for (const key of keys) {
    const commandArgs = [
      "variable",
      "set",
      key,
      "--environment",
      target.environment,
      "--stdin",
      "--skip-deploys",
    ];
    if (service) commandArgs.push("--service", service);
    run("railway", commandArgs, {
      input: values.get(key),
      stdio: ["pipe", "inherit", "pipe"],
    });
  }
}

try {
  const [command, envName, separator, ...rest] = process.argv.slice(2);
  if (!command) usage();
  if (command === "status") {
    status(envName);
  } else if (command === "init") {
    if (!envName) usage();
    init(envName, process.argv.slice(4));
  } else if (command === "edit") {
    if (!envName) usage();
    edit(envName);
  } else if (command === "set") {
    if (!envName || !separator) usage();
    setValue(envName, separator);
  } else if (command === "render") {
    if (!envName) usage();
    render(envName);
  } else if (command === "run") {
    if (!envName) usage();
    runWithSecrets(envName, [separator, ...rest]);
  } else if (command === "sync-vercel") {
    if (!envName) usage();
    syncVercel(envName, process.argv.slice(4));
  } else if (command === "sync-railway") {
    if (!envName) usage();
    syncRailway(envName, process.argv.slice(4));
  } else {
    usage();
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
