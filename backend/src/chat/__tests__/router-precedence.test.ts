import { describe, expect, it } from 'vitest';
import type { ClassificationResult } from '../../ports/model.port.js';
import { initialConversationState } from '../../domain/conversation.js';
import { route } from '../services/router.js';
import { grounding, hit } from './fakes.js';

const notVulnerable = { vulnerable: false as const, reasonCode: 'vulnerability_signal' as const, category: null };

function classification(action: ClassificationResult['action']): ClassificationResult {
  return { action, customerGoal: 'goal', confidence: 0.9, source: 'deterministic' };
}

describe('router precedence (§16: a change request must reach a human)', () => {
  it('routes a change_request to handoff EVEN when a grounded answer exists', () => {
    // A grounded 'answer' hit is present and cleared the threshold...
    const g = grounding([hit({ itemId: 'cooling-off', servingMode: 'answer', score: 0.95 })], true);
    // ...but the classifier detected a change request.
    const decision = route({
      grounding: g,
      classification: classification('change_request'),
      vulnerability: notVulnerable,
      state: initialConversationState(),
      text: 'I want to cancel my loan application',
      threshold: 0.42,
    });
    expect(decision.replyMode).toBe('intake_request');
    expect(decision.reasonCode).toBe('change_request');
    expect(decision.requiresIntake).toBe(true);
  });

  it('still answers a normal grounded question (no change intent)', () => {
    const g = grounding([hit({ itemId: 'how-much-can-i-borrow', servingMode: 'answer', score: 0.95 })], true);
    const decision = route({
      grounding: g,
      classification: classification('answer'),
      vulnerability: notVulnerable,
      state: initialConversationState(),
      text: 'How much can I borrow?',
      threshold: 0.42,
    });
    expect(decision.replyMode).toBe('answer');
  });

  it('vulnerability still beats everything, including a change request', () => {
    const g = grounding([hit({ itemId: 'x', servingMode: 'answer', score: 0.95 })], true);
    const decision = route({
      grounding: g,
      classification: classification('change_request'),
      vulnerability: { vulnerable: true, reasonCode: 'vulnerability_signal', category: 'distress' },
      state: initialConversationState(),
      text: 'I cannot cope and want to cancel everything',
      threshold: 0.42,
    });
    expect(decision.replyMode).toBe('vulnerability');
  });
});
