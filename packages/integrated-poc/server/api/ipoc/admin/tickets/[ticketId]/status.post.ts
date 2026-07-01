import { createError, readBody } from "h3";

import type {
  IpocAdminTicketResponse,
  IpocTicketStatus,
  IpocUpdateTicketStatusRequest,
} from "../../../../../../shared/ipoc";
import {
  getIpocAdminTicket,
  updateIpocTicketStatus,
} from "../../../../../utils/ipocStore";

const validStatuses: IpocTicketStatus[] = [
  "open",
  "intake_captured",
  "in_review",
  "resolved",
];

export default defineEventHandler(
  async (event): Promise<IpocAdminTicketResponse> => {
    const ticketId = getRouterParam(event, "ticketId");

    if (!ticketId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing ticket id.",
      });
    }

    const body = await readBody<IpocUpdateTicketStatusRequest>(event);
    const status = body?.status;

    if (!status || !validStatuses.includes(status)) {
      throw createError({
        statusCode: 400,
        statusMessage: `status must be one of: ${validStatuses.join(", ")}.`,
      });
    }

    const result = updateIpocTicketStatus(ticketId, status);

    if (!result.ok) {
      if (result.reason === "not_found") {
        throw createError({
          statusCode: 404,
          statusMessage: `Ticket ${ticketId} was not found.`,
        });
      }

      throw createError({
        statusCode: 409,
        statusMessage: `Cannot move ticket from ${result.from} to ${status}.`,
      });
    }

    const ticket = getIpocAdminTicket(ticketId);

    if (!ticket) {
      throw createError({
        statusCode: 404,
        statusMessage: `Ticket ${ticketId} was not found.`,
      });
    }

    return { ticket };
  },
);
