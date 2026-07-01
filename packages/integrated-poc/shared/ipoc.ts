import type {
  IntakeField,
  SafetyFlag,
  TurnAction,
  UiPlan,
} from "@loanslam/contracts";

export const ipocHandoffFields = [
  "fullName",
  "dateOfBirth",
  "postcode",
  "email",
  "phone",
] as const satisfies readonly IntakeField[];

export type IpocHandoffField = (typeof ipocHandoffFields)[number];
export type IpocHandoffIntake = Record<IpocHandoffField, string>;

export const ipocLookupFields = [
  "fullName",
  "dateOfBirth",
  "address",
  "loanReference",
] as const;

export type IpocLookupField = (typeof ipocLookupFields)[number];
export type IpocLookupFieldValues = Record<IpocLookupField, string>;

export interface IpocLookupRequest {
  fields: Partial<Record<IpocLookupField, string>>;
}

export interface IpocLookupResponse {
  conversationRef: string;
  matched: boolean;
  customer: {
    fullName: string;
    loanReference: string;
  } | null;
  messages: IpocChatMessage[];
}

// Demoable answer set per D038: shrinkable without a new decision, not expandable.
export const ipocAccountQuestions = [
  "nextPaymentDate",
  "outstandingBalance",
  "loanStatus",
] as const;

export type IpocAccountQuestion = (typeof ipocAccountQuestions)[number];

export interface IpocAccountAnswerRequest {
  question: IpocAccountQuestion;
}

export interface IpocAccountAnswerResponse {
  conversationRef: string;
  question: IpocAccountQuestion;
  answer: string;
  messages: IpocChatMessage[];
}

export interface IpocChatMessage {
  id: string;
  role: "customer" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface IpocSessionResponse {
  conversationRef: string;
  messages: IpocChatMessage[];
}

export interface IpocSendMessageRequest {
  message: string;
}

export interface IpocSendMessageResponse {
  conversationRef: string;
  messages: IpocChatMessage[];
  assistant: {
    message: string;
    ui: UiPlan;
    finalAction: TurnAction;
    requestedFields: IntakeField[];
    safetyFlags: SafetyFlag[];
  };
  ticket: IpocTicket | null;
}

export interface IpocSubmitIntakeRequest {
  ticketId: string;
  fields: Partial<Record<IpocHandoffField, string>>;
}

export interface IpocSubmitIntakeResponse {
  conversationRef: string;
  messages: IpocChatMessage[];
  ticket: IpocTicket;
}

export interface IpocStructuredIntake {
  fields: IpocHandoffIntake;
  capturedAt: string;
  piiPolicy: "synthetic_demo_fields_only";
}

export type IpocTicketStatus =
  | "open"
  | "intake_captured"
  | "in_review"
  | "resolved";

export interface IpocAgentNote {
  id: string;
  note: string;
  createdAt: string;
}

export type IpocActivityKind =
  | "lookup_matched"
  | "lookup_no_match"
  | "account_answer";

export interface IpocActivityEvent {
  id: string;
  kind: IpocActivityKind;
  detail: string;
  createdAt: string;
}

export interface IpocUpdateTicketStatusRequest {
  status: IpocTicketStatus;
}

export interface IpocAddTicketNoteRequest {
  note: string;
}

export interface IpocAdminTicketResponse {
  ticket: IpocAdminTicket;
}

export interface IpocTicket {
  id: string;
  conversationRef: string;
  requestRef: string | null;
  status: IpocTicketStatus;
  queue: "support";
  createdAt: string;
  customerContext: {
    journey: "application-help";
    summary: string;
    piiPolicy: "raw_customer_message_omitted";
  };
  engine: {
    finalAction: TurnAction;
    uiPrimitive: UiPlan["primitive"];
    servingMode: string | null;
    safetyFlags: SafetyFlag[];
    requestedFields: IntakeField[];
    validatorOverrideCodes: string[];
  };
  structuredIntake: IpocStructuredIntake | null;
  assistantPreview: string;
  agentNotes: IpocAgentNote[];
}

export interface IpocAdminTicket extends IpocTicket {
  activity: IpocActivityEvent[];
}

export interface IpocTicketListResponse {
  tickets: IpocAdminTicket[];
}
