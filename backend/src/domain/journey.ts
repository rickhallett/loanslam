import type { IntakeFieldName } from '@loanslam/contracts';

/**
 * Journey taxonomy (PRD: docs/prd-journey-modelling.md §4.1). A journey is a
 * customer goal with a disposition; the deterministic policy decides transitions
 * from model-extracted signals — the model never decides policy (§3).
 *
 * Seeded from the brief's contact categories and the KB `serving_mode` families.
 * Per DECISIONS.yaml DD-0001 this is synthetic-seeded: the prospective-customer
 * and general-public journey band is a DECLARED GAP, not modelled here, and is
 * added when the real corpus lands. The volatile region is additive — the slot
 * framework, dispositions, and invariants below are pinned by regulation.
 */
export type JourneyId =
  | 'general_question' // answer from the approved KB
  | 'account_handoff' // account-specific -> collect handoff PII -> ticket
  | 'change_request' // change to a loan application -> collect handoff PII -> ticket
  | 'vulnerability_support'; // safety signal -> escalate (owned by the gate)

/** Disposition reuses/extends the KB serving_mode discriminator (PRD §4.1). */
export type JourneyDisposition = 'answer' | 'collect_then_handoff' | 'escalate' | 'refuse';

/**
 * A slot to collect (PRD §4.2). `name` is a member of the regulatorily-CLOSED
 * `IntakeFieldName` set — there is deliberately no slot for card / sort code /
 * account number, so the extractor has nowhere to put a credential even if one
 * is volunteered (brief §16, DD-0001). `prompt` is approved deterministic copy
 * for eliciting the slot one-at-a-time in natural conversation.
 */
export interface SlotSpec {
  name: IntakeFieldName;
  required: boolean;
  prompt: string;
}

export interface JourneySpec {
  id: JourneyId;
  disposition: JourneyDisposition;
  /** Ordered collection slots; empty for non-collecting journeys. */
  slots: SlotSpec[];
}

/**
 * Handoff PII slots, shared by every collect-then-handoff journey. Required set
 * (name, DOB, email) mirrors the fast-path form (chat/services/intake.ts); the
 * form is one affordance over this same schema, not a separate path (PRD §4.2).
 */
const HANDOFF_SLOTS: readonly SlotSpec[] = [
  { name: 'full_name', required: true, prompt: 'Could I take your full name?' },
  {
    name: 'date_of_birth',
    required: true,
    prompt: 'And your date of birth? Please use the format YYYY-MM-DD.',
  },
  {
    name: 'email',
    required: true,
    prompt: 'What is the best email address for our team to reach you on?',
  },
  {
    name: 'phone',
    required: false,
    prompt: 'Is there a phone number we can use, if you are happy to share one?',
  },
  { name: 'address', required: false, prompt: 'What is your address?' },
  {
    name: 'context',
    required: false,
    prompt: 'Is there anything else that would help our team help you?',
  },
];

export const JOURNEYS: Readonly<Record<JourneyId, JourneySpec>> = {
  general_question: { id: 'general_question', disposition: 'answer', slots: [] },
  account_handoff: {
    id: 'account_handoff',
    disposition: 'collect_then_handoff',
    slots: HANDOFF_SLOTS.map((s) => ({ ...s })),
  },
  change_request: {
    id: 'change_request',
    disposition: 'collect_then_handoff',
    slots: HANDOFF_SLOTS.map((s) => ({ ...s })),
  },
  vulnerability_support: {
    id: 'vulnerability_support',
    disposition: 'escalate',
    slots: [],
  },
};

export function getJourneySpec(id: JourneyId): JourneySpec {
  return JOURNEYS[id];
}

export function allJourneys(): JourneySpec[] {
  return Object.values(JOURNEYS);
}

/** Required slot names for a journey, in elicitation order. */
export function requiredSlotNames(spec: JourneySpec): IntakeFieldName[] {
  return spec.slots.filter((s) => s.required).map((s) => s.name);
}
