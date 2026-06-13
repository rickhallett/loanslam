import { customAlphabet, nanoid } from 'nanoid';

// Secret session id: long, URL-safe, high entropy. Lives only in the HttpOnly
// cookie — never exposed to browser JS (brief §16).
export const newSessionId = (): string => nanoid(40);

// Non-secret, human-friendlier references for support/debug correlation.
const refAlphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
const ref = customAlphabet(refAlphabet, 12);

export const newConversationRef = (): string => `conv_${ref()}`;
export const newRequestRef = (): string => `req_${ref()}`;
export const newTicketRef = (): string => `tkt_${ref()}`;
export const newEventId = (): string => `evt_${nanoid(16)}`;
export const newTranscriptId = (): string => `txt_${nanoid(16)}`;

/** CSRF double-submit token, bound to a session. */
export const newCsrfToken = (): string => nanoid(32);
