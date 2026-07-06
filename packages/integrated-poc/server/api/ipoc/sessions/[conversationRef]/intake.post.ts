import { createError, readBody } from "h3";

import {
  ipocHandoffFields,
  type IpocHandoffIntake,
  type IpocSubmitIntakeRequest,
  type IpocSubmitIntakeResponse,
} from "../../../../../shared/ipoc";
import {
  appendMessage,
  updateIpocTicketIntake,
} from "../../../../utils/ipocStore";
import { requireIpocSession } from "../../../../utils/ipocRoute";
import { buildIpocTelemetry } from "../../../../utils/turnTelemetry";

export default defineEventHandler(
  async (event): Promise<IpocSubmitIntakeResponse> => {
    const { conversationRef, session } = requireIpocSession(event);
    const body = await readBody<IpocSubmitIntakeRequest>(event);
    const ticketId =
      typeof body.ticketId === "string" ? body.ticketId.trim() : "";
    const validation = validateIntakeFields(body.fields);

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

    const ticket = updateIpocTicketIntake({
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

    appendMessage(session, {
      role: "assistant",
      content: `Demo handoff fields captured for ticket ${ticket.id}. A human agent can now read them back.`,
    });

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

type IntakeValidationResult =
  | { ok: true; fields: IpocHandoffIntake }
  | { ok: false; message: string };

function validateIntakeFields(
  fields: IpocSubmitIntakeRequest["fields"] | undefined,
): IntakeValidationResult {
  if (!fields || typeof fields !== "object") {
    return { ok: false, message: "Handoff fields are required." };
  }

  const normalized = {} as IpocHandoffIntake;

  for (const field of ipocHandoffFields) {
    const value = fields[field]?.trim() ?? "";

    if (!value) {
      return { ok: false, message: `${field} is required.` };
    }

    normalized[field] = value;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized.dateOfBirth)) {
    return {
      ok: false,
      message: "dateOfBirth must use YYYY-MM-DD for the demo form.",
    };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
    return { ok: false, message: "email must be a valid demo email address." };
  }

  const phoneDigits = normalized.phone.replace(/\D/g, "");

  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    return { ok: false, message: "phone must contain 10 to 15 digits." };
  }

  return { ok: true, fields: normalized };
}
