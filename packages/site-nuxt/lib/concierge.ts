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
  assistant: {
    message: string;
    // dc3-001 (D046): allowlist-validated navigation proposal; the widget
    // renders it as a confirm-to-act chip. Never auto-executed.
    navigateTo?: string | null;
    // dc3-002 (D046): known-field fill proposal for the application form;
    // applied client-side only after an explicit user click.
    formFill?: Record<string, string> | null;
  };
}
