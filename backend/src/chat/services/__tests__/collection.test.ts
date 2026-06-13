import { describe, expect, it } from 'vitest';
import type { IntakeFieldName } from '@loanslam/contracts';
import { getJourneySpec } from '../../../domain/journey.js';
import type { ExtractResult, ExtractSignals } from '../../../ports/model.port.js';
import { MAX_CLARIFY_TURNS, stepCollection, type CollectionInput } from '../collection.js';

const HANDOFF = getJourneySpec('account_handoff');

const NO_SIGNALS: ExtractSignals = {
  correction: false,
  refusal: false,
  offTopic: false,
  question: false,
};

function extract(
  slots: Partial<Record<IntakeFieldName, string>> = {},
  signals: Partial<ExtractSignals> = {},
): ExtractResult {
  return { slots, signals: { ...NO_SIGNALS, ...signals }, confidence: 0.6, source: 'deterministic' };
}

function input(over: Partial<CollectionInput> = {}): CollectionInput {
  return {
    journey: HANDOFF,
    state: null,
    collected: {},
    extract: extract(),
    ...over,
  };
}

describe('stepCollection — slot-filling policy', () => {
  it('asks for the first required slot when nothing has been provided', () => {
    const step = stepCollection(input());
    expect(step.outcome).toBe('ask');
    expect(step.ask?.slot).toBe('full_name');
    expect(step.ask?.prompt.length).toBeGreaterThan(0);
    expect(step.state.asked).toBe('full_name');
    expect(step.reasonCode).toBe('slot_asked');
  });

  it('accepts a volunteered slot and asks for the next missing one', () => {
    const step = stepCollection(
      input({
        state: { asked: 'full_name', remainingRequired: ['full_name', 'date_of_birth', 'email'], clarifyTurns: 1, confirmed: false },
        extract: extract({ full_name: 'Jane Smith' }),
      }),
    );
    expect(step.accepted.full_name).toBe('Jane Smith');
    expect(step.outcome).toBe('ask');
    expect(step.ask?.slot).toBe('date_of_birth');
    expect(step.reasonCode).toBe('slot_filled');
  });

  it('completes when the required set is satisfied', () => {
    const step = stepCollection(
      input({
        collected: { full_name: 'Jane Smith', date_of_birth: '1990-01-02' },
        state: { asked: 'email', remainingRequired: ['email'], clarifyTurns: 0, confirmed: false },
        extract: extract({ email: 'jane@example.com' }),
      }),
    );
    expect(step.outcome).toBe('complete');
    expect(step.reasonCode).toBe('intake_complete');
    expect(step.state.remainingRequired).toEqual([]);
    expect(step.ask).toBeNull();
  });

  it('accepts several slots volunteered at once', () => {
    const step = stepCollection(
      input({
        extract: extract({
          full_name: 'Jane Smith',
          date_of_birth: '1990-01-02',
          email: 'jane@example.com',
        }),
      }),
    );
    expect(step.outcome).toBe('complete');
  });

  it('treats a changed value for an existing slot as a correction', () => {
    const step = stepCollection(
      input({
        collected: { full_name: 'Jane', email: 'old@example.com' },
        state: { asked: 'date_of_birth', remainingRequired: ['date_of_birth'], clarifyTurns: 0, confirmed: false },
        extract: extract({ email: 'new@example.com' }, { correction: true }),
      }),
    );
    expect(step.corrected).toBe(true);
    expect(step.accepted.email).toBe('new@example.com');
    expect(step.reasonCode).toBe('slot_corrected');
  });

  it('escalates when the customer refuses a required field', () => {
    const step = stepCollection(
      input({
        state: { asked: 'full_name', remainingRequired: ['full_name', 'date_of_birth', 'email'], clarifyTurns: 0, confirmed: false },
        extract: extract({}, { refusal: true }),
      }),
    );
    expect(step.outcome).toBe('escalate');
    expect(step.reasonCode).toBe('slot_refused');
  });

  it('escalates when the clarification budget is exhausted (bounded collection)', () => {
    const step = stepCollection(
      input({
        state: {
          asked: 'full_name',
          remainingRequired: ['full_name', 'date_of_birth', 'email'],
          clarifyTurns: MAX_CLARIFY_TURNS - 1,
          confirmed: false,
        },
        extract: extract(), // no progress this turn
      }),
    );
    expect(step.outcome).toBe('escalate');
    expect(step.reasonCode).toBe('budget_exhausted');
  });

  it('resets the budget when the customer makes progress', () => {
    const step = stepCollection(
      input({
        state: {
          asked: 'full_name',
          remainingRequired: ['full_name', 'date_of_birth', 'email'],
          clarifyTurns: MAX_CLARIFY_TURNS - 1,
          confirmed: false,
        },
        extract: extract({ full_name: 'Jane Smith' }),
      }),
    );
    expect(step.outcome).toBe('ask');
    expect(step.state.clarifyTurns).toBe(0);
    expect(step.ask?.slot).toBe('date_of_birth');
  });

  it('never accepts a credential-shaped value into a slot (defence in depth)', () => {
    const step = stepCollection(
      input({ extract: extract({ full_name: 'Jane', phone: '4111 1111 1111 1111' }) }),
    );
    expect(step.accepted.full_name).toBe('Jane');
    expect(step.accepted.phone).toBeUndefined();
  });

  it('accepts a volunteered optional slot without blocking completion', () => {
    const step = stepCollection(
      input({
        collected: { full_name: 'Jane Smith', date_of_birth: '1990-01-02' },
        state: { asked: 'email', remainingRequired: ['email'], clarifyTurns: 0, confirmed: false },
        extract: extract({ email: 'jane@example.com', phone: '07123456789' }),
      }),
    );
    expect(step.outcome).toBe('complete');
    expect(step.accepted.phone).toBe('07123456789');
  });
});
