// Shared wire contracts for the Loanslam chat widget. Zod is the boundary
// source of truth: these schemas validate requests, infer TS types, and feed
// the backend's OpenAPI registration. Imported by both backend and widget.

export * from './envelope.js';
export * from './kb.js';
export * from './state.js';
export * from './chat.js';
export * from './audit.js';

/** Bump when routing/policy behaviour changes; stamped onto every audit event. */
export const POLICY_VERSION = 'poc-2026-06-13';
