import type {
  ClassificationInput,
  PhraseInput,
  VulnerabilityInput,
} from '../ports/model.port.js';
import type { ConversationMessage } from '../domain/conversation.js';

/**
 * Prompt builders for the three model calls. The vulnerability and classify
 * prompts demand STRICT JSON matching a small, named schema so the adapter can
 * validate before trusting. The phrase prompt is tone-only and explicitly
 * forbidden from adding any fact not already in the approved text.
 *
 * Each builder returns an OpenAI chat `messages` array (system + user).
 */
export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

/** Trim conversation history to the most recent N turns, oldest first. */
function recentHistory(history: ConversationMessage[], max = 8): string {
  const tail = history.slice(-max);
  if (tail.length === 0) return '(no prior messages)';
  return tail.map((m) => `${m.role}: ${m.content}`).join('\n');
}

// ── Vulnerability ────────────────────────────────────────────────────────────

/**
 * The exact JSON shape the vulnerability model must return. Documented inline so
 * the prompt and the adapter's validator stay in lockstep.
 *   { "vulnerable": boolean,
 *     "category": "financial_difficulty" | "distress" | "complaint"
 *               | "legal" | "accessibility" | null,
 *     "confidence": number (0..1) }
 */
export function buildVulnerabilityPrompt(input: VulnerabilityInput): ChatMessage[] {
  const system = [
    'You are a safety classifier for a UK consumer-loans support chat.',
    'Detect genuine vulnerability or escalation signals in the latest customer',
    'message, using the conversation so far for context. Signals are:',
    '- financial_difficulty: the customer says they are struggling, behind, cannot',
    '  afford or cannot make a payment, or fears they will fall into hardship.',
    '- distress: emotional distress, panic, hopelessness, or any self-harm signal.',
    '- complaint: a formal complaint, dissatisfaction they want escalated, or an',
    '  Ombudsman reference.',
    '- legal: legal threats or references to solicitors/court action.',
    '- accessibility: a disability, accessibility, or language-support need.',
    '',
    'IMPORTANT — do NOT flag neutral, informational questions as vulnerability,',
    'even when they mention money, payments, rates, or debt. Asking what the APR',
    'or interest is, how much something costs, what the eligibility criteria are,',
    'how long a payout takes, or how repayments work is NOT a vulnerability signal.',
    'Only flag a message that expresses actual difficulty, distress, complaint,',
    'legal threat, or an accessibility need.',
    '',
    'Examples:',
    '- "what APR will I pay?" -> {"vulnerable": false, "category": null}',
    '- "how do I make my monthly repayments?" -> {"vulnerable": false, "category": null}',
    '- "how much can I borrow?" -> {"vulnerable": false, "category": null}',
    '- "I can\'t pay this month" -> {"vulnerable": true, "category": "financial_difficulty"}',
    '- "I\'m really struggling and worried about money" -> {"vulnerable": true, "category": "distress"}',
    '- "I want to raise a complaint to the ombudsman" -> {"vulnerable": true, "category": "complaint"}',
    '',
    'Respond with STRICT JSON only — no prose, no markdown, no code fences.',
    'Schema:',
    '{',
    '  "vulnerable": boolean,',
    '  "category": "financial_difficulty" | "distress" | "complaint" | "legal" | "accessibility" | null,',
    '  "confidence": number   // 0 to 1',
    '}',
    'If the message expresses genuine difficulty/distress/complaint/legal/',
    'accessibility — OR you are genuinely unsure whether it does — return',
    'vulnerable=true; routing a real signal to a human is the safe default. A plain',
    'factual question about rates, costs, eligibility, timescales, or process is not',
    'a signal and must return vulnerable=false.',
  ].join('\n');

  const user = [
    'Conversation so far:',
    recentHistory(input.history),
    '',
    'Latest customer message:',
    input.text,
    '',
    'Return the JSON verdict now.',
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

// ── Classification ───────────────────────────────────────────────────────────

/**
 * The exact JSON shape the classifier must return.
 *   { "action": "answer" | "clarify" | "handoff_account_specific"
 *             | "change_request" | "excluded_topic" | "fallback" | "refusal",
 *     "customerGoal": string | null,
 *     "confidence": number (0..1) }
 */
export function buildClassificationPrompt(input: ClassificationInput): ChatMessage[] {
  const { retrieval } = input;
  const system = [
    'You route a UK consumer-loans support chat to the SAFEST next action.',
    'You never invent facts; you only propose where the turn should go.',
    'Bias toward safe routing over confident automation.',
    '',
    'Use the retrieval signal as your primary evidence:',
    '- A high-scoring "answer" hit means a grounded answer is likely available -> "answer".',
    '- A "handoff_account_specific" hit means the customer needs their real account data -> "handoff_account_specific".',
    '- An "excluded" hit means the topic is public but must not be served (e.g. APR) -> "excluded_topic".',
    '- A "route_vulnerability" hit is a safety signal -> "handoff_account_specific".',
    '- A low score, or nothing matched, means you cannot ground an answer -> "clarify" (if intent is unclear) or "fallback".',
    '',
    'Override to "change_request" if the customer asks to cancel, withdraw, change,',
    'or close their application or account — those need a human regardless of retrieval.',
    '',
    'Respond with STRICT JSON only — no prose, no markdown, no code fences.',
    'Schema:',
    '{',
    '  "action": "answer" | "clarify" | "handoff_account_specific" | "change_request" | "excluded_topic" | "fallback" | "refusal",',
    '  "customerGoal": string | null,   // one short line summarising what the customer wants',
    '  "confidence": number             // 0 to 1',
    '}',
  ].join('\n');

  const user = [
    'Conversation so far:',
    recentHistory(input.history),
    '',
    'Latest customer message:',
    input.text,
    '',
    'Retrieval signal (top hit):',
    `  servingMode: ${retrieval.topServingMode ?? 'none'}`,
    `  score: ${retrieval.topScore.toFixed(3)}`,
    `  question: ${retrieval.topQuestion ?? 'none'}`,
    '',
    'Return the JSON classification now.',
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

// ── Phrasing ─────────────────────────────────────────────────────────────────

/**
 * Tone-only rephrasing of an APPROVED answer. The model must add NO facts,
 * figures, links, or commitments not present in the approved text. If it cannot
 * comply, it returns the approved text unchanged. The adapter still treats an
 * empty/unsafe result as a failure and routes to fallback.
 */
export function buildPhrasePrompt(input: PhraseInput): ChatMessage[] {
  const system = [
    'You rephrase an APPROVED support answer for tone and clarity only.',
    'This is a regulated UK consumer-loans context. Strict rules:',
    '- Do NOT add, change, or remove any fact, figure, rate, amount, date, link,',
    '  policy, eligibility, or commitment. Only the approved text may carry facts.',
    '- Do NOT introduce anything not present in the approved text.',
    '- Keep it warm, plain, and concise.',
    '- If you cannot rephrase without changing meaning, return the approved text UNCHANGED.',
    '',
    'Respond with the rephrased answer as plain text only — no quotes, no markdown,',
    'no preamble, no commentary.',
  ].join('\n');

  const user = [
    'Customer message (for tone context only — do not answer it directly):',
    input.customerText,
    '',
    'Approved answer text to rephrase:',
    input.groundedAnswerText,
    '',
    'Return the rephrased answer now.',
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
