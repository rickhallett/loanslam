import { describe, expect, it } from 'vitest';
import type { ClassificationResult } from '../../ports/model.port.js';
import type { ServerConversationState } from '../../domain/conversation.js';
import { initialConversationState } from '../../domain/conversation.js';
import { route, type RouteInput, type VulnerabilityVerdictResolved } from '../services/router.js';
import { grounding, hit } from './fakes.js';

const THRESHOLD = 0.42;

function classification(overrides: Partial<ClassificationResult> = {}): ClassificationResult {
  return {
    action: 'answer',
    customerGoal: 'goal',
    confidence: 0.9,
    source: 'deterministic',
    ...overrides,
  };
}

const notVulnerable: VulnerabilityVerdictResolved = {
  vulnerable: false,
  reasonCode: 'vulnerability_signal',
  category: null,
};

function input(overrides: Partial<RouteInput>): RouteInput {
  const base: RouteInput = {
    grounding: grounding([], false),
    classification: classification(),
    vulnerability: notVulnerable,
    state: initialConversationState() as ServerConversationState,
    text: 'a clear, reasonably long question about how things work',
    threshold: THRESHOLD,
  };
  return { ...base, ...overrides };
}

describe('route — policy table (first match wins)', () => {
  it('vulnerability fires first, regardless of grounding', () => {
    const d = route(
      input({
        vulnerability: {
          vulnerable: true,
          reasonCode: 'vulnerability_signal',
          category: 'financial_difficulty',
        },
        grounding: grounding([hit({ itemId: 'a', servingMode: 'answer', score: 0.99 })], true),
      }),
    );
    expect(d.replyMode).toBe('vulnerability');
    expect(d.reasonCode).toBe('vulnerability_signal');
    expect(d.category).toBe('financial_difficulty');
    expect(d.requiresIntake).toBe(false);
  });

  it('model failclosed verdict routes as vulnerability with that reason code', () => {
    const d = route(
      input({
        vulnerability: {
          vulnerable: true,
          reasonCode: 'model_error_failclosed',
          category: null,
        },
      }),
    );
    expect(d.replyMode).toBe('vulnerability');
    expect(d.reasonCode).toBe('model_error_failclosed');
  });

  it('grounded answer -> answer + grounded_answer', () => {
    const top = hit({ itemId: 'how-much', servingMode: 'answer', score: 0.8 });
    const d = route(input({ grounding: grounding([top], true) }));
    expect(d.replyMode).toBe('answer');
    expect(d.reasonCode).toBe('grounded_answer');
    expect(d.topHit?.itemId).toBe('how-much');
  });

  it('grounded flag but below threshold does NOT answer', () => {
    const top = hit({ itemId: 'weak', servingMode: 'answer', score: 0.1 });
    const d = route(input({ grounding: grounding([top], true), threshold: THRESHOLD }));
    expect(d.replyMode).not.toBe('answer');
  });

  it('excluded above threshold -> refusal + excluded_topic', () => {
    const top = hit({ itemId: 'apr', servingMode: 'excluded', score: 0.7 });
    const d = route(input({ grounding: grounding([top], false) }));
    expect(d.replyMode).toBe('refusal');
    expect(d.reasonCode).toBe('excluded_topic');
  });

  it('excluded below threshold falls through (not a refusal)', () => {
    const top = hit({ itemId: 'apr', servingMode: 'excluded', score: 0.2 });
    const d = route(input({ grounding: grounding([top], false) }));
    expect(d.replyMode).not.toBe('refusal');
  });

  it('handoff_account_specific above threshold -> intake_request + account_specific', () => {
    const top = hit({ itemId: 'balance', servingMode: 'handoff_account_specific', score: 0.7 });
    const d = route(input({ grounding: grounding([top], false) }));
    expect(d.replyMode).toBe('intake_request');
    expect(d.reasonCode).toBe('account_specific');
    expect(d.requiresIntake).toBe(true);
  });

  it('classifier change_request -> intake_request + change_request', () => {
    const d = route(input({ classification: classification({ action: 'change_request' }) }));
    expect(d.replyMode).toBe('intake_request');
    expect(d.reasonCode).toBe('change_request');
    expect(d.requiresIntake).toBe(true);
  });

  it('very short text -> clarify + ambiguous_or_noisy', () => {
    const d = route(input({ text: 'hi', classification: classification({ action: 'fallback' }) }));
    expect(d.replyMode).toBe('clarify');
    expect(d.reasonCode).toBe('ambiguous_or_noisy');
  });

  it('punctuation-only text -> clarify (ambiguous_or_noisy)', () => {
    const d = route(input({ text: '???' }));
    expect(d.replyMode).toBe('clarify');
    expect(d.reasonCode).toBe('ambiguous_or_noisy');
  });

  it('classifier clarify on substantive text -> clarify + clarify_needed', () => {
    const d = route(
      input({
        text: 'I have a question about something but I am not sure how to phrase it well',
        classification: classification({ action: 'clarify' }),
      }),
    );
    expect(d.replyMode).toBe('clarify');
    expect(d.reasonCode).toBe('clarify_needed');
  });

  it('nothing grounded, nothing matched -> fallback + no_grounding', () => {
    const d = route(
      input({
        text: 'tell me about quantum widgets in a long sentence please thanks',
        classification: classification({ action: 'fallback' }),
        grounding: grounding([], false),
      }),
    );
    expect(d.replyMode).toBe('fallback');
    expect(d.reasonCode).toBe('no_grounding');
  });

  it('is pure: same input twice yields equal decisions', () => {
    const args = input({ grounding: grounding([hit({ itemId: 'x' })], true) });
    expect(route(args)).toEqual(route(args));
  });
});
