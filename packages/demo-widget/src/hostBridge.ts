import type { SafetyFlag, ValidatedTurnResult } from "@loanslam/contracts";

/**
 * postMessage bridge between the embedded widget and the host page loader.
 *
 * Mirrors the protocol the host loader expects: the widget announces `ready`,
 * reports a coarse `session-context` after each turn so the page can surface the
 * right contact route, and can request the panel close. Only protocol-level
 * signals cross the boundary — never message content.
 */

export type HostContext = "vulnerability" | "handoff" | "general";

const VULNERABLE_FLAGS = new Set<SafetyFlag>([
  "vulnerability",
  "distress",
  "hardship",
  "accessibility_need",
  "language_barrier",
  "legal_threat",
  "complaint",
]);

const HANDOFF_ACTIONS = new Set([
  "request_handoff_intake",
  "create_ticket",
  "escalate",
]);

export function contextForTurn(result: ValidatedTurnResult): HostContext {
  if (result.state.safetyFlags.some((flag) => VULNERABLE_FLAGS.has(flag))) {
    return "vulnerability";
  }

  if (
    result.state.handoffPending ||
    HANDOFF_ACTIONS.has(result.finalAction) ||
    result.ui.primitive === "handoff_confirmation"
  ) {
    return "handoff";
  }

  return "general";
}

function postToHost(message: Record<string, unknown>): void {
  if (window.parent !== window) {
    window.parent.postMessage(message, "*");
  }
}

export function announceReady(): void {
  postToHost({ type: "ready" });
}

export function sendContext(context: HostContext): void {
  postToHost({ type: "session-context", context });
}

export function requestClose(): void {
  postToHost({ type: "close-requested" });
}

export interface HostMessage {
  type: string;
  [key: string]: unknown;
}

export function onHostMessage(
  handler: (message: HostMessage) => void,
): () => void {
  const listener = (event: MessageEvent): void => {
    const data = event.data as unknown;
    if (
      typeof data !== "object" ||
      data === null ||
      typeof (data as { type?: unknown }).type !== "string"
    ) {
      return;
    }
    handler(data as HostMessage);
  };

  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
