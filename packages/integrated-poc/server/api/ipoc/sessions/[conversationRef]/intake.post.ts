import { createError, readBody } from "h3";

import {
  type IpocSubmitIntakeRequest,
  type IpocSubmitIntakeResponse,
} from "../../../../domains/ipoc/models/ipoc.model";
import {
  captureIpocIntake,
  validateIpocIntakeFields,
} from "../../../../domains/ipoc/services/ipocIntake.service";
import { requireIpocSession } from "../../../../utils/ipocRoute";
import { buildIpocTelemetry } from "../../../../utils/turnTelemetry";

export default defineEventHandler(
  async (event): Promise<IpocSubmitIntakeResponse> => {
    const { conversationRef, session } = requireIpocSession(event);
    const body = await readBody<IpocSubmitIntakeRequest>(event);
    const ticketId =
      typeof body.ticketId === "string" ? body.ticketId.trim() : "";
    const validation = validateIpocIntakeFields(body.fields);

    if (!ticketId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Ticket id is required.",
      });
    }

    if (!validation.ok) {
      throw createError({
        statusCode: 400,
        statusMessage: validation.message,
      });
    }

    const ticket = captureIpocIntake({
      session,
      ticketId,
      conversationRef,
      fields: validation.fields,
    });

    if (!ticket) {
      throw createError({
        statusCode: 404,
        statusMessage: `Ticket ${ticketId} was not found for this session.`,
      });
    }

    return {
      conversationRef,
      messages: session.messages,
      ticket,
      telemetry: buildIpocTelemetry({
        source: "structured-intake",
        state: session.state,
        submittedFields: Object.keys(validation.fields),
        turn: session.traces.length,
      }),
    };
  },
);
