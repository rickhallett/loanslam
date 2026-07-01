import type { IntakeField, SafetyFlag, TurnAction, UiPlan } from "@loanslam/contracts";

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

export interface IpocTicket {
  id: string;
  conversationRef: string;
  requestRef: string | null;
  status: "open";
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
  assistantPreview: string;
}

export interface IpocTicketListResponse {
  tickets: IpocTicket[];
}
