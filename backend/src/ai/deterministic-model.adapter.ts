import type { IntakeFieldName } from '@loanslam/contracts';
import type {
  ClassificationInput,
  ClassificationResult,
  ExtractInput,
  ExtractResult,
  ExtractSignals,
  ModelAdapter,
  PhraseInput,
  ProposedAction,
  VulnerabilityInput,
  VulnerabilityVerdict,
} from '../ports/model.port.js';
import type { ConversationMessage } from '../domain/conversation.js';
import { looksLikeCredential } from '../domain/credentials.js';
import { config, type AppConfig } from '../config/env.js';

/**
 * Zero-network ModelAdapter. It is both the AI-disabled implementation and the
 * fallback the AI adapter delegates to when the model errors. It is rule-based
 * and conservative: every decision biases toward safe routing, never toward a
 * confident answer it cannot ground.
 */

interface CategoryRule {
  category: string;
  /** Lower-cased phrases; any hit flags the category. */
  phrases: string[];
}

/**
 * Vulnerability taxonomy. Order matters only for which category is reported
 * first; any match flags the turn vulnerable. distress is listed first so
 * self-harm wording is surfaced ahead of softer financial-difficulty wording.
 */
const VULNERABILITY_RULES: CategoryRule[] = [
  {
    category: 'distress',
    phrases: [
      'suicid',
      'kill myself',
      'end my life',
      'self harm',
      'self-harm',
      'harm myself',
      "can't go on",
      'cant go on',
      'no way out',
      'desperate',
      'hopeless',
      'depressed',
      "can't cope",
      'cant cope',
      'breaking down',
    ],
  },
  {
    category: 'financial_difficulty',
    phrases: [
      "can't pay",
      'cant pay',
      'cannot pay',
      "can't afford",
      'cant afford',
      'cannot afford',
      "can't repay",
      'cant repay',
      'struggling',
      'struggle to pay',
      'behind on',
      'fallen behind',
      'falling behind',
      'in arrears',
      'arrears',
      'missed a payment',
      'missed payment',
      'miss a payment',
      'no money',
      "can't make the payment",
      'cant make the payment',
      'difficulty paying',
      'financial difficulty',
      'lost my job',
      'redundant',
    ],
  },
  {
    category: 'complaint',
    phrases: [
      'complaint',
      'complain',
      'ombudsman',
      'fos',
      'mis-sold',
      'mis sold',
      'missold',
      'unhappy with',
      'unacceptable',
    ],
  },
  {
    category: 'legal',
    phrases: [
      'solicitor',
      'lawyer',
      'sue',
      'suing',
      'legal action',
      'take you to court',
      'court',
      'claims company',
      'small claims',
    ],
  },
  {
    category: 'accessibility',
    phrases: [
      'disab',
      'blind',
      'deaf',
      'hard of hearing',
      'screen reader',
      'cannot read',
      "can't read",
      'dyslex',
      'translator',
      'interpreter',
      "don't speak english",
      'dont speak english',
      'mental health',
      'learning difficulty',
    ],
  },
];

/** Keyword overrides that force a change_request regardless of retrieval. */
const CHANGE_REQUEST_PHRASES: string[] = [
  'cancel',
  'withdraw',
  'change my application',
  'change my loan',
  'close my account',
  'close my application',
  'delete my account',
  'stop my application',
];

/** Conversational signal phrases for the deterministic extractor (PRD §4.3). */
const CORRECTION_PHRASES: string[] = [
  'actually',
  'i meant',
  'correction',
  "that's wrong",
  'thats wrong',
  'change that',
  'not right',
  'mistake',
  'sorry, it',
];
const REFUSAL_PHRASES: string[] = [
  'rather not',
  'prefer not',
  "won't give",
  'wont give',
  "won't share",
  'wont share',
  "don't want to",
  'dont want to',
  'not comfortable',
  'no thanks',
  'not telling',
  'why do you need',
  'none of your',
  'not sharing',
];

// Slot-shape patterns. Each excludes credential shapes by construction: an email
// or YYYY-MM-DD date is never a card/sort/account; a phone requires 10-12 digits,
// so a 6-digit sort code or 8-digit account number cannot land as a phone.
const EMAIL_TOKEN_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const DOB_TOKEN_RE = /\b\d{4}-\d{2}-\d{2}\b/;
const PHONE_TOKEN_RE = /\+?\d[\d\s().-]{8,}\d/g;
// Reliable name triggers only — weak ones like "I'm"/"I am" over-extract
// ("I am struggling"), so they are deliberately excluded.
const NAME_TRIGGER_RE = /(?:my name is|my name's|name is|name's|i am called|i'm called|call me)\s+(.+)/i;
const NAME_STOPWORDS = new Set([
  'and',
  'but',
  'or',
  'so',
  'because',
  'my',
  'the',
  'to',
  'for',
  'please',
  'thanks',
  'thank',
]);

function normalise(text: string): string {
  return text.toLowerCase();
}

/** Extract a clean 1-3 token name after a reliable trigger, or null. */
function extractName(text: string): string | null {
  const m = text.match(NAME_TRIGGER_RE);
  if (!m || m[1] === undefined) return null;
  const tokens: string[] = [];
  for (const rawToken of m[1].trim().split(/\s+/)) {
    const hadPunct = /[.,!?;:]$/.test(rawToken);
    const clean = rawToken.replace(/[.,!?;:]+$/, '');
    if (!/^[a-z][a-z'’-]*$/i.test(clean)) break; // non-alphabetic -> name ended
    if (NAME_STOPWORDS.has(clean.toLowerCase())) break;
    tokens.push(clean);
    if (hadPunct || tokens.length >= 3) break; // a comma/period ends the phrase
  }
  if (tokens.length === 0) return null;
  const name = tokens.join(' ');
  return looksLikeCredential(name) ? null : name;
}

/** Build the searchable text: latest message plus recent history content. */
function searchText(text: string, history: ConversationMessage[], maxHistory = 6): string {
  const recent = history.slice(-maxHistory).map((m) => m.content);
  return normalise([...recent, text].join('\n'));
}

function firstClause(text: string, maxLen = 120): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return '';
  const clause = trimmed.split(/[.?!\n]/)[0] ?? trimmed;
  const out = clause.trim().length > 0 ? clause.trim() : trimmed;
  return out.length > maxLen ? `${out.slice(0, maxLen - 1)}…` : out;
}

export class DeterministicModelAdapter implements ModelAdapter {
  constructor(private readonly cfg: AppConfig = config) {}

  async detectVulnerability(input: VulnerabilityInput): Promise<VulnerabilityVerdict> {
    const haystack = searchText(input.text, input.history);
    for (const rule of VULNERABILITY_RULES) {
      const hit = rule.phrases.some((p) => haystack.includes(p));
      if (hit) {
        return {
          vulnerable: true,
          category: rule.category,
          confidence: 0.8,
          source: 'deterministic',
        };
      }
    }
    return { vulnerable: false, category: null, confidence: 0.9, source: 'deterministic' };
  }

  async classify(input: ClassificationInput): Promise<ClassificationResult> {
    const goal = this.deriveGoal(input);
    const haystack = searchText(input.text, input.history);

    // Change-request override wins regardless of retrieval (spec routing table).
    if (CHANGE_REQUEST_PHRASES.some((p) => haystack.includes(p))) {
      return { action: 'change_request', customerGoal: goal, confidence: 0.7, source: 'deterministic' };
    }

    const { topServingMode, topScore } = input.retrieval;
    const adequate = topScore >= this.cfg.groundingThreshold;
    const action = this.actionForRetrieval(topServingMode, adequate);
    // Confidence tracks the retrieval score for answerable hits; lower when we
    // are routing because nothing grounded.
    const confidence = topServingMode === null ? 0.3 : Math.min(0.95, Math.max(0.3, topScore));
    return { action, customerGoal: goal, confidence, source: 'deterministic' };
  }

  async phraseAnswer(input: PhraseInput): Promise<string | null> {
    // Faithful by construction: return the approved text unchanged.
    return input.groundedAnswerText;
  }

  async extract(input: ExtractInput): Promise<ExtractResult> {
    const requested = new Set<IntakeFieldName>(input.requestedSlots);
    const slots: Partial<Record<IntakeFieldName, string>> = {};
    const text = input.text;

    if (requested.has('email')) {
      const m = text.match(EMAIL_TOKEN_RE);
      if (m) {
        const email = m[0].replace(/[.,;:!?]+$/, ''); // drop trailing punctuation
        if (!looksLikeCredential(email)) slots.email = email;
      }
    }
    if (requested.has('date_of_birth')) {
      const m = text.match(DOB_TOKEN_RE);
      if (m) slots.date_of_birth = m[0];
    }
    if (requested.has('phone')) {
      // Scan ALL digit runs and take the first phone-shaped one (10-12 digits),
      // so a DOB or other short number earlier in the message is skipped.
      for (const raw of text.match(PHONE_TOKEN_RE) ?? []) {
        const candidate = raw.trim();
        const digits = candidate.replace(/\D/g, '');
        if (digits.length >= 10 && digits.length <= 12 && !looksLikeCredential(candidate)) {
          slots.phone = candidate;
          break;
        }
      }
    }
    if (requested.has('full_name')) {
      const name = extractName(text);
      if (name !== null) slots.full_name = name;
    }
    // address / context are free-text: left to the form fast-path and the model
    // extractor, not guessed deterministically.

    const haystack = normalise(text);
    const signals: ExtractSignals = {
      question: text.includes('?'),
      correction: CORRECTION_PHRASES.some((p) => haystack.includes(p)),
      refusal: REFUSAL_PHRASES.some((p) => haystack.includes(p)),
      offTopic: false, // deterministic rules can't reliably detect topic change
    };

    const extracted = Object.keys(slots).length > 0;
    const anySignal = signals.question || signals.correction || signals.refusal;
    const confidence = extracted ? 0.6 : anySignal ? 0.5 : 0.4;

    return { slots, signals, confidence, source: 'deterministic' };
  }

  private actionForRetrieval(topServingMode: string | null, adequate: boolean): ProposedAction {
    switch (topServingMode) {
      case 'answer':
        // A grounded answer only if the score clears the bar; otherwise clarify.
        return adequate ? 'answer' : 'clarify';
      case 'handoff_account_specific':
        return adequate ? 'handoff_account_specific' : 'clarify';
      case 'excluded':
        return adequate ? 'excluded_topic' : 'clarify';
      case 'route_vulnerability':
        // Map the KB's vulnerability disposition onto a human handoff. The
        // dedicated vulnerability gate runs first; this is a routing backstop.
        return 'handoff_account_specific';
      case null:
        // Nothing matched at all -> safe fallback.
        return 'fallback';
      default:
        // Unknown serving mode -> never guess; ask for clarification.
        return 'clarify';
    }
  }

  private deriveGoal(input: ClassificationInput): string | null {
    const fromQuestion = input.retrieval.topQuestion?.trim();
    if (fromQuestion && fromQuestion.length > 0) return fromQuestion;
    const clause = firstClause(input.text);
    return clause.length > 0 ? clause : null;
  }
}

/** Factory mirroring the manual-composition convention. */
export function createDeterministicModelAdapter(cfg: AppConfig = config): DeterministicModelAdapter {
  return new DeterministicModelAdapter(cfg);
}
