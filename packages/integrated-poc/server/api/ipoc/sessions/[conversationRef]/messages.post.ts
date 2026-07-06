import { createError, readBody } from "h3";

import type {
  IpocSendMessageRequest,
  IpocSendMessageResponse,
} from "../../../../domains/ipoc/models/ipoc.model";
import {
  IpocEngineConfigurationError,
} from "../../../../utils/engineAdapter";
import { processIpocTurn } from "../../../../domains/ipoc/services/ipocTurn.service";
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

    try {
      const { result, ticket } = await processIpocTurn({ session, message });

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
