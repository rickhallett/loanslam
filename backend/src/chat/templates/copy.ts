import type { KbLink } from '@loanslam/contracts';

/**
 * Approved, deterministic customer-facing copy catalog.
 *
 * Every string here is template copy — it carries NO regulated facts (rates,
 * amounts, dates, policy, eligibility, outcomes). Grounded facts only ever
 * reach the customer via a `mode: 'answer'` reply phrased from the approved KB
 * (brief §11, §16). Tone is calm, plain, supportive UK financial-services voice.
 *
 * The support links below are approved resources taken from the synthetic KB
 * (StepChange and MoneyHelper) and are the only third-party signposts the bot
 * surfaces. Phone numbers are included as approved copy.
 */

/** Approved free debt-advice signposts (from the KB). */
export const APPROVED_SUPPORT_LINKS: readonly KbLink[] = [
  { label: 'StepChange (free debt advice) — 0800 138 1111', href: 'https://www.stepchange.org' },
  {
    label: 'MoneyHelper (free, impartial money guidance) — 0800 138 7777',
    href: 'https://www.moneyhelper.org.uk/debt-advice-locator',
  },
];

/** Return a fresh, mutable copy of the approved support links. */
export function approvedSupportLinks(): KbLink[] {
  return APPROVED_SUPPORT_LINKS.map((l) => ({ ...l }));
}

/** Opening greeting shown when a session is created. */
export function greeting(): string {
  return [
    "Hi, and welcome to Loanslam support.",
    "I can help with general questions about how things work here, and I can put you in touch with our team when you need something account-specific.",
    "What can I help you with today?",
  ].join(' ');
}

/** Ask the customer to say a little more so we can route safely. */
export function clarify(): string {
  return [
    "I want to make sure I point you in the right direction.",
    "Could you tell me a little more about what you're trying to do?",
  ].join(' ');
}

/** Safe fallback when nothing grounds an answer. */
export function fallback(): string {
  return [
    "I'm not able to answer that one reliably from here, and I don't want to guess.",
    "I can connect you with a member of our team who can help — would you like me to do that?",
  ].join(' ');
}

/**
 * Decline a public-but-excluded topic (e.g. rate/APR questions). Points to the
 * application route / team and NEVER quotes the excluded fact.
 */
export function refusalExcluded(): string {
  return [
    "That's not something I can give you a figure for here — it depends on your individual circumstances and isn't decided in this chat.",
    "The most accurate way to get this is through a formal application or by speaking with our team, who can look at it properly for you.",
  ].join(' ');
}

/**
 * Empathetic escalation copy for a vulnerability / distress signal. Carries no
 * regulated advice; signposts approved free, impartial support and confirms a
 * person will follow up.
 */
export function vulnerabilityEscalation(): { text: string; links: KbLink[] } {
  return {
    text: [
      "Thank you for telling me — that can't be easy, and you've done the right thing by reaching out.",
      "I'm going to pass this to a member of our team so a person can help you properly. They'll be in touch.",
      "In the meantime, you can also get free, impartial advice from the services below.",
    ].join(' '),
    links: approvedSupportLinks(),
  };
}

/** Lead-in copy when we need to collect handoff details. */
export function accountIntakePrompt(): string {
  return [
    "That one needs a person on our team to look into it with you — I'm not able to access account details from here.",
    "If you share a few contact details below, I'll pass them on so the right person can get in touch.",
  ].join(' ');
}

/** Confirmation copy once a handoff ticket has been created. */
export function handoffConfirmation(ticketRef: string | null): string {
  const refSentence =
    ticketRef !== null && ticketRef.length > 0
      ? `Your reference is ${ticketRef} — please keep it handy.`
      : 'A member of our team will follow up with you.';
  return [
    "Thanks — I've passed this to our team.",
    refSentence,
    "There's nothing more you need to do for now.",
  ].join(' ');
}

/** Acknowledge a duplicate / retried message without reprocessing it. */
export function duplicateAck(): string {
  return "I've already got that one — no need to send it again. Is there anything else I can help with?";
}

/**
 * Wrap a slot elicitation prompt with a light acknowledgement of what just
 * happened, for the conversational collection path. `prompt` is approved
 * deterministic copy from the journey's slot schema.
 */
export function collectAck(prompt: string, kind: 'asked' | 'filled' | 'corrected'): string {
  const lead =
    kind === 'corrected'
      ? "Thanks, I've updated that."
      : kind === 'filled'
        ? 'Thanks.'
        : '';
  return lead.length > 0 ? `${lead} ${prompt}` : prompt;
}
