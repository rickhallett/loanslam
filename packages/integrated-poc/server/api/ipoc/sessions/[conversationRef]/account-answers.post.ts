import { createError, readBody } from "h3";

import {
  ipocAccountQuestions,
  type IpocAccountAnswerRequest,
  type IpocAccountAnswerResponse,
} from "../../../../domains/ipoc/models/ipoc.model";
import { answerIpocAccountQuestion } from "../../../../domains/ipoc/services/ipocAccount.service";
import { requireIpocSession } from "../../../../utils/ipocRoute";

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

    const result = answerIpocAccountQuestion({ session, question });

    if (!result.ok && result.reason === "no_demo_match") {
      throw createError({
        statusCode: 403,
        statusMessage:
          "No matched demo record for this session. Complete the demo lookup first.",
      });
    }

    if (!result.ok) {
      throw createError({
        statusCode: 404,
        statusMessage: "Matched demo record is no longer available.",
      });
    }

    return {
      conversationRef,
      question: result.question,
      answer: result.answer,
      messages: result.messages,
    };
  },
);
