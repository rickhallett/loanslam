# PRD: Lab API MCP Session Simulator

## Problem Statement

Phase 0 already has a useful lab API workflow for driving customer-support
simulations without a browser. The current workflow lives as agent instructions and
helper scripts, so each agent must remember the same discipline: use direct API
calls only, send one customer message at a time, inspect the result and traces
before choosing the next turn, and dump validated evidence at the end.

The user needs that workflow available as a local MCP capability so agents can
operate the Phase 0 lab through a stable, discoverable interface. The MCP server
should make the simulator easier to use without weakening the evidence loop or
turning it into broad automation.

## Solution

Build a local MCP server that exposes the lab API session simulator as a small set
of allowlisted tools. The server wraps the existing local lab API, prefers the
Phase 0 API on localhost, and returns compact evidence summaries after each tool
call.

The server starts sessions, sends exactly one customer message per call, fetches
the current session state after every message, writes validated evidence dumps, and
summarizes the current route and safety state. Scenario planning can help an agent
choose a first message and terminal condition, but it should not automatically
drive an entire simulation.

## User Stories

1. As an agent operator, I want to start a lab API session from MCP, so that I can
   begin a browser-free Phase 0 simulation.
2. As an agent operator, I want to send exactly one customer message per MCP tool
   call, so that every turn remains inspectable before the next turn is chosen.
3. As an agent operator, I want the MCP tool to fetch the session after every
   message, so that traces and state are not inferred from the message response
   alone.
4. As a reviewer, I want a compact evidence summary after each turn, so that I can
   quickly see the latest action, serving mode, safety flags, overrides, requested
   fields, collected facts, and customer-facing message.
5. As a reviewer, I want full lab API dumps saved as artifacts, so that Phase 0
   evidence can be inspected later.
6. As an engineer, I want saved dumps validated for conversation reference,
   history, and traces, so that incomplete evidence is not reported as complete.
7. As an engineer, I want explicit API errors and 404s surfaced, so that stale
   in-memory sessions or server restarts are visible.
8. As an engineer, I want the server to use allowlisted local base URLs, so that it
   cannot become a generic HTTP client.
9. As a compliance reviewer, I want the tool to avoid real PII and forbidden
   credential intake, so that Phase 0 evidence stays synthetic and safe.
10. As an agent operator, I want a scenario-planning helper, so that a user brief
    can become a first customer message, constraints, and a terminal condition.
11. As an agent operator, I want scenario planning to stop before sending turns, so
    that the agent still observes the live bot response before deciding the next
    customer message.
12. As a future maintainer, I want the MCP server to stay separate from the
    customer-facing product stack, so that local evidence tooling does not harden
    into production API design.

## Implementation Decisions

- Build a local MCP server using the official TypeScript SDK and stdio transport.
- Keep the server as a Phase 0 operator tool, not a product backend.
- Wrap the existing local lab API instead of importing the TurnPlanner engine
  directly.
- Expose separate tools for session start, single-message send, dump, reset,
  summarize, and scenario planning.
- Fetch the full session after every message send and use that as the source of
  summary evidence.
- Write dumps under the existing Phase 0 artifact convention.
- Validate dumps before reporting them as complete.
- Restrict base URLs to known local lab API surfaces.
- Keep all file writes inside the repository artifact directory.
- Do not expose raw environment variables, arbitrary filesystem reads, arbitrary
  shell execution, hidden prompts, traces outside the active session dump, or
  customer data beyond the lab API artifact being operated on.
- Do not add automatic whole-scenario execution in the first slice.

## Testing Decisions

- Test the session client and evidence summarizer with a local in-process HTTP
  server so external model calls are not required.
- Test that message sending performs both the message POST and follow-up session
  GET.
- Test that dump validation rejects incomplete artifacts.
- Test that base URL validation rejects non-local and non-allowlisted URLs.
- Test that scenario planning produces a safe plan without sending messages.
- Use behavior-level assertions over API calls, returned evidence summaries, and
  saved artifacts instead of testing MCP SDK internals.

## Out of Scope

- Browser automation, Vue lab UI automation, Playwright, or Chrome DevTools.
- A production HTTP MCP deployment.
- OAuth or multi-user remote MCP auth.
- Whole-scenario autopilot.
- Real customer PII, bank credentials, card data, payment credentials, or account
  mutation.
- Production audit storage, ticket webhook integration, widget work, AWS
  deployment, or CRM/loan-database integration.

## Further Notes

The main product value is preserving the evidence discipline in tool form. MCP
should make the lab easier for agents to operate, but the agent still has to read
the current state and make the next-turn judgment explicitly.
