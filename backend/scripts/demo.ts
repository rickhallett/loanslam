/**
 * Flagship demo. Drives the ChatService pipeline in-process through every
 * customer journey, then prints the transcript and the full audit trail for
 * each conversation — the visible proof of the safety boundary and the
 * non-negotiable auditability requirement. Run with `just demo` / `npm run demo`.
 *
 * Persistence defaults to a clean file-backed store; AI uses the OpenAI-
 * compatible path when OPENAI_API_KEY is set, otherwise the deterministic
 * fallback (the demo runs either way).
 */
import { rmSync } from 'node:fs';

// Set env BEFORE importing the composition root (config is read at import time).
process.env.PERSISTENCE ??= 'memory';
process.env.DATA_DIR ??= './.data/demo';
process.env.LOG_LEVEL ??= 'silent';

// Clean the demo store so the printed audit trail is just this run.
try {
  rmSync(process.env.DATA_DIR, { recursive: true, force: true });
} catch {
  /* ignore */
}

const { buildChatService } = await import('../src/composition/composition.js');
const { newRequestRef } = await import('../src/common/ids.js');

type Outcome = Awaited<ReturnType<Awaited<ReturnType<typeof buildChatService>>['chatService']['handleMessage']>>;

const ctx = (): { requestRef: string } => ({ requestRef: newRequestRef() });

const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';

const modeColour: Record<string, string> = {
  answer: GREEN,
  clarify: CYAN,
  fallback: YELLOW,
  refusal: YELLOW,
  handoff: MAGENTA,
  vulnerability: RED,
  intake_request: MAGENTA,
};

function printReply(outcome: Outcome): { conversationRef: string; formId: string | null } {
  const obj = outcome.response.responseObject;
  if (!obj) {
    console.log(`${RED}  [no response: ${outcome.response.message}]${RESET}`);
    return { conversationRef: '', formId: null };
  }
  const reply = obj.reply;
  const colour = modeColour[reply.mode] ?? '';
  console.log(`  ${BOLD}bot${RESET} ${colour}[${reply.mode}]${RESET} ${reply.text}`);
  let formId: string | null = null;
  if (reply.mode === 'answer' && reply.citations.length > 0) {
    const cites = reply.citations.map((c) => `${c.itemId} (${c.score.toFixed(2)})`).join(', ');
    console.log(`      ${DIM}sources: ${cites}${RESET}`);
  }
  if (reply.mode === 'intake_request') {
    formId = reply.form.formId;
    const fields = reply.form.fields.map((f) => f.name + (f.required ? '*' : '')).join(', ');
    console.log(`      ${DIM}form ${reply.form.formId}: ${fields}${RESET}`);
  }
  if ((reply.mode === 'handoff' || reply.mode === 'vulnerability') && reply.ticketRef) {
    console.log(`      ${DIM}ticket: ${reply.ticketRef}${RESET}`);
  }
  if (reply.mode === 'vulnerability' && reply.links.length > 0) {
    console.log(`      ${DIM}support: ${reply.links.map((l) => l.label).join(', ')}${RESET}`);
  }
  return { conversationRef: obj.conversationRef, formId };
}

async function main(): Promise<void> {
  const { chatService, repos, config } = await buildChatService();
  console.log(
    `\n${BOLD}Loanslam chat widget — pipeline demo${RESET}  ${DIM}(AI ${config.ai.enabled ? `enabled: ${config.ai.model}` : 'disabled: deterministic'}, persistence: ${config.persistence}, threshold: ${config.groundingThreshold})${RESET}\n`,
  );

  interface Step {
    say?: string;
    intake?: Record<string, string>; // submit this intake instead of a message
  }
  interface Scenario {
    title: string;
    note: string;
    steps: Step[];
  }

  const scenarios: Scenario[] = [
    {
      title: '1. Grounded answer',
      note: 'Answered from the approved KB, phrased by the model, with a citation.',
      steps: [{ say: 'How much can I borrow with you?' }],
    },
    {
      title: '2. Conversational memory + clarify',
      note: 'Bot holds the thread across turns.',
      steps: [{ say: 'I have a question about my application' }, { say: 'how long does it take to get the money?' }],
    },
    {
      title: '3. Account-specific -> handoff with intake -> ticket',
      note: 'No account answers anonymously; collect handoff PII, create a ticket.',
      steps: [
        { say: "What's my current balance?" },
        { intake: { full_name: 'A. Customer', date_of_birth: '1990-01-01', email: 'a.customer@example.com', phone: '07700900000' } },
      ],
    },
    {
      title: '4. Change request -> handoff',
      note: 'Any change to a loan application routes to a human.',
      steps: [{ say: 'I want to cancel my loan application' }],
    },
    {
      title: '5. Vulnerability -> escalation + urgent ticket (pipeline stops)',
      note: 'Safety signal handled before normal routing; fails safe.',
      steps: [{ say: "I'm really struggling and I can't pay this month" }],
    },
    {
      title: '6. Excluded topic (APR) -> safe refusal, no rate quoted',
      note: 'Financial-promotions caution: never serve a rate.',
      steps: [{ say: 'what APR will I pay?' }],
    },
    {
      title: '7. Off-topic / noisy -> clarify or fallback, never invented',
      note: 'Uncertain input routes safely.',
      steps: [{ say: 'asdf qwerty hello??' }],
    },
  ];

  const conversationRefs: { title: string; ref: string }[] = [];

  for (const scenario of scenarios) {
    console.log(`${BOLD}${CYAN}${scenario.title}${RESET}`);
    console.log(`${DIM}${scenario.note}${RESET}`);

    const created = await chatService.createSession({}, ctx());
    const sessionId = created.setSessionId;
    if (!sessionId) {
      console.log(`${RED}failed to create session${RESET}\n`);
      continue;
    }
    let lastFormId: string | null = null;
    let conversationRef = created.response.responseObject?.conversationRef ?? '';

    let i = 0;
    for (const step of scenario.steps) {
      if (step.intake) {
        console.log(`  ${BOLD}customer${RESET} ${DIM}[submits intake form: ${Object.keys(step.intake).join(', ')}]${RESET}`);
        const outcome = await chatService.submitIntake(
          sessionId,
          { formId: lastFormId ?? 'account-handoff', values: step.intake },
          ctx(),
        );
        const r = printReply(outcome);
        if (r.conversationRef) conversationRef = r.conversationRef;
      } else {
        const text = step.say ?? '';
        console.log(`  ${BOLD}customer${RESET} ${text}`);
        const outcome = await chatService.handleMessage(
          sessionId,
          { clientMessageId: `${sessionId}-${i}`, text },
          ctx(),
        );
        const r = printReply(outcome);
        if (r.conversationRef) conversationRef = r.conversationRef;
        lastFormId = r.formId;
      }
      i += 1;
    }
    conversationRefs.push({ title: scenario.title, ref: conversationRef });
    console.log('');
  }

  // ── Audit evidence ─────────────────────────────────────────────────────────
  console.log(`${BOLD}Audit trail (the non-negotiable compliance requirement)${RESET}`);
  console.log(`${DIM}Every inbound and outbound message plus every routing decision is persisted and reviewable.${RESET}\n`);

  for (const { title, ref } of conversationRefs) {
    if (!ref) continue;
    const events = await repos.audit.listByConversation(ref);
    const transcript = await repos.transcripts.listByConversation(ref);
    const inbound = transcript.filter((t) => t.direction === 'inbound').length;
    const outbound = transcript.filter((t) => t.direction === 'outbound').length;
    console.log(`${BOLD}${title}${RESET} ${DIM}(${ref})${RESET}`);
    console.log(`  ${DIM}transcript: ${inbound} inbound / ${outbound} outbound messages${RESET}`);
    const line = events
      .map((e) => e.type + (e.reasonCode ? `:${e.reasonCode}` : ''))
      .join(' -> ');
    console.log(`  ${DIM}events:${RESET} ${line}`);
    console.log('');
  }

  console.log(`${GREEN}${BOLD}Demo complete.${RESET} ${DIM}Audit + transcript persisted under ${config.dataDir}.${RESET}\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
