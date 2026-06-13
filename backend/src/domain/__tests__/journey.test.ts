import { describe, expect, it } from 'vitest';
import { intakeFieldNameSchema } from '@loanslam/contracts';
import {
  JOURNEYS,
  allJourneys,
  getJourneySpec,
  requiredSlotNames,
  type JourneyId,
} from '../journey.js';

describe('journey taxonomy', () => {
  it('registers every journey id with a disposition and slot list', () => {
    const journeys = allJourneys();
    expect(journeys.length).toBeGreaterThanOrEqual(4);
    for (const j of journeys) {
      expect(typeof j.id).toBe('string');
      expect(['answer', 'collect_then_handoff', 'escalate', 'refuse']).toContain(j.disposition);
      expect(Array.isArray(j.slots)).toBe(true);
    }
  });

  it('exposes the account-handoff journey requiring name, DOB, and email', () => {
    const spec = getJourneySpec('account_handoff');
    expect(spec.disposition).toBe('collect_then_handoff');
    expect(requiredSlotNames(spec)).toEqual(['full_name', 'date_of_birth', 'email']);
  });

  it('gives every collect-then-handoff journey at least one required slot (no empty collection)', () => {
    for (const j of allJourneys()) {
      if (j.disposition === 'collect_then_handoff') {
        expect(requiredSlotNames(j).length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('never defines a slot outside the closed PII set — no credential slot (DD-0001)', () => {
    const forbidden = ['sort_code', 'account_number', 'card_number', 'cvv', 'iban'];
    for (const j of allJourneys()) {
      for (const slot of j.slots) {
        // Structurally an IntakeFieldName; assert it at runtime as documentation.
        expect(intakeFieldNameSchema.safeParse(slot.name).success).toBe(true);
        expect(forbidden).not.toContain(slot.name as string);
      }
    }
  });

  it('gives every slot a non-empty elicitation prompt', () => {
    for (const j of allJourneys()) {
      for (const slot of j.slots) {
        expect(slot.prompt.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('keys the registry by journey id', () => {
    for (const [id, spec] of Object.entries(JOURNEYS)) {
      expect(spec.id).toBe(id as JourneyId);
    }
  });
});
