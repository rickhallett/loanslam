import { createError, readBody } from "h3";

import type {
  IpocSendMessageRequest,
  IpocSendMessageResponse,
} from "../../../../../shared/ipoc";
import {
  IpocEngineConfigurationError,
  maybeBuildTicketFromTurn,
  runIpocTurn,
} from "../../../../utils/engineAdapter";
import { buildTurnTelemetry } from "../../../../utils/turnTelemetry";
import {
  appendMessage,
  getIpocSession,
  saveIpocTicket,
} from "../../../../utils/ipocStore";

export default defineEventHandler(async (event): Promise<IpocSendMessageResponse> => {
  const conversationRef = getRouterParam(event, "conversationRef");

  if (!conversationRef) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing conversation reference.",
    });
  }

  const session = getIpocSession(conversationRef);

  if (!session) {
    throw createError({
      statusCode: 404,
      statusMessage: `Session ${conversationRef} was not found.`,
    });
  }

  const body = await readBody<IpocSendMessageRequest>(event);
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!message) {
    throw createError({
      statusCode: 400,
      statusMessage: "Message is required.",
    });
  }

  appendMessage(session, { role: "customer", content: message });

  try {
    const result = await runIpocTurn({ session, message });
    appendMessage(session, {
      role: "assistant",
      content: result.customerMessage,
    });

    const ticket = maybeBuildTicketFromTurn({ result });

    if (ticket) {
      saveIpocTicket(ticket);
    }

    return {
      conversationRef,
      messages: session.messages,
      assistant: {
        message: result.customerMessage,
        ui: result.ui,
        finalAction: result.finalAction,
        requestedFields: [...result.state.requestedFields],
        safetyFlags: [...result.trace.safetyFlags],
        telemetry: buildTurnTelemetry({
          result,
          turn: session.traces.length,
        }),
      },
      ticket,
    };
  } catch (error) {
    if (error instanceof IpocEngineConfigurationError) {
      throw createError({
        statusCode: 503,
        statusMessage: error.message,
      });
    }

    throw error;
  }
});
