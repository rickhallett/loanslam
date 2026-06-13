import type {
  GroundingSignal,
  ReasonCode,
  ReplyMode,
  RetrievalHit,
} from '@loanslam/contracts';
import type { ClassificationResult } from '../../ports/model.port.js';
import type { ServerConversationState } from '../../domain/conversation.js';

/**
 * The verdict from the (already-resolved) vulnerability gate. The router treats
 * this as authoritative — the gate runs first and fails closed upstream.
 */
export interface VulnerabilityVerdictResolved {
  vulnerable: boolean;
  reasonCode: Extract<ReasonCode, 'vulnerability_signal' | 'model_error_failclosed'>;
  category: string | null;
}

/** Everything the pure router needs to choose a safe action. */
export interface RouteInput {
  grounding: GroundingSignal;
  classification: ClassificationResult;
  vulnerability: VulnerabilityVerdictResolved;
  state: ServerConversationState;
  text: string;
  /** Grounding score threshold (config.groundingThreshold). */
  threshold: number;
}

/** The router's decision for this turn. Pure data; the responder builds copy. */
export interface RoutingDecision {
  replyMode: ReplyMode;
  reasonCode: ReasonCode;
  /** Vulnerability category, when relevant; otherwise null. */
  category: string | null;
  /** True when this route must collect a handoff intake form. */
  requiresIntake: boolean;
  /** The top retrieval hit, carried through for citations/links/answer text. */
  topHit: RetrievalHit | null;
}

/** Whitespace-collapsed, non-empty token count of the raw message. */
function isShortOrNoisy(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3) return true;
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return true;
  // No alphanumeric content at all (e.g. "??", "...", "!!!").
  if (!/[a-z0-9]/i.test(trimmed)) return true;
  return false;
}

/**
 * Pure routing policy (build-spec routing table; first match wins). No I/O, no
 * side effects — every branch is exhaustively unit-tested.
 *
 * Order (first match wins):
 *   1. vulnerability   -> 'vulnerability'
 *   2. change_request  -> 'intake_request'   (BEFORE answer: a request to change a
 *                                             loan application must reach a human
 *                                             even if a how-to KB answer exists — §16)
 *   3. grounded        -> 'answer'
 *   4. excluded        -> 'refusal'
 *   5. account_specific (KB handoff) -> 'intake_request'
 *   6. clarify / ambiguous / noisy   -> 'clarify'
 *   7. else            -> 'fallback'
 */
export function route(input: RouteInput): RoutingDecision {
  const { grounding, classification, vulnerability, text, threshold } = input;
  const topHit = grounding.hits.length > 0 ? grounding.hits[0]! : null;
  const topMode = grounding.topServingMode;
  const topScore = grounding.topScore;
  const clearedThreshold = topScore >= threshold;

  // 1. Vulnerability gate fired (resolved upstream, fail-closed).
  if (vulnerability.vulnerable) {
    return {
      replyMode: 'vulnerability',
      reasonCode: vulnerability.reasonCode,
      category: vulnerability.category,
      requiresIntake: false,
      topHit,
    };
  }

  // 2. Change request to a loan application -> handoff intake. This MUST precede
  // the grounded-answer branch: the bot must never answer (and so implicitly
  // promise to action) a change to a loan application, even when the KB grounds a
  // related how-it-works answer. The classifier flags the change intent.
  if (classification.action === 'change_request') {
    return {
      replyMode: 'intake_request',
      reasonCode: 'change_request',
      category: null,
      requiresIntake: true,
      topHit,
    };
  }

  // 3. Grounded answer: top hit cleared the threshold AND permits an answer.
  if (grounding.grounded && clearedThreshold && topMode === 'answer') {
    return {
      replyMode: 'answer',
      reasonCode: 'grounded_answer',
      category: null,
      requiresIntake: false,
      topHit,
    };
  }

  // 4. Excluded public-but-must-not-serve topic (e.g. APR).
  if (topMode === 'excluded' && clearedThreshold) {
    return {
      replyMode: 'refusal',
      reasonCode: 'excluded_topic',
      category: null,
      requiresIntake: false,
      topHit,
    };
  }

  // 5. Account-specific: needs real account data -> handoff intake.
  if (topMode === 'handoff_account_specific' && clearedThreshold) {
    return {
      replyMode: 'intake_request',
      reasonCode: 'account_specific',
      category: null,
      requiresIntake: true,
      topHit,
    };
  }

  // 6. Clarify: short/ambiguous/noisy, or the classifier asked to clarify.
  if (isShortOrNoisy(text)) {
    return {
      replyMode: 'clarify',
      reasonCode: 'ambiguous_or_noisy',
      category: null,
      requiresIntake: false,
      topHit,
    };
  }
  if (classification.action === 'clarify') {
    return {
      replyMode: 'clarify',
      reasonCode: 'clarify_needed',
      category: null,
      requiresIntake: false,
      topHit,
    };
  }

  // 7. Nothing grounded, nothing matched -> safe fallback.
  return {
    replyMode: 'fallback',
    reasonCode: 'no_grounding',
    category: null,
    requiresIntake: false,
    topHit,
  };
}
