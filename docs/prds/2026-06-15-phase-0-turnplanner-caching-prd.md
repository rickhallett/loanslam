# PRD: Phase 0 TurnPlanner Caching

## Problem Statement

The Phase 0 TurnPlanner engine now has enough evidence to make model selection a
real product decision. The current planner call is not tiny: a representative
application-status turn used roughly 4.4k input tokens and 250 output tokens, with
most of the prompt made up of stable instructions, structured-output schema, policy
rules, and retrieved corpus evidence.

That creates two related problems before productisation:

- The MVP needs fast, reliable customer responses without choosing a weaker model
  only because it is cheaper or sometimes faster.
- The team needs to understand which repeated work can be safely avoided without
  turning cached model output into a hidden policy authority.

The dangerous failure mode is treating "cache the LLM response" as simple. In this
domain, small wording differences can change the route: a negated hardship signal,
an account-specific request, a vulnerability cue, an excluded-advice request, or
PII-bearing context can make a superficially similar message require a different
action. A cache that blurs those boundaries would make the MVP faster by making it
less trustworthy.

The useful product question is narrower: which caching can reduce cost and latency
while preserving the `processTurn` boundary, the model-backed `TurnPlanner`
contract, and validator authority?

## Solution

Introduce caching in three deliberately separated layers.

The first layer is provider prompt-cache instrumentation and shaping. The engine
should make OpenAI prompt caching easier to hit by keeping stable prompt content at
the beginning of the request, using a consistent cache key where appropriate, and
logging cached token counts in traces and reports. This does not change planner
behavior; it makes repeated prompt prefixes cheaper and faster.

The second layer is an exact-match planner-result cache for safe, repeated turns.
It may return a previously generated `TurnPlan` only when the full cache key proves
that the planner input is materially identical. Cached plans remain untrusted and
must pass the same validator path as fresh model output. Cache hits must be visible
in traces.

The third layer, semantic caching, is explicitly out of scope for MVP. The system
must not reuse a plan merely because a new message is "similar" to an older one.
That can be revisited only after production telemetry and Phase 0 evidence show
which routes are safe enough to generalise.

The target model is:

```text
Provider prompt cache = transparent model-call acceleration
Exact planner cache = safe shortcut for identical low-risk inputs
Semantic cache = not MVP-safe
Validator = still the hard runtime authority
```

This keeps caching as an optimization rather than a second planner, a second
retriever, or a hidden policy layer.

## User Stories

1. As a product stakeholder, I want the MVP to use a capable model without
   unnecessary repeated prompt-processing cost, so that quality is not traded away
   too early.
2. As an operator, I want planner traces to show cached input tokens, so that real
   cache behavior can be measured instead of guessed.
3. As an engineer, I want a stable prompt-cache key strategy, so that repeated
   Phase 0 and MVP calls can benefit from provider caching.
4. As an engineer, I want static prompt content to stay before dynamic customer
   content, so that provider prompt caching has a useful repeated prefix.
5. As a reviewer, I want cache hit metrics in model comparison reports, so that
   latency and cost conclusions are not distorted by unknown cache state.
6. As a product stakeholder, I want exact repeated low-risk questions to avoid a
   model call where safe, so that the customer experience is faster under common
   FAQ traffic.
7. As a compliance reviewer, I want cached `TurnPlan` output to be validated the
   same way as fresh planner output, so that cached results do not bypass policy.
8. As a support operator, I want vulnerability, hardship, complaint, legal,
   accessibility, account-specific, and PII-bearing turns excluded from initial
   result caching, so that sensitive routes remain fresh and conservative.
9. As an engineer, I want cache keys to include model, prompt version, policy
   version, schema version, corpus fingerprint, retrieved evidence, allowed
   actions, allowed UI primitives, conversation state, and exact user message, so
   that stale or mismatched plans are not reused.
10. As a reviewer, I want every cache hit to be traceable, so that evidence reports
    can distinguish model behavior from cached behavior.
11. As an engineer, I want cache invalidation to be automatic when policy, prompt,
    model, schema, or corpus changes, so that old plans do not survive authority
    changes.
12. As a product stakeholder, I want semantic caching deferred, so that a speed
    optimization does not quietly create safety risk.
13. As an engineer, I want retrieval-size control considered before broad result
    caching, so that every call becomes cheaper instead of only repeated calls.
14. As a future product engineer, I want the cache boundary expressed as a small
    replaceable port, so that Phase 0 can use in-memory or file-backed storage and
    productisation can later move to a production store.
15. As a future reviewer, I want cache behavior covered by deterministic tests, so
    that future model or corpus work cannot accidentally widen cache reuse.

## Implementation Decisions

- Preserve `processTurn` as the engine entrypoint. Caching must sit behind or
  around the planner boundary, not replace the engine.
- Preserve `TurnPlanner` as the model adapter contract. A cached planner result is
  still a `TurnPlan`, not a final `ValidatedTurnResult`.
- Preserve the validator as the hard runtime policy authority. Cached plans must
  pass the same grounding, serving-mode, vulnerability, excluded-advice,
  account-specific, forbidden-credential, and UI/action checks as fresh plans.
- Add provider prompt-cache observability first. Capture cached input tokens,
  total input tokens, output tokens, model, prompt version, and policy version in
  planner metadata or trace evidence.
- Use a stable prompt-cache key for planner requests where the provider supports
  it. Choose a key granularity that reflects the stable planner prompt family,
  not individual customer messages.
- Keep static prompt content first: structured-output schema, system instructions,
  policy rules, and stable examples must appear before customer-specific state and
  message content.
- Add retrieval-size control before broad application-level result caching. The
  current prompt can include many retrieved matches; capping or shaping evidence
  can reduce cost and latency on every turn.
- Add a small planner cache port only after prompt-cache metrics exist. The port
  should support exact lookup, write, and cache metadata without coupling the
  engine to a specific storage backend.
- Start exact planner-result caching with the safest route: public FAQ answers
  grounded in `serving_mode: answer` evidence, no active handoff, no safety flags,
  no account-specific request, no excluded advice, and no PII-bearing content.
- Do not cache turns whose input or state includes vulnerability, distress,
  hardship, complaint, legal threat, accessibility need, account-specific request,
  change request, sensitive overshare, forbidden credentials, handoff intake, or
  ticket creation.
- Do not cache final validated results unless a later PRD explicitly defines a
  full-state result-cache contract. For MVP, cache only the planner proposal and
  revalidate it.
- Cache keys must include all authority-changing inputs: provider, model,
  reasoning configuration where relevant, prompt version, policy version,
  structured-output schema version, corpus fingerprint, retrieved item IDs and
  content hashes, allowed actions, allowed UI primitives, conversation state
  fingerprint, exact user message, and language scope.
- Cache entries should store enough metadata for audit: created time, cache key
  version, planner metadata, token usage from the original model call, selected
  serving mode, cited item IDs, and whether the entry is eligible for reuse.
- Cache hits must appear in traces and reports. Evidence artifacts should not make
  cached behavior look like a fresh model run.
- Cache invalidation should prefer versioned keys over mutable deletes. A policy,
  prompt, schema, model, or corpus change should naturally miss old entries.
- Semantic caching is not part of MVP. Do not introduce embeddings, fuzzy matching,
  paraphrase detection, or "similar enough" reuse for customer turns.
- Production cache storage is not decided in Phase 0. The implementation should
  remain portable between in-memory, file-backed, SQLite, Postgres, or managed cache
  storage.

## Testing Decisions

- Test provider prompt-cache instrumentation with an injected planner client:
  traces should include cached token counts when the provider reports them and
  should remain valid when the provider reports zero.
- Test exact cache keys as deterministic behavior: identical planner inputs produce
  identical keys, and changes to policy version, prompt version, model, corpus
  fingerprint, retrieved evidence, allowed actions, conversation state, or user
  message produce different keys.
- Test cache eligibility as policy behavior, not implementation detail.
  Answerable public FAQ turns may be eligible; vulnerability, account-specific,
  excluded, handoff, PII-bearing, and credential-bearing turns must be ineligible.
- Test that a cache hit still runs through validation. A cached unsafe or malformed
  plan must be overridden or failed closed exactly like fresh planner output.
- Test trace evidence. Cached turns must record cache hit status, cache key version,
  and original planner metadata without exposing sensitive customer content in the
  cache metadata.
- Test invalidation by versioned key. Policy, prompt, schema, model, and corpus
  changes should miss prior entries without requiring destructive cache clearing.
- Test that result caching does not change conversation-state merging, handoff
  state, requested-field cleanup, ticket-creation conditions, or validator
  overrides.
- Reuse existing engine, validator, planner adapter, journey runner, and stochastic
  reporting test styles. Keep tests focused on external behavior and trace
  contracts.
- Do not write tests that assert exact customer-facing wording except where wording
  is a hard safety or refusal contract.

## Out of Scope

- Semantic caching or fuzzy reuse of similar customer messages.
- Embedding-based cache lookup.
- Caching vulnerability, hardship, complaint, legal, accessibility,
  account-specific, handoff-intake, ticket-creation, excluded-advice, or
  PII-bearing turns.
- Replacing model-backed evidence runs with cached planner fixtures.
- Treating cached planner output as a final policy decision.
- Building production cache infrastructure before the cache port and behavior are
  proved.
- Multi-provider cache normalization.
- Customer-visible cache controls.
- A global cache shared across tenants or organizations.
- Long-term retention of customer message content in cache metadata.
- Choosing a cheaper model solely because caching lowers cost.

## Further Notes

This PRD is an optimization spec, not a model-selection spec. The current model
recommendation remains quality-first: use the strongest model that passes the
journey and stochastic evidence envelope at acceptable latency.

Provider prompt caching should be treated as the first and safest win. It directly
targets the observed planner shape: a large repeated prefix plus a smaller dynamic
tail. It can reduce cost and latency without changing model behavior.

Exact planner-result caching is useful only if the hit rate justifies the added
state. It is likely most valuable for repeated public FAQ traffic. It is not a good
tool for the hardest support conversations, which are exactly the ones where fresh
model judgment and fail-closed validation matter most.

Retrieval-size control may beat application-level caching for broad impact. If the
planner prompt regularly includes many retrieved matches, reducing noisy evidence
can improve every call rather than only cache hits.

The core rule is simple: caching may reduce repeated computation, but it must never
become an invisible source of policy authority.
