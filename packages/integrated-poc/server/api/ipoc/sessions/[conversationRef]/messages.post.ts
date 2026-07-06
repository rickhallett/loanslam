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
import { appendMessage, saveIpocTicket } from "../../../../utils/ipocStore";
import { requireIpocSession } from "../../../../utils/ipocRoute";
import { buildIpocTelemetry } from "../../../../utils/turnTelemetry";

export default defineEventHandler(
  async (event): Promise<IpocSendMessageResponse> => {
    const { conversationRef, session } = requireIpocSession(event);
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
          telemetry: buildIpocTelemetry({
            source: "turn",
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
  },
);
