// Client-side contract for the demo-concierge surface (D045).

export interface ConciergeStatusResponse {
  enabled: boolean;
  model: string | null;
}

export interface ConciergeSessionResponse {
  conversationRef: string;
}

export interface ConciergeMessageResponse {
  conversationRef: string;
  assistant: { message: string };
}
