import {
  POLICY_VERSION,
  type AuditEvent,
  type AuditEventType,
  type ChatTurnResponse,
  type CreateSessionRequest,
  type GroundingSignal,
  type IntakeRequest,
  type MessageRequest,
  type PublicConversationState,
  type ReasonCode,
  type Reply,
  type ReplyMode,
  type ServingMode,
  type TranscriptEntry,
} from '@loanslam/contracts';
import type { IChatService, RequestContext, TurnOutcome } from '../../ports/chat.port.js';
import type { ChatServiceDeps } from '../../composition/types.js';
import type { TicketRequest } from '../../ports/ticket.port.js';
import {
  initialConversationState,
  type ConversationMessage,
  type ServerConversationState,
  type Session,
} from '../../domain/conversation.js';
import {
  newConversationRef,
  newCsrfToken,
  newEventId,
  newSessionId,
  newTranscriptId,
} from '../../common/ids.js';
import { ServiceResponseFactory } from '../../common/serviceResponse.js';
import { route, type RoutingDecision } from './router.js';
import { runVulnerabilityGate } from './vulnerability.gate.js';
import { buildReply } from './responder.js';
import { validateIntake } from './intake.js';
import * as copy from '../templates/copy.js';

/** Error class/name for audit payloads — never the message (avoids leaking PII). */
function errName(err: unknown): string {
  return err instanceof Error ? err.name || 'Error' : 'UnknownError';
}

/** Internal helper bundle for building one audit event. */
interface AuditFields {
  type: AuditEventType;
  reasonCode?: ReasonCode | null;
  replyMode?: ReplyMode | null;
  groundingServingMode?: ServingMode | null;
  payload?: Record<string, unknown>;
}

/**
 * The orchestration service. Owns the fail-closed pipeline (build-spec):
 *   resolve session -> idempotency -> record inbound
 *     -> VULNERABILITY GATE (stop if vulnerable)
 *     -> retrieval -> classify -> route -> respond
 *     -> record outbound + decision audits -> persist state
 *
 * Every inbound and outbound message is recorded to BOTH the transcript store
 * and the audit trail — never dropped (brief §13, §16).
 */
export class ChatService implements IChatService {
  constructor(private readonly deps: ChatServiceDeps) {}

  // ── Session lifecycle ──────────────────────────────────────────────────────

  async createSession(
    _input: CreateSessionRequest,
    ctx: RequestContext,
  ): Promise<TurnOutcome<ChatTurnResponse>> {
    const now = this.now();
    const session: Session = {
      id: newSessionId(),
      conversationRef: newConversationRef(),
      createdAt: now,
      updatedAt: now,
      state: initialConversationState(),
      history: [],
      csrfToken: newCsrfToken(),
    };

    await this.deps.repos.sessions.create(session);
    await this.writeAudit(session.conversationRef, ctx.requestRef, {
      type: 'session_created',
    });

    const reply: Reply = { mode: 'clarify', text: copy.greeting() };
    await this.recordOutbound(session, ctx.requestRef, reply);

    const response = ServiceResponseFactory.ok<ChatTurnResponse>(
      this.turnResponse(session, ctx.requestRef, reply),
      'Session created',
      201,
    );
    return {
      response,
      setSessionId: session.id,
      csrfToken: session.csrfToken,
    };
  }

  // ── Message turn (the pipeline) ────────────────────────────────────────────

  async handleMessage(
    sessionId: string | undefined,
    input: MessageRequest,
    ctx: RequestContext,
  ): Promise<TurnOutcome<ChatTurnResponse>> {
    const session = await this.resolveSession(sessionId);
    if (session === null) return this.unauthenticated();

    // Idempotency: a duplicate retry returns the current state without
    // reprocessing. We still record the duplicate as a received (inbound) event
    // and a recorded outbound ack, so no received message is unrepresented.
    const seen = await this.deps.repos.idempotency.seen(session.id, input.clientMessageId);
    if (seen) {
      await this.writeAudit(session.conversationRef, ctx.requestRef, {
        type: 'message_inbound',
        payload: { duplicate: true, clientMessageId: input.clientMessageId },
      });
      const ack: Reply = { mode: 'clarify', text: copy.duplicateAck() };
      await this.recordOutbound(session, ctx.requestRef, ack);
      return this.okTurn(session, ctx.requestRef, ack);
    }

    // Record inbound FIRST — before any fallible processing — so the customer's
    // message is always in the trail even if the pipeline then errors.
    const inbound: ConversationMessage = { role: 'user', content: input.text, ts: this.now() };
    await this.recordInbound(session, ctx.requestRef, inbound);

    try {
      // 1. Retrieval — fail-safe: a retrieval error must NOT bypass the
      // vulnerability gate, which has independent model + keyword checks.
      const grounding = await this.safeRetrieve(input.text, session, ctx);

      // 2. Vulnerability gate — fail closed; stop the pipeline if it fires.
      const gate = await runVulnerabilityGate({
        model: this.deps.model,
        retrieval: grounding,
        text: input.text,
        history: session.history,
        threshold: this.threshold(),
      });
      await this.writeAudit(session.conversationRef, ctx.requestRef, {
        type: 'vulnerability_check',
        reasonCode: gate.vulnerable ? gate.reasonCode : null,
        payload: { vulnerable: gate.vulnerable, source: gate.source, category: gate.category },
      });

      if (gate.vulnerable) {
        return await this.handleVulnerable(session, ctx, grounding, gate.reasonCode, gate.category);
      }

      // 3. Classify (with retrieval context).
      const topHit = grounding.hits.length > 0 ? grounding.hits[0]! : null;
      const classification = await this.deps.model.classify({
        text: input.text,
        history: session.history,
        retrieval: {
          topServingMode: grounding.topServingMode,
          topScore: grounding.topScore,
          topQuestion: topHit?.question ?? null,
        },
      });
      await this.writeAudit(session.conversationRef, ctx.requestRef, {
        type: 'classification',
        payload: {
          action: classification.action,
          source: classification.source,
          confidence: classification.confidence,
        },
      });

      // 4. Grounding check audit.
      await this.writeAudit(session.conversationRef, ctx.requestRef, {
        type: 'grounding_check',
        groundingServingMode: grounding.topServingMode,
        payload: {
          grounded: grounding.grounded,
          topScore: grounding.topScore,
          threshold: this.threshold(),
        },
      });

      // 5. Route (pure policy).
      const decision = route({
        grounding,
        classification,
        vulnerability: { vulnerable: false, reasonCode: 'vulnerability_signal', category: null },
        state: session.state,
        text: input.text,
        threshold: this.threshold(),
      });

      // 6. Respond — then audit the REALISED reply, since the responder may
      // safely downgrade 'answer' to 'fallback' (no/unfaithful grounding).
      const reply = await buildReply(decision, {
        model: this.deps.model,
        customerText: input.text,
        history: session.history,
      });
      const downgraded = decision.replyMode === 'answer' && reply.mode !== 'answer';
      await this.writeAudit(session.conversationRef, ctx.requestRef, {
        type: 'routing_decision',
        reasonCode: downgraded ? 'no_grounding' : decision.reasonCode,
        replyMode: reply.mode,
        groundingServingMode: grounding.topServingMode,
      });

      // 7. Update state from the decision and the realised reply.
      this.applyDecisionToState(session.state, decision, classification, reply);

      await this.recordOutbound(session, ctx.requestRef, reply);
      await this.deps.repos.sessions.updateState(session.id, session.state);

      return this.okTurn(session, ctx.requestRef, reply);
    } catch (err) {
      // Any uncaught pipeline error fails safe: never an answer, always a
      // recorded outbound + a 'failure' audit event so the trail stays complete.
      return await this.failSafe(session, ctx, err);
    }
  }

  // ── Intake submission ──────────────────────────────────────────────────────

  async submitIntake(
    sessionId: string | undefined,
    input: IntakeRequest,
    ctx: RequestContext,
  ): Promise<TurnOutcome<ChatTurnResponse>> {
    const session = await this.resolveSession(sessionId);
    if (session === null) return this.unauthenticated();

    // The intake submission is a received (inbound) turn. Record it FIRST,
    // redacted to field names only — the raw PII never enters the transcript.
    await this.recordIntakeInbound(session, ctx.requestRef, Object.keys(input.values));

    const form = session.state.pendingForm;
    if (form === null) {
      const response = ServiceResponseFactory.fail<ChatTurnResponse>(
        'No intake form is currently being requested.',
        400,
      );
      await this.writeAudit(session.conversationRef, ctx.requestRef, {
        type: 'failure',
        payload: { reason: 'no_pending_form' },
      });
      return { response };
    }

    const { ok, errors, cleaned } = validateIntake(form, input.values);
    if (!ok) {
      await this.writeAudit(session.conversationRef, ctx.requestRef, {
        type: 'failure',
        payload: { reason: 'intake_invalid', fields: Object.keys(errors) },
      });
      const response = ServiceResponseFactory.fail<ChatTurnResponse>(
        'Some details need attention before we can continue.',
        400,
      );
      return { response };
    }

    try {
      // Store allowed PII only (credentials already stripped by validateIntake).
      session.state.collected = { ...session.state.collected, ...cleaned };

      // Carry the original route reason through to the ticket where we have it.
      const reasonCode: ReasonCode = session.state.handoff?.reasonCode ?? 'account_specific';
      const { category, priority } = this.ticketRoutingFor(reasonCode);

      const ticket = await this.deps.ticket.createTicket({
        conversationRef: session.conversationRef,
        reasonCode,
        category,
        priority,
        contact: session.state.collected,
        summary: session.state.customerGoal ?? 'Account handoff requested by customer.',
      });

      await this.writeAudit(session.conversationRef, ctx.requestRef, {
        type: 'intake_submitted',
        reasonCode: 'intake_complete',
        payload: { fields: Object.keys(cleaned) },
      });
      await this.writeAudit(session.conversationRef, ctx.requestRef, {
        type: 'ticket_created',
        reasonCode,
        payload: { ticketRef: ticket.ticketRef, status: ticket.status, priority },
      });

      session.state.handoff = { ticketRef: ticket.ticketRef, reasonCode };
      session.state.phase = 'handoff_pending';
      session.state.pendingForm = null;

      const reply: Reply = {
        mode: 'handoff',
        text: copy.handoffConfirmation(ticket.ticketRef),
        ticketRef: ticket.ticketRef,
      };
      await this.recordOutbound(session, ctx.requestRef, reply);
      await this.deps.repos.sessions.updateState(session.id, session.state);

      return this.okTurn(session, ctx.requestRef, reply);
    } catch (err) {
      return await this.failSafe(session, ctx, err);
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  async reset(
    sessionId: string | undefined,
    ctx: RequestContext,
  ): Promise<TurnOutcome<ChatTurnResponse>> {
    const session = await this.resolveSession(sessionId);
    if (session === null) return this.unauthenticated();

    const fresh = initialConversationState();
    await this.deps.repos.sessions.reset(session.id, fresh);
    session.state = fresh;
    session.history = [];

    await this.writeAudit(session.conversationRef, ctx.requestRef, {
      type: 'conversation_reset',
    });

    const reply: Reply = { mode: 'clarify', text: copy.greeting() };
    await this.recordOutbound(session, ctx.requestRef, reply);

    return this.okTurn(session, ctx.requestRef, reply);
  }

  // ── Pipeline helpers ────────────────────────────────────────────────────────

  /** The vulnerability branch: escalate, create urgent ticket, STOP. */
  private async handleVulnerable(
    session: Session,
    ctx: RequestContext,
    grounding: GroundingSignal,
    reasonCode: ReasonCode,
    category: string | null,
  ): Promise<TurnOutcome<ChatTurnResponse>> {
    const decision: RoutingDecision = {
      replyMode: 'vulnerability',
      reasonCode,
      category,
      requiresIntake: false,
      topHit: grounding.hits.length > 0 ? grounding.hits[0]! : null,
    };

    const baseReply = await buildReply(decision, {
      model: this.deps.model,
      customerText: '',
      history: session.history,
    });

    const ticket = await this.deps.ticket.createTicket({
      conversationRef: session.conversationRef,
      reasonCode: 'vulnerability_signal',
      category: 'vulnerability',
      priority: 'urgent',
      contact: session.state.collected,
      summary: session.state.customerGoal ?? 'Vulnerability signal detected; human escalation.',
    });
    await this.writeAudit(session.conversationRef, ctx.requestRef, {
      type: 'ticket_created',
      reasonCode: 'vulnerability_signal',
      payload: { ticketRef: ticket.ticketRef, status: ticket.status, priority: 'urgent' },
    });

    session.state.vulnerabilityFlagged = true;
    session.state.phase = 'handoff_pending';
    session.state.handoff = { ticketRef: ticket.ticketRef, reasonCode: 'vulnerability_signal' };

    // Surface the ticket ref on the vulnerability reply.
    const reply: Reply =
      baseReply.mode === 'vulnerability'
        ? { ...baseReply, ticketRef: ticket.ticketRef }
        : baseReply;

    await this.writeAudit(session.conversationRef, ctx.requestRef, {
      type: 'routing_decision',
      reasonCode,
      replyMode: 'vulnerability',
      groundingServingMode: grounding.topServingMode,
    });

    await this.recordOutbound(session, ctx.requestRef, reply);
    await this.deps.repos.sessions.updateState(session.id, session.state);

    return this.okTurn(session, ctx.requestRef, reply);
  }

  /** Mutate server state from the route decision and realised reply. */
  private applyDecisionToState(
    state: ServerConversationState,
    decision: RoutingDecision,
    classification: { customerGoal: string | null },
    reply: Reply,
  ): void {
    if (classification.customerGoal !== null) {
      state.customerGoal = classification.customerGoal;
    }
    // Reflect the REALISED reply, not the pre-responder decision (the responder
    // may downgrade an 'answer' to 'fallback').
    state.answerable = reply.mode === 'answer';

    if (reply.mode === 'intake_request') {
      state.pendingForm = reply.form;
      state.phase = 'awaiting_intake';
      // Record the route reason so the eventual ticket carries it through.
      state.handoff = { ticketRef: null, reasonCode: decision.reasonCode };
      return;
    }

    switch (reply.mode) {
      case 'fallback':
        state.phase = 'safe_fallback';
        break;
      case 'clarify':
        state.phase = 'collecting_info';
        break;
      case 'answer':
      case 'refusal':
        state.phase = 'anonymous_active';
        break;
      default:
        break;
    }
  }

  // ── Resilience (fail-safe, never drop a turn) ───────────────────────────────

  /**
   * Retrieval that never throws into the pipeline. A retrieval failure yields an
   * empty grounding signal so the vulnerability gate (model + keyword checks,
   * independent of retrieval) STILL runs and can fail closed — a retrieval
   * outage must not silently bypass the safety gate.
   */
  private async safeRetrieve(
    text: string,
    session: Session,
    ctx: RequestContext,
  ): Promise<GroundingSignal> {
    try {
      return await this.deps.retrieval.retrieve(text);
    } catch (err) {
      this.deps.logger.error(
        { err, conversationRef: session.conversationRef },
        'retrieval failed; continuing with empty grounding so the gate still runs',
      );
      await this.writeAudit(session.conversationRef, ctx.requestRef, {
        type: 'failure',
        payload: { stage: 'retrieval', error: errName(err) },
      });
      return { grounded: false, topScore: 0, topServingMode: null, hits: [] };
    }
  }

  /**
   * Last-resort safe response for an uncaught pipeline error. Never an answer:
   * record a 'failure' audit event and a safe fallback outbound so every inbound
   * keeps a paired outbound and nothing is dropped from the trail.
   */
  private async failSafe(
    session: Session,
    ctx: RequestContext,
    err: unknown,
  ): Promise<TurnOutcome<ChatTurnResponse>> {
    this.deps.logger.error(
      { err, conversationRef: session.conversationRef },
      'pipeline error; responding safely',
    );
    const reply: Reply = { mode: 'fallback', text: copy.fallback() };
    try {
      await this.writeAudit(session.conversationRef, ctx.requestRef, {
        type: 'failure',
        replyMode: 'fallback',
        payload: { stage: 'pipeline', error: errName(err) },
      });
      session.state.phase = 'safe_fallback';
      await this.recordOutbound(session, ctx.requestRef, reply);
      await this.deps.repos.sessions.updateState(session.id, session.state);
    } catch (err2) {
      // Persistence itself is failing — log loudly; still return a safe reply.
      this.deps.logger.error({ err: err2 }, 'failed to record fail-safe outbound');
    }
    return this.okTurn(session, ctx.requestRef, reply);
  }

  // ── Recording (transcript + audit, never dropped) ───────────────────────────

  /** Record an intake-form submission as a redacted inbound turn (no raw PII). */
  private async recordIntakeInbound(
    session: Session,
    requestRef: string,
    fieldNames: string[],
  ): Promise<void> {
    const ts = this.now();
    const placeholder = '[handoff details submitted]';
    const message: ConversationMessage = { role: 'user', content: placeholder, ts };
    session.history.push(message);
    await this.deps.repos.sessions.appendHistory(session.id, message);
    await this.deps.repos.transcripts.append({
      id: newTranscriptId(),
      conversationRef: session.conversationRef,
      requestRef,
      direction: 'inbound',
      author: 'customer',
      text: placeholder,
      replyMode: null,
      ts,
    });
    await this.writeAudit(session.conversationRef, requestRef, {
      type: 'message_inbound',
      payload: { intake: true, fields: fieldNames },
    });
  }

  private async recordInbound(
    session: Session,
    requestRef: string,
    message: ConversationMessage,
  ): Promise<void> {
    session.history.push(message);
    await this.deps.repos.sessions.appendHistory(session.id, message);

    const transcript: TranscriptEntry = {
      id: newTranscriptId(),
      conversationRef: session.conversationRef,
      requestRef,
      direction: 'inbound',
      author: 'customer',
      text: message.content,
      replyMode: null,
      ts: message.ts,
    };
    await this.deps.repos.transcripts.append(transcript);
    await this.writeAudit(session.conversationRef, requestRef, {
      type: 'message_inbound',
      payload: { length: message.content.length },
    });
  }

  private async recordOutbound(
    session: Session,
    requestRef: string,
    reply: Reply,
  ): Promise<void> {
    const ts = this.now();
    const message: ConversationMessage = { role: 'assistant', content: reply.text, ts };
    session.history.push(message);
    await this.deps.repos.sessions.appendHistory(session.id, message);

    const transcript: TranscriptEntry = {
      id: newTranscriptId(),
      conversationRef: session.conversationRef,
      requestRef,
      direction: 'outbound',
      author: 'bot',
      text: reply.text,
      replyMode: reply.mode,
      ts,
    };
    await this.deps.repos.transcripts.append(transcript);
    await this.writeAudit(session.conversationRef, requestRef, {
      type: 'message_outbound',
      replyMode: reply.mode,
    });
  }

  private async writeAudit(
    conversationRef: string,
    requestRef: string,
    fields: AuditFields,
  ): Promise<void> {
    const event: AuditEvent = {
      id: newEventId(),
      conversationRef,
      requestRef,
      type: fields.type,
      ts: this.now(),
      policyVersion: POLICY_VERSION,
      reasonCode: fields.reasonCode ?? null,
      replyMode: fields.replyMode ?? null,
      groundingServingMode: fields.groundingServingMode ?? null,
      payload: fields.payload ?? {},
    };
    await this.deps.repos.audit.append(event);
  }

  // ── Small utilities ─────────────────────────────────────────────────────────

  private async resolveSession(sessionId: string | undefined): Promise<Session | null> {
    if (sessionId === undefined || sessionId.length === 0) return null;
    return this.deps.repos.sessions.findById(sessionId);
  }

  private unauthenticated(): TurnOutcome<ChatTurnResponse> {
    return {
      response: ServiceResponseFactory.fail<ChatTurnResponse>(
        'No active session. Please start a new session and try again.',
        401,
      ),
    };
  }

  private okTurn(
    session: Session,
    requestRef: string,
    reply: Reply,
  ): TurnOutcome<ChatTurnResponse> {
    return {
      response: ServiceResponseFactory.ok<ChatTurnResponse>(
        this.turnResponse(session, requestRef, reply),
      ),
    };
  }

  private turnResponse(session: Session, requestRef: string, reply: Reply): ChatTurnResponse {
    return {
      conversationRef: session.conversationRef,
      requestRef,
      state: this.toPublicState(session.state),
      reply,
    };
  }

  private toPublicState(state: ServerConversationState): PublicConversationState {
    return {
      phase: state.phase,
      vulnerabilityFlagged: state.vulnerabilityFlagged,
      awaitingForm: state.pendingForm !== null,
      goalSummary: state.customerGoal,
    };
  }

  private ticketRoutingFor(reasonCode: ReasonCode): {
    category: string;
    priority: TicketRequest['priority'];
  } {
    switch (reasonCode) {
      case 'vulnerability_signal':
      case 'model_error_failclosed':
        return { category: 'vulnerability', priority: 'urgent' };
      case 'change_request':
        return { category: 'change_request', priority: 'high' };
      case 'account_specific':
        return { category: 'account', priority: 'high' };
      default:
        return { category: 'general', priority: 'normal' };
    }
  }

  private threshold(): number {
    return this.deps.config.groundingThreshold;
  }

  private now(): string {
    return new Date().toISOString();
  }
}

/**
 * Factory: build a ChatService from injected deps. Composition root calls this;
 * tests call it with fakes.
 */
export function createChatService(deps: ChatServiceDeps): ChatService {
  return new ChatService(deps);
}
