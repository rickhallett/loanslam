import type {
  IpocAccountQuestion,
  IpocChatMessage,
} from "../models/ipoc.model";
import type {
  IpocMockCustomerRecord,
  IpocSession,
} from "../stores/ipocSession.store";
import {
  appendMessage,
  getMockCustomerByLoanReference,
  recordSessionActivity,
} from "../stores/ipocSession.store";

const customerQuestions: Record<IpocAccountQuestion, string> = {
  nextPaymentDate: "What's my next payment date?",
  outstandingBalance: "What's my outstanding balance?",
  loanStatus: "What's my loan status?",
};

export type IpocAccountAnswerResult =
  | {
      ok: true;
      question: IpocAccountQuestion;
      answer: string;
      messages: IpocChatMessage[];
    }
  | { ok: false; reason: "no_demo_match" | "demo_record_missing" };

export function answerIpocAccountQuestion({
  session,
  question,
}: {
  session: IpocSession;
  question: IpocAccountQuestion;
}): IpocAccountAnswerResult {
  if (!session.matchedLoanReference) {
    return { ok: false, reason: "no_demo_match" };
  }

  const record = getMockCustomerByLoanReference(session.matchedLoanReference);

  if (!record) {
    return { ok: false, reason: "demo_record_missing" };
  }

  const answer = renderAccountAnswer(question, record);

  recordSessionActivity(
    session,
    "account_answer",
    `Answered ${question} from demo record ${record.loanReference}.`,
  );
  appendMessage(session, {
    role: "customer",
    content: customerQuestions[question],
  });
  appendMessage(session, { role: "assistant", content: answer });

  return { ok: true, question, answer, messages: session.messages };
}

function renderAccountAnswer(
  question: IpocAccountQuestion,
  record: IpocMockCustomerRecord,
): string {
  switch (question) {
    case "nextPaymentDate":
      return `Your next demo payment for ${record.loanReference} is due on ${record.nextPaymentDate}.`;
    case "outstandingBalance":
      return `Your demo outstanding balance for ${record.loanReference} is ${record.outstandingBalance}.`;
    case "loanStatus":
      return `Your demo loan ${record.loanReference} is currently ${record.loanStatus}.`;
  }
}
