import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import type { ConversationState } from "@loanslam/contracts";

const tokenVersion = 1;
const ivBytes = 12;
const tagBytes = 16;

interface DemoStateTokenPayload {
  version: typeof tokenVersion;
  state: ConversationState;
}

export function sealDemoStateToken({
  state,
  secret,
}: {
  state: ConversationState;
  secret: string;
}): string {
  const iv = randomBytes(ivBytes);
  const cipher = createCipheriv("aes-256-gcm", keyFromSecret(secret), iv);
  const plaintext = Buffer.from(
    JSON.stringify({
      version: tokenVersion,
      state,
    } satisfies DemoStateTokenPayload),
    "utf8",
  );
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

export function unsealDemoStateToken({
  token,
  secret,
}: {
  token: string;
  secret: string;
}): ConversationState | null {
  try {
    const sealed = Buffer.from(token, "base64url");

    if (sealed.length <= ivBytes + tagBytes) {
      return null;
    }

    const iv = sealed.subarray(0, ivBytes);
    const tag = sealed.subarray(ivBytes, ivBytes + tagBytes);
    const ciphertext = sealed.subarray(ivBytes + tagBytes);
    const decipher = createDecipheriv("aes-256-gcm", keyFromSecret(secret), iv);
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    const payload = JSON.parse(plaintext) as Partial<DemoStateTokenPayload>;

    if (payload.version !== tokenVersion || !payload.state) {
      return null;
    }

    return payload.state;
  } catch {
    return null;
  }
}

function keyFromSecret(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}
