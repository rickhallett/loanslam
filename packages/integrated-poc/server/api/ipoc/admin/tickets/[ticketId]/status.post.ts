import { createError, readBody } from "h3";

import type {
  IpocAdminTicketResponse,
  IpocUpdateTicketStatusRequest,
} from "../../../../../domains/ipoc/models/ipoc.model";
import {
  ipocTicketStatuses,
  isIpocTicketStatus,
} from "../../../../../domains/ipoc/models/ipoc.model";
import { changeIpocAdminTicketStatus } from "../../../../../domains/ipoc/services/ipocAdmin.service";

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

    if (!isIpocTicketStatus(status)) {
      throw createError({
        statusCode: 400,
        statusMessage: `status must be one of: ${ipocTicketStatuses.join(", ")}.`,
      });
    }

    const result = changeIpocAdminTicketStatus({ ticketId, status });

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

    return { ticket: result.ticket };
  },
);
