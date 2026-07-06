import { createError, readBody } from "h3";

import {
  type IpocLookupRequest,
  type IpocLookupResponse,
} from "../../../../domains/ipoc/models/ipoc.model";
import {
  runIpocLookup,
  validateIpocLookupFields,
} from "../../../../domains/ipoc/services/ipocLookup.service";
import { requireIpocSession } from "../../../../utils/ipocRoute";

export default defineEventHandler(
  async (event): Promise<IpocLookupResponse> => {
    const { conversationRef, session } = requireIpocSession(event);
    const body = await readBody<IpocLookupRequest>(event);
    const validation = validateIpocLookupFields(body?.fields);

    if (!validation.ok) {
      throw createError({
        statusCode: 400,
        statusMessage: validation.message,
      });
    }

    const result = runIpocLookup({ session, fields: validation.fields });

    if (!result.matched) {
      return {
        conversationRef,
        matched: false,
        customer: null,
        messages: session.messages,
      };
    }

    return {
      conversationRef,
      matched: true,
      customer: result.customer,
      messages: session.messages,
    };
  },
);
