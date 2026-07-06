import {
  ipocLookupFields,
  type IpocLookupFieldValues,
  type IpocLookupRequest,
} from "../models/ipoc.model";
import type { IpocSession } from "../stores/ipocSession.store";
import {
  appendMessage,
  findMockCustomer,
  recordSessionActivity,
} from "../stores/ipocSession.store";

export type IpocLookupValidationResult =
  | { ok: true; fields: IpocLookupFieldValues }
  | { ok: false; message: string };

export type IpocLookupServiceResult =
  | {
      matched: true;
      customer: {
        fullName: string;
        loanReference: string;
      };
    }
  | { matched: false; customer: null };

export function validateIpocLookupFields(
  fields: IpocLookupRequest["fields"] | undefined,
): IpocLookupValidationResult {
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

export function runIpocLookup({
  session,
  fields,
}: {
  session: IpocSession;
  fields: IpocLookupFieldValues;
}): IpocLookupServiceResult {
  const record = findMockCustomer(fields);

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

    return { matched: false, customer: null };
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
    matched: true,
    customer: {
      fullName: record.fullName,
      loanReference: record.loanReference,
    },
  };
}
