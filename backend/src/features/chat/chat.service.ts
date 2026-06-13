import { createHash, randomUUID } from 'node:crypto';

import {
  chatResponseSchema,
  intakeSubmitRequestSchema,
  resetRequestSchema,
  sendMessageRequestSchema,
  type ChatAudit,
  type ChatMessage,
  type ChatResponse,
  type ClassifierResult,
  type CreateSessionResponse,
  type GroundingCitation,
  type HandoffIntakeForm,
  type IntakeSubmitRequest,
  type RetrievalResult,
  type SendMessageRequest,
  type VulnerabilityResult,
} from '@loanslam/contracts';

import type {
  ChatRepository,
  ChatSessionRecord,
  ClientMessageRecord,
  JsonObject,
} from './chat.models.js';
import type { ModelProvider } from './providers/model-provider.js';
import type { RagProvider } from './providers/rag-provider.js';
import type { TicketProvider } from './providers/ticket-provider.js';

const allowedActions = [
  'answer',
  'collect',
  'request_handoff_intake',
  'create_ticket',
  'safe_fallback',
  'refuse',
  'escalate',
] as const;

const handoffForm: HandoffIntakeForm = {
  id: 'handoff-intake',
  title: 'Support handoff',
  submitLabel: 'Send details',
  fields: [
    { name: 'name', label: 'Name', inputType: 'text', required: true },
    { name: 'dob', label: 'Date of birth', inputType: 'date', required: true },
    { name: 'address', label: 'Address', inputType: 'textarea', required: true },
    { name: 'phone', label: 'Phone', inputType: 'tel', required: true },
    { name: 'email', label: 'Email', inputType: 'email', required: true },
    {
      name: 'situationalContext',
      label: 'How can the support team help?',
      inputType: 'textarea',
      required: true,
    },
  ],
};

export class ChatServiceError extends Error {
  constructor(
    readonly statusCode: number,
    readonly errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'ChatServiceError';
  }
}

export interface ChatServiceDependencies {
  repository: ChatRepository;
  modelProvider: ModelProvider;
  ragProvider: RagProvider;
  ticketProvider: TicketProvider;
}

export interface CreateSessionResult {
  sessionId: string;
  response: CreateSessionResponse;
}

export interface ResetSessionResult {
  sessionId: string;
  response: ChatResponse;
}

export class ChatService {
  constructor(private readonly dependencies: ChatServiceDependencies) {}

  get repository(): ChatRepository {
    return this.dependencies.repository;
  }

  async createSession(): Promise<CreateSessionResult> {
    const csrfToken = createCsrfToken();
    const requestRef = createRef('req');
    const correlationRef = createRef('corr');
    const session = await this.dependencies.repository.createSession({
      csrfTokenHash: hashCsrfToken(csrfToken),
    });
    const greeting = createAssistantMessage(
      'Hello. I can help with general Loanslam questions and connect you to support when your request needs a person.',
      'session_greeting',
    );

    await this.dependencies.repository.appendTranscript({
      sessionId: session.id,
      requestRef,
      direction: 'outbound',
      role: 'assistant',
      content: greeting.text,
      metadata: { messageId: greeting.id, reasonCode: 'session_greeting' },
    });
    await this.dependencies.repository.appendAudit({
      sessionId: session.id,
      requestRef,
      eventType: 'session_created',
      reasonCode: 'session_created',
      payload: { conversationRef: session.conversationRef },
    });

    return {
      sessionId: session.id,
      response: {
        conversationRef: session.conversationRef,
        requestRef,
        correlationRef,
        csrfToken,
        state: 'active',
        messages: [greeting],
        audit: createAudit(['session_created'], ['session_created']),
      },
    };
  }

  async sendMessage(
    sessionId: string,
    request: unknown,
    csrfToken = 'csrf_unchanged',
  ): Promise<ChatResponse> {
    const parsedRequest = parseSendMessageRequest(request);
    const session = await this.requireSession(sessionId);
    const correlationRef = createRef('corr');
    const clientMessage = await this.dependencies.repository.recordClientMessage(
      session.id,
      parsedRequest.clientMessageId,
      createRef('req'),
    );
    const requestRef = clientMessage.requestRef;

    if (!clientMessage.created && clientMessage.responsePayload) {
      return parseStoredChatResponse(clientMessage.responsePayload);
    }

    if (!clientMessage.created) {
      const hasActivity = await this.dependencies.repository.hasRequestActivity(
        session.id,
        requestRef,
      );
      if (hasActivity) {
        throw new ChatServiceError(
          409,
          'message_incomplete',
          'Message processing did not finish cleanly. Please send a new message.',
        );
      }
    }

    await this.auditInboundMessage(session, requestRef, parsedRequest);

    const response = await this.routeMessage(
      session,
      requestRef,
      correlationRef,
      csrfToken,
      parsedRequest.text,
    );

    return this.completeClientMessage(clientMessage, response);
  }

  private async routeMessage(
    session: ChatSessionRecord,
    requestRef: string,
    correlationRef: string,
    csrfToken: string,
    text: string,
  ): Promise<ChatResponse> {
    const vulnerability = await this.classifyVulnerability(session, requestRef, text);
    if (vulnerability.route) {
      return this.routeToHandoff({
        session,
        requestRef,
        correlationRef,
        csrfToken,
        reasonCode: vulnerability.reasonCode,
        text: vulnerability.text ?? 'Please share these details and the support team will help.',
        auditEvents: vulnerability.auditEvents,
      });
    }

    const retrieval = await this.retrieveGrounding(session, requestRef, text);
    const classifier = await this.classifyAction(session, requestRef, text, retrieval);
    if (classifier.routeToFallback) {
      return this.routeToFallback({
        session,
        requestRef,
        correlationRef,
        csrfToken,
        reasonCode: classifier.reasonCode ?? 'safe_fallback',
        text: classifier.text ?? 'I can connect you with support instead.',
        auditEvents: classifier.auditEvents,
      });
    }

    if (classifier.routeToHandoff) {
      return this.routeToHandoff({
        session,
        requestRef,
        correlationRef,
        csrfToken,
        reasonCode: classifier.reasonCode ?? 'handoff_requested',
        text: classifier.text ?? 'I can connect you with support instead.',
        auditEvents: classifier.auditEvents,
      });
    }

    if (!retrieval.grounded) {
      return this.routeToFallback({
        session,
        requestRef,
        correlationRef,
        csrfToken,
        reasonCode: retrieval.reasonCode,
        text: 'I cannot answer that safely from the approved Loanslam information. I can connect you with support instead.',
        auditEvents: [...retrieval.auditEvents, ...classifier.auditEvents],
      });
    }

    return this.answerGrounded(session, requestRef, correlationRef, csrfToken, text, retrieval, {
      classifier: classifier.result,
      auditEvents: classifier.auditEvents,
    });
  }

  async submitIntake(
    sessionId: string,
    request: unknown,
    csrfToken = 'csrf_unchanged',
  ): Promise<ChatResponse> {
    const parsedRequest = parseIntakeRequest(request);
    const session = await this.requireSession(sessionId);
    const requestRef = createRef('req');
    const correlationRef = createRef('corr');

    await this.dependencies.repository.appendTranscript({
      sessionId: session.id,
      requestRef,
      direction: 'inbound',
      role: 'user',
      content: 'Support handoff intake submitted.',
      metadata: {
        clientRequestId: parsedRequest.clientRequestId,
        fields: Object.keys(parsedRequest.intake),
      },
    });
    await this.dependencies.repository.appendAudit({
      sessionId: session.id,
      requestRef,
      eventType: 'intake_received',
      reasonCode: 'handoff_intake_submitted',
      payload: { fields: Object.keys(parsedRequest.intake) },
    });

    const ticket = await this.submitTicketSafely({
      conversationRef: session.conversationRef,
      requestRef,
      intake: parsedRequest.intake,
      transcriptSummary: 'Support handoff intake submitted through Loanslam chat.',
      reasonCode: 'handoff_intake_submitted',
    });

    await this.dependencies.repository.recordTicketHandoff({
      sessionId: session.id,
      requestRef,
      provider: ticket.provider,
      providerReference: ticket.providerReference,
      status: ticket.status,
      payload: {
        reasonCode: ticket.reasonCode ?? 'handoff_intake_submitted',
        fields: Object.keys(parsedRequest.intake),
      },
    });
    await this.dependencies.repository.updateSessionState(session.id, 'handoff_pending', {
      reasonCode: ticket.reasonCode ?? 'handoff_intake_submitted',
      ticketProvider: ticket.provider,
      ticketStatus: ticket.status,
    });

    const message = createAssistantMessage(
      createTicketConfirmationCopy(ticket.status),
      ticket.reasonCode ?? 'handoff_pending',
    );
    await this.appendOutbound(session.id, requestRef, message, {
      ticketProvider: ticket.provider,
      ticketStatus: ticket.status,
      providerReference: ticket.providerReference,
    });
    await this.dependencies.repository.appendAudit({
      sessionId: session.id,
      requestRef,
      eventType: 'ticket_handoff_recorded',
      reasonCode: ticket.reasonCode ?? 'handoff_intake_submitted',
      payload: {
        provider: ticket.provider,
        status: ticket.status,
      },
    });

    return {
      conversationRef: session.conversationRef,
      requestRef,
      correlationRef,
      csrfToken,
      state: 'handoff_pending',
      messages: [message],
      audit: createAudit(
        ['intake_received', 'ticket_handoff_recorded', 'message_routed'],
        ['handoff_intake_submitted', ticket.reasonCode ?? 'handoff_pending'],
      ),
    };
  }

  async reset(sessionId: string, request: unknown): Promise<ResetSessionResult> {
    const parsedRequest = resetRequestSchema.safeParse(request);
    if (!parsedRequest.success) {
      throw new ChatServiceError(400, 'invalid_request', 'Invalid request');
    }

    const session = await this.requireSession(sessionId);
    const csrfToken = createCsrfToken();
    const requestRef = createRef('req');
    const correlationRef = createRef('corr');
    const rotated = await this.dependencies.repository.rotateCsrf(
      session.id,
      hashCsrfToken(csrfToken),
    );
    await this.dependencies.repository.updateSessionState(session.id, 'active', {
      reasonCode: parsedRequest.data.reason ?? 'user_requested',
      resetAt: new Date().toISOString(),
    });

    const message = createAssistantMessage(
      'I have reset this chat. How can I help with Loanslam today?',
      'chat_reset',
    );
    await this.appendOutbound(session.id, requestRef, message, {
      reason: parsedRequest.data.reason ?? 'user_requested',
    });
    await this.dependencies.repository.appendAudit({
      sessionId: session.id,
      requestRef,
      eventType: 'chat_reset',
      reasonCode: parsedRequest.data.reason ?? 'user_requested',
      payload: {},
    });

    return {
      sessionId: rotated.id,
      response: {
        conversationRef: rotated.conversationRef,
        requestRef,
        correlationRef,
        csrfToken,
        state: 'active',
        messages: [message],
        audit: createAudit(['chat_reset'], [parsedRequest.data.reason ?? 'user_requested']),
      },
    };
  }

  private async requireSession(sessionId: string): Promise<ChatSessionRecord> {
    const session = await this.dependencies.repository.getSessionById(sessionId);
    if (!session) {
      throw new ChatServiceError(401, 'session_invalid', 'Session is invalid');
    }

    return session;
  }

  private async submitTicketSafely(
    input: Parameters<TicketProvider['submitHandoff']>[0],
  ): ReturnType<TicketProvider['submitHandoff']> {
    try {
      return await this.dependencies.ticketProvider.submitHandoff(input);
    } catch {
      return {
        provider: 'ticket-provider',
        providerReference: createRef('ticket_failed'),
        status: 'failed',
        reasonCode: 'ticket_webhook_failed',
      };
    }
  }

  private async completeClientMessage(
    clientMessage: ClientMessageRecord,
    response: ChatResponse,
  ): Promise<ChatResponse> {
    await this.dependencies.repository.completeClientMessage(
      clientMessage.id,
      toJsonObject(response),
    );

    return response;
  }

  private async auditInboundMessage(
    session: ChatSessionRecord,
    requestRef: string,
    request: SendMessageRequest,
  ): Promise<void> {
    await this.dependencies.repository.appendTranscript({
      sessionId: session.id,
      requestRef,
      direction: 'inbound',
      role: 'user',
      content: request.text,
      metadata: { clientMessageId: request.clientMessageId },
    });
    await this.dependencies.repository.appendAudit({
      sessionId: session.id,
      requestRef,
      eventType: 'message_received',
      reasonCode: 'client_message_received',
      payload: { textLength: request.text.length },
    });
  }

  private async classifyVulnerability(
    session: ChatSessionRecord,
    requestRef: string,
    text: string,
  ): Promise<RouteDecision> {
    let result: VulnerabilityResult;
    try {
      result = await this.dependencies.modelProvider.classifyVulnerability({
        conversationRef: session.conversationRef,
        requestRef,
        message: text,
        state: session.state,
      });
    } catch {
      await this.dependencies.repository.appendAudit({
        sessionId: session.id,
        requestRef,
        eventType: 'vulnerability_provider_failed',
        reasonCode: 'vulnerability_provider_failed',
        payload: {},
      });

      return {
        route: true,
        reasonCode: 'vulnerability_provider_failed',
        text: 'I cannot complete the safety check right now. Please share these details and the support team will help.',
        auditEvents: ['vulnerability_provider_failed'],
      };
    }

    const reasonCode =
      result.reasonCode ??
      (result.isVulnerable || result.routeToHuman
        ? 'vulnerability_detected'
        : 'no_vulnerability_detected');
    await this.dependencies.repository.appendAudit({
      sessionId: session.id,
      requestRef,
      eventType: 'vulnerability_checked',
      reasonCode,
      payload: {
        confidence: result.confidence,
        signals: result.signals,
        routeToHuman: result.routeToHuman,
      },
    });

    if (result.isVulnerable || result.routeToHuman || result.confidence < 0.7) {
      return {
        route: true,
        reasonCode:
          result.reasonCode ??
          (result.confidence < 0.7 ? 'vulnerability_uncertain' : 'vulnerability_detected'),
        text: 'I want to make sure this is handled carefully. Please share these details and the support team will take it from here.',
        auditEvents: ['vulnerability_checked'],
      };
    }

    return { route: false, auditEvents: ['vulnerability_checked'], reasonCode };
  }

  private async retrieveGrounding(
    session: ChatSessionRecord,
    requestRef: string,
    text: string,
  ): Promise<GroundingDecision> {
    let result: RetrievalResult;
    try {
      result = await this.dependencies.ragProvider.retrieve({
        conversationRef: session.conversationRef,
        requestRef,
        message: text,
        state: session.state,
      });
    } catch {
      await this.dependencies.repository.appendAudit({
        sessionId: session.id,
        requestRef,
        eventType: 'retrieval_failed',
        reasonCode: 'rag_provider_failed',
        payload: {},
      });

      return {
        grounded: false,
        result: {
          answerable: false,
          grounded: false,
          citations: [],
          reasonCode: 'rag_provider_failed',
        },
        reasonCode: 'rag_provider_failed',
        auditEvents: ['retrieval_failed'],
      };
    }

    const reasonCode = result.reasonCode ?? 'grounded_retrieval';
    await this.dependencies.repository.appendAudit({
      sessionId: session.id,
      requestRef,
      eventType: 'retrieval_completed',
      reasonCode,
      payload: {
        answerable: result.answerable,
        grounded: result.grounded,
        citationCount: result.citations.length,
        score: result.score ?? null,
      },
    });

    return {
      grounded: result.answerable && result.grounded && result.citations.length > 0,
      result,
      reasonCode: result.reasonCode ?? 'ungrounded_retrieval',
      auditEvents: ['retrieval_completed'],
    };
  }

  private async classifyAction(
    session: ChatSessionRecord,
    requestRef: string,
    text: string,
    retrieval: GroundingDecision,
  ): Promise<ClassifierDecision> {
    let result: ClassifierResult;
    try {
      result = await this.dependencies.modelProvider.classifyAction({
        conversationRef: session.conversationRef,
        requestRef,
        message: text,
        state: session.state,
        retrieval: retrieval.result,
        allowedActions: [...allowedActions],
      });
    } catch {
      await this.dependencies.repository.appendAudit({
        sessionId: session.id,
        requestRef,
        eventType: 'classifier_failed',
        reasonCode: 'classifier_provider_failed',
        payload: {},
      });

      return {
        routeToFallback: true,
        reasonCode: 'classifier_provider_failed',
        text: 'I cannot classify that request safely right now. I can connect you with support instead.',
        auditEvents: ['classifier_failed'],
      };
    }

    await this.dependencies.repository.appendAudit({
      sessionId: session.id,
      requestRef,
      eventType: 'action_classified',
      reasonCode: result.reasonCode,
      payload: {
        action: result.action,
        confidence: result.confidence,
        requiresGrounding: result.requiresGrounding,
      },
    });

    if (result.action === 'answer') {
      return { result, auditEvents: ['action_classified'] };
    }

    if (
      ['collect', 'request_handoff_intake', 'create_ticket', 'escalate'].includes(result.action)
    ) {
      return {
        result,
        routeToHandoff: true,
        reasonCode: result.reasonCode,
        text: 'That request needs the support team. Please share these details and they will take it from here.',
        auditEvents: ['action_classified'],
      };
    }

    return {
      result,
      routeToFallback: true,
      reasonCode: result.reasonCode,
      text:
        result.action === 'refuse'
          ? 'I cannot help with that request, but I can answer general Loanslam support questions.'
          : 'I cannot answer that safely from the approved Loanslam information. I can connect you with support instead.',
      auditEvents: ['action_classified'],
    };
  }

  private async answerGrounded(
    session: ChatSessionRecord,
    requestRef: string,
    correlationRef: string,
    csrfToken: string,
    text: string,
    retrieval: GroundingDecision,
    classifier: { classifier: ClassifierResult | undefined; auditEvents: string[] },
  ): Promise<ChatResponse> {
    const citations = retrieval.result.citations;
    const reasonCode = classifier.classifier?.reasonCode ?? retrieval.reasonCode;

    let answer: Awaited<ReturnType<ModelProvider['generateAnswer']>>;
    try {
      answer = await this.dependencies.modelProvider.generateAnswer({
        conversationRef: session.conversationRef,
        requestRef,
        message: text,
        retrieval: retrieval.result,
        citations,
      });
    } catch {
      return this.routeToFallback({
        session,
        requestRef,
        correlationRef,
        csrfToken,
        reasonCode: 'answer_provider_failed',
        text: 'I cannot generate that answer safely right now. I can connect you with support instead.',
        auditEvents: [...classifier.auditEvents, 'answer_provider_failed'],
      });
    }

    if (answer.reasonCode === 'safe_fallback') {
      return this.routeToFallback({
        session,
        requestRef,
        correlationRef,
        csrfToken,
        reasonCode: 'safe_fallback',
        text: answer.text,
        auditEvents: classifier.auditEvents,
      });
    }

    const message = createAssistantMessage(answer.text, answer.reasonCode, citations);
    await this.dependencies.repository.updateSessionState(session.id, 'active', {
      reasonCode: answer.reasonCode,
    });
    await this.appendOutbound(session.id, requestRef, message, {
      reasonCode: answer.reasonCode,
      citations: citations.map((citation) => citation.sourceId),
    });
    await this.dependencies.repository.appendAudit({
      sessionId: session.id,
      requestRef,
      eventType: 'message_routed',
      reasonCode: answer.reasonCode,
      payload: {
        state: 'active',
        citationCount: citations.length,
      },
    });

    return {
      conversationRef: session.conversationRef,
      requestRef,
      correlationRef,
      csrfToken,
      state: 'active',
      messages: [message],
      audit: createAudit(
        [...classifier.auditEvents, 'message_routed'],
        [reasonCode, answer.reasonCode],
      ),
    };
  }

  private async routeToHandoff(input: RouteResponseInput): Promise<ChatResponse> {
    await this.dependencies.repository.updateSessionState(
      input.session.id,
      'awaiting_handoff_intake',
      {
        reasonCode: input.reasonCode,
      },
    );
    const message = createAssistantMessage(input.text, input.reasonCode);
    await this.appendOutbound(input.session.id, input.requestRef, message, {
      state: 'awaiting_handoff_intake',
      reasonCode: input.reasonCode,
    });
    await this.dependencies.repository.appendAudit({
      sessionId: input.session.id,
      requestRef: input.requestRef,
      eventType: 'message_routed',
      reasonCode: input.reasonCode,
      payload: { state: 'awaiting_handoff_intake' },
    });

    return {
      conversationRef: input.session.conversationRef,
      requestRef: input.requestRef,
      correlationRef: input.correlationRef,
      csrfToken: input.csrfToken,
      state: 'awaiting_handoff_intake',
      messages: [message],
      form: handoffForm,
      audit: createAudit([...input.auditEvents, 'message_routed'], [input.reasonCode]),
    };
  }

  private async routeToFallback(input: RouteResponseInput): Promise<ChatResponse> {
    await this.dependencies.repository.updateSessionState(input.session.id, 'safe_fallback', {
      reasonCode: input.reasonCode,
    });
    const message = createAssistantMessage(input.text, input.reasonCode);
    await this.appendOutbound(input.session.id, input.requestRef, message, {
      state: 'safe_fallback',
      reasonCode: input.reasonCode,
    });
    await this.dependencies.repository.appendAudit({
      sessionId: input.session.id,
      requestRef: input.requestRef,
      eventType: 'message_routed',
      reasonCode: input.reasonCode,
      payload: { state: 'safe_fallback' },
    });

    return {
      conversationRef: input.session.conversationRef,
      requestRef: input.requestRef,
      correlationRef: input.correlationRef,
      csrfToken: input.csrfToken,
      state: 'safe_fallback',
      messages: [message],
      audit: createAudit([...input.auditEvents, 'message_routed'], [input.reasonCode]),
    };
  }

  private appendOutbound(
    sessionId: string,
    requestRef: string,
    message: ChatMessage,
    metadata: JsonObject,
  ): Promise<unknown> {
    return this.dependencies.repository.appendTranscript({
      sessionId,
      requestRef,
      direction: 'outbound',
      role: 'assistant',
      content: message.text,
      metadata: {
        ...metadata,
        messageId: message.id,
      },
    });
  }
}

interface RouteDecision {
  route: boolean;
  reasonCode: string;
  text?: string;
  auditEvents: string[];
}

interface GroundingDecision {
  grounded: boolean;
  result: RetrievalResult;
  reasonCode: string;
  auditEvents: string[];
}

interface ClassifierDecision {
  result?: ClassifierResult;
  routeToHandoff?: boolean;
  routeToFallback?: boolean;
  reasonCode?: string;
  text?: string;
  auditEvents: string[];
}

interface RouteResponseInput {
  session: ChatSessionRecord;
  requestRef: string;
  correlationRef: string;
  csrfToken: string;
  reasonCode: string;
  text: string;
  auditEvents: string[];
}

function parseSendMessageRequest(request: unknown): SendMessageRequest {
  const parsed = sendMessageRequestSchema.safeParse(request);
  if (!parsed.success) {
    throw new ChatServiceError(400, 'invalid_request', 'Invalid request');
  }

  return parsed.data;
}

function parseIntakeRequest(request: unknown): IntakeSubmitRequest {
  const parsed = intakeSubmitRequestSchema.safeParse(request);
  if (!parsed.success) {
    throw new ChatServiceError(400, 'invalid_request', 'Invalid request');
  }

  return parsed.data;
}

function parseStoredChatResponse(payload: JsonObject): ChatResponse {
  return chatResponseSchema.parse(payload);
}

function toJsonObject(value: unknown): JsonObject {
  const parsed: unknown = JSON.parse(JSON.stringify(value));
  if (!isJsonObject(parsed)) {
    throw new Error('Expected response payload to be a JSON object');
  }

  return parsed;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createAssistantMessage(
  text: string,
  reasonCode: string,
  citations?: GroundingCitation[],
): ChatMessage {
  const message: ChatMessage = {
    id: createRef('msg'),
    role: 'assistant',
    text,
    createdAt: new Date().toISOString(),
    reasonCode,
  };

  if (citations && citations.length > 0) {
    message.citations = citations;
  }

  return message;
}

function createAudit(events: string[], reasonCodes: string[]): ChatAudit {
  return {
    events: Array.from(new Set(events)),
    reasonCodes: Array.from(new Set(reasonCodes)),
  };
}

function createTicketConfirmationCopy(status: string): string {
  if (status === 'failed') {
    return 'Thanks. I recorded your details, but could not send them to support automatically. Please contact Loanslam support directly so they can pick this up.';
  }

  return 'Thanks. Your details have been sent to support and someone will pick this up from here.';
}

function createRef(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll('-', '')}`;
}

export function createCsrfToken(): string {
  return createRef('csrf');
}

export function hashCsrfToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function verifyCsrfToken(token: string, expectedHash: string): boolean {
  return hashCsrfToken(token) === expectedHash;
}
