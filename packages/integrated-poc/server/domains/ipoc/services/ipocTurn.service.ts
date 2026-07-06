import type { ValidatedTurnResult } from "@loanslam/contracts";

import {
  maybeBuildTicketFromTurn,
  runIpocTurn,
} from "../../../utils/engineAdapter";
import type { IpocTicket } from "../models/ipoc.model";
import type { IpocSession } from "../stores/ipocSession.store";
import { appendMessage, saveIpocTicket } from "../stores/ipocSession.store";

export interface IpocTurnResult {
  result: ValidatedTurnResult;
  ticket: IpocTicket | null;
}

export async function processIpocTurn({
  session,
  message,
}: {
  session: IpocSession;
  message: string;
}): Promise<IpocTurnResult> {
  appendMessage(session, { role: "customer", content: message });

  const result = await runIpocTurn({ session, message });
  appendMessage(session, {
    role: "assistant",
    content: result.customerMessage,
  });

  const ticket = maybeBuildTicketFromTurn({ result });

  if (ticket) {
    saveIpocTicket(ticket);
  }

  return { result, ticket };
}
