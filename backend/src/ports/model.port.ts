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
