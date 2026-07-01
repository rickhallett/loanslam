import { createError, readBody } from "h3";

import {
  ipocLookupFields,
  type IpocLookupFieldValues,
  type IpocLookupRequest,
  type IpocLookupResponse,
} from "../../../../../shared/ipoc";
import {
  appendMessage,
  findMockCustomer,
  getIpocSession,
  recordSessionActivity,
} from "../../../../utils/ipocStore";

export default defineEventHandler(
  async (event): Promise<IpocLookupResponse> => {
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

    const body = await readBody<IpocLookupRequest>(event);
    const validation = validateLookupFields(body?.fields);

    if (!validation.ok) {
      throw createError({
        statusCode: 400,
        statusMessage: validation.message,
      });
    }

    const record = findMockCustomer(validation.fields);

    if (!record) {
      session.matchedLoanReference = null;
      recordSessionActivity(
        session,
        "lookup_no_match",
        "Demo lookup did not match a record; no data disclosed.",
      );
      appendMessage(session, {
        role: "assistant",
        content:
          "I couldn't match those details to a demo record, so I can't share any account information. I can still connect you with a human agent through the standard support handoff.",
      });

      return {
        conversationRef,
        matched: false,
        customer: null,
        messages: session.messages,
      };
    }

    session.matchedLoanReference = record.loanReference;
    recordSessionActivity(
      session,
      "lookup_matched",
      `Matched demo record ${record.loanReference}.`,
    );
    appendMessage(session, {
      role: "assistant",
      content: `Thanks ${record.fullName}, I've matched demo record ${record.loanReference}. I can answer read-only demo questions about your next payment date, outstanding balance, or loan status.`,
    });

    return {
      conversationRef,
      matched: true,
      customer: {
        fullName: record.fullName,
        loanReference: record.loanReference,
      },
      messages: session.messages,
    };
  },
);

type LookupValidationResult =
  | { ok: true; fields: IpocLookupFieldValues }
  | { ok: false; message: string };

function validateLookupFields(
  fields: IpocLookupRequest["fields"] | undefined,
): LookupValidationResult {
  if (!fields || typeof fields !== "object") {
    return { ok: false, message: "Lookup fields are required." };
  }

  const normalized = {} as IpocLookupFieldValues;

  for (const field of ipocLookupFields) {
    const value = fields[field]?.trim() ?? "";

    if (!value) {
      return { ok: false, message: `${field} is required.` };
    }

    normalized[field] = value;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized.dateOfBirth)) {
    return {
      ok: false,
      message: "dateOfBirth must use YYYY-MM-DD for the demo lookup.",
    };
  }

  return { ok: true, fields: normalized };
}
