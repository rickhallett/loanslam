import { createError, getRouterParam } from "h3";

import {
  getIpocSession,
  type IpocSession,
} from "../domains/ipoc/stores/ipocSession.store";

export interface RequiredIpocSession {
  conversationRef: string;
  session: IpocSession;
}

export function requireIpocSession(
  event: Parameters<typeof getRouterParam>[0],
): RequiredIpocSession {
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

  return { conversationRef, session };
}
