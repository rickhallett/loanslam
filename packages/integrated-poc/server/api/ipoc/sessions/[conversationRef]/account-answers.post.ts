import { createError, readBody } from "h3";

import {
  ipocAccountQuestions,
  type IpocAccountAnswerRequest,
  type IpocAccountAnswerResponse,
  type IpocAccountQuestion,
} from "../../../../domains/ipoc/models/ipoc.model";
import {
  appendMessage,
  getMockCustomerByLoanReference,
  recordSessionActivity,
  type IpocMockCustomerRecord,
} from "../../../../domains/ipoc/stores/ipocSession.store";
import { requireIpocSession } from "../../../../utils/ipocRoute";

const customerQuestions: Record<IpocAccountQuestion, string> = {
  nextPaymentDate: "What's my next payment date?",
  outstandingBalance: "What's my outstanding balance?",
  loanStatus: "What's my loan status?",
};

export default defineEventHandler(
  async (event): Promise<IpocAccountAnswerResponse> => {
    const { conversationRef, session } = requireIpocSession(event);
    const body = await readBody<IpocAccountAnswerRequest>(event);
    const question = body?.question;

    if (!question || !ipocAccountQuestions.includes(question)) {
      throw createError({
        statusCode: 400,
        statusMessage: `question must be one of: ${ipocAccountQuestions.join(", ")}.`,
      });
    }

    if (!session.matchedLoanReference) {
      throw createError({
        statusCode: 403,
        statusMessage:
          "No matched demo record for this session. Complete the demo lookup first.",
      });
    }

    const record = getMockCustomerByLoanReference(session.matchedLoanReference);

    if (!record) {
      throw createError({
        statusCode: 404,
        statusMessage: "Matched demo record is no longer available.",
      });
    }

    const answer = renderAnswer(question, record);

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

    return {
      conversationRef,
      question,
      answer,
      messages: session.messages,
    };
  },
);

function renderAnswer(
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
