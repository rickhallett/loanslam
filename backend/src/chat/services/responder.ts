import type { Citation, Reply } from '@loanslam/contracts';
import type { ModelAdapter } from '../../ports/model.port.js';
import type { ConversationMessage } from '../../domain/conversation.js';
import type { RoutingDecision } from './router.js';
import { accountHandoffForm } from './intake.js';
import { isFaithful } from './faithfulness.js';
import * as copy from '../templates/copy.js';

/** Context the responder needs to phrase a reply. */
export interface ResponderContext {
  model: ModelAdapter;
  customerText: string;
  history: ConversationMessage[];
}

/**
 * Build the customer-facing Reply for a routing decision. Only `mode: 'answer'`
 * carries KB facts, and it MUST carry at least one citation (build-spec). Every
 * other mode is deterministic template copy or a handoff. If the model declines
 * to phrase a grounded answer, the turn downgrades safely to fallback.
 */
export async function buildReply(
  decision: RoutingDecision,
  ctx: ResponderContext,
): Promise<Reply> {
  switch (decision.replyMode) {
    case 'answer': {
      const topHit = decision.topHit;
      // Grounding gate should guarantee these, but guard rather than trust.
      if (topHit === null || topHit.answerText === null) {
        return { mode: 'fallback', text: copy.fallback() };
      }

      const phrased = await ctx.model.phraseAnswer({
        customerText: ctx.customerText,
        groundedAnswerText: topHit.answerText,
        history: ctx.history,
      });

      // Model could not phrase, or the phrasing introduced a fact not present in
      // the approved text -> route safely instead of emitting an unverified
      // regulated fact (brief §11, §16). The faithfulness gate applies to every
      // model, so the deterministic adapter (faithful by construction) passes.
      if (phrased === null || !isFaithful(topHit.answerText, phrased)) {
        return { mode: 'fallback', text: copy.fallback() };
      }

      const citation: Citation = {
        itemId: topHit.itemId,
        question: topHit.question,
        score: topHit.score,
      };
      return {
        mode: 'answer',
        text: phrased,
        citations: [citation],
        links: topHit.links.map((l) => ({ ...l })),
      };
    }

    case 'intake_request':
      return {
        mode: 'intake_request',
        text: copy.accountIntakePrompt(),
        form: accountHandoffForm(),
      };

    case 'vulnerability': {
      const vuln = copy.vulnerabilityEscalation();
      return {
        mode: 'vulnerability',
        text: vuln.text,
        links: vuln.links,
        ticketRef: null,
      };
    }

    case 'refusal':
      return { mode: 'refusal', text: copy.refusalExcluded() };

    case 'clarify':
      return { mode: 'clarify', text: copy.clarify() };

    case 'handoff':
      return { mode: 'handoff', text: copy.handoffConfirmation(null), ticketRef: null };

    case 'fallback':
    default:
      return { mode: 'fallback', text: copy.fallback() };
  }
}
