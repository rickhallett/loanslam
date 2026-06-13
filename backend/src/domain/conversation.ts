import type {
  ConversationPhase,
  FormConfig,
  IntakeFieldName,
  ReasonCode,
} from '@loanslam/contracts';

/**
 * Server-owned conversation state. This is the FULL state, including collected
 * PII, and never leaves the backend verbatim — the browser only ever sees the
 * redacted `PublicConversationState` (contracts/state.ts). See brief §5, §16.
 */
export interface ServerConversationState {
  phase: ConversationPhase;
  /** Short natural-language summary of what the customer wants. */
  customerGoal: string | null;
  /** Handoff PII collected so far. Bank/payment credentials are never stored. */
  collected: Partial<Record<IntakeFieldName, string>>;
  /** Sticky once any safety signal fires this conversation. */
  vulnerabilityFlagged: boolean;
  /** Tri-state: null = not yet assessed this turn. */
  answerable: boolean | null;
  /** The form the customer is currently being asked to complete, if any. */
  pendingForm: FormConfig | null;
  /** Reason the conversation was routed to a human, once that happens. */
  handoff: { ticketRef: string | null; reasonCode: ReasonCode } | null;
}

/** One message in the running thread, used as model context. */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: string;
}

/**
 * Server-owned session. `id` is the secret session identifier (set as an
 * HttpOnly cookie, never exposed to JS). `conversationRef` is the non-secret
 * correlation reference returned to the browser and stamped on audit events.
 */
export interface Session {
  id: string;
  conversationRef: string;
  createdAt: string;
  updatedAt: string;
  state: ServerConversationState;
  history: ConversationMessage[];
  /** CSRF double-submit token bound to this session. */
  csrfToken: string;
}

/** A fresh, anonymous conversation state. */
export function initialConversationState(): ServerConversationState {
  return {
    phase: 'anonymous_active',
    customerGoal: null,
    collected: {},
    vulnerabilityFlagged: false,
    answerable: null,
    pendingForm: null,
    handoff: null,
  };
}
