import type { IntakeFieldName } from '@loanslam/contracts';
import type { ConversationMessage } from '../domain/conversation.js';

/**
 * The model boundary. Every method has a deterministic fallback in its adapter,
 * so the pipeline runs with AI disabled or when the provider errors. The
 * vulnerability check is special: on error it MUST fail closed (treat as
 * vulnerable) — see architecture.md "vulnerability gate fails closed".
 */
export interface ModelAdapter {
  /** Fail-closed safety check. Runs before any classification. */
  detectVulnerability(input: VulnerabilityInput): Promise<VulnerabilityVerdict>;

  /** Propose the safe next action, using conversation context + retrieval. */
  classify(input: ClassificationInput): Promise<ClassificationResult>;

  /**
   * Phrase an answer from APPROVED knowledge only. The model may rephrase
   * `groundedAnswerText` but must not introduce any fact not present in it.
   * Returns null if it cannot phrase safely (caller then routes to fallback).
   */
  phraseAnswer(input: PhraseInput): Promise<string | null>;

  /**
   * Turn free text into structured slots + dialogue signals (PRD §4.2). The
   * model only understands; the deterministic policy decides. Slot keys are
   * always a subset of the requested (closed PII) set, and a credential-shaped
   * value is never returned — defence in depth over the typed key restriction.
   */
  extract(input: ExtractInput): Promise<ExtractResult>;
}

export interface VulnerabilityInput {
  text: string;
  history: ConversationMessage[];
}

export interface VulnerabilityVerdict {
  vulnerable: boolean;
  /** e.g. 'financial_difficulty' | 'distress' | 'complaint' | 'legal' | 'accessibility'. */
  category: string | null;
  /** 0..1. */
  confidence: number;
  source: 'model' | 'deterministic' | 'failclosed';
}

/** Candidate actions the classifier may propose. */
export type ProposedAction =
  | 'answer'
  | 'clarify'
  | 'handoff_account_specific'
  | 'change_request'
  | 'excluded_topic'
  | 'fallback'
  | 'refusal';

export interface ClassificationInput {
  text: string;
  history: ConversationMessage[];
  /** Top retrieval hit summary, so the model can ground its proposal. */
  retrieval: {
    topServingMode: string | null;
    topScore: number;
    topQuestion: string | null;
  };
}

export interface ClassificationResult {
  action: ProposedAction;
  /** One-line summary of the customer's goal, for state + audit. */
  customerGoal: string | null;
  confidence: number;
  source: 'model' | 'deterministic';
}

export interface PhraseInput {
  customerText: string;
  /** The approved answer text the reply must stay faithful to. */
  groundedAnswerText: string;
  history: ConversationMessage[];
}

// ── Mixed-initiative extraction (PRD §4.2, §5) ───────────────────────────────
// The model's job is flexible *understanding*: turn free text into structured
// slots + signals + confidence. The deterministic policy decides what happens.
// The `extract` method is added to ModelAdapter in the Phase 1A slice; these
// types are the spine the policy and adapters share.

export interface ExtractInput {
  text: string;
  history: ConversationMessage[];
  /**
   * Slots the active journey is currently trying to collect. Always a subset of
   * the closed PII set — there is no credential slot to extract into (brief §16).
   */
  requestedSlots: IntakeFieldName[];
}

/** Cross-cutting dialogue signals the policy reacts to (PRD §4.3 interrupts). */
export interface ExtractSignals {
  /** Customer is correcting a value they gave earlier. */
  correction: boolean;
  /** Customer declines to provide a requested field. */
  refusal: boolean;
  /** Customer changed the subject away from the current collection. */
  offTopic: boolean;
  /** Customer asked a question mid-collection. */
  question: boolean;
}

export interface ExtractResult {
  /**
   * Slot values volunteered THIS turn. Keys are restricted to the closed PII
   * set; a credential pasted into free text has nowhere to land here.
   */
  slots: Partial<Record<IntakeFieldName, string>>;
  signals: ExtractSignals;
  /** 0..1 — gates act-vs-confirm in the policy. */
  confidence: number;
  source: 'model' | 'deterministic';
}
