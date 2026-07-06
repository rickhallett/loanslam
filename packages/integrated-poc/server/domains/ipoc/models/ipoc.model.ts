import type { IpocTicketStatus } from "../../../../shared/ipoc";

export type {
  IpocAccountAnswerRequest,
  IpocAccountAnswerResponse,
  IpocAccountQuestion,
  IpocActivityEvent,
  IpocActivityKind,
  IpocAddTicketNoteRequest,
  IpocAdminTicket,
  IpocAdminTicketResponse,
  IpocAgentNote,
  IpocChatMessage,
  IpocHandoffField,
  IpocHandoffIntake,
  IpocLookupField,
  IpocLookupFieldValues,
  IpocLookupRequest,
  IpocLookupResponse,
  IpocSendMessageRequest,
  IpocSendMessageResponse,
  IpocSessionResponse,
  IpocStructuredIntake,
  IpocSubmitIntakeRequest,
  IpocSubmitIntakeResponse,
  IpocTicket,
  IpocTicketListResponse,
  IpocTicketStatus,
  IpocUpdateTicketStatusRequest,
} from "../../../../shared/ipoc";

export {
  ipocAccountQuestions,
  ipocHandoffFields,
  ipocLookupFields,
} from "../../../../shared/ipoc";

export const ipocTicketStatuses = [
  "open",
  "intake_captured",
  "in_review",
  "resolved",
] as const satisfies readonly IpocTicketStatus[];

export function isIpocTicketStatus(
  value: unknown,
): value is IpocTicketStatus {
  return (
    typeof value === "string" &&
    (ipocTicketStatuses as readonly string[]).includes(value)
  );
}
