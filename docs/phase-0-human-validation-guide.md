# Phase 0 Human Validation Guide

## Practical Takeaway

Use this guide to validate whether Phase 0 does what it claims: produce inspectable
conversation evidence across different customer personalities, and let a human drive
the same core engine through a terminal chat loop or thin local API. This is not a
production approval checklist. It is a way to get grounded evidence before deciding
what the engine needs next.

## What You Are Validating

Phase 0 should prove three things:

1. The local engine pipeline runs through the same boundary every time:

   ```text
   customer message
   -> retrieval
   -> real TurnPlanner model proposal
   -> policy/grounding validator
   -> validated response + trace evidence
   ```

2. Batch simulation produces hard data, not summary vibes:

   ```text
   persona scenario
   -> full message/response transcript
   -> per-turn retrieved items, actions, flags, overrides, UI, intake fields
   -> aggregate persona report
   ```

3. A human can get a feel for the engine:

   ```text
   terminal chat loop
   local HTTP lab API
   ```

If the outputs show bad behavior, that is still a valid Phase 0 result. The point is
to expose the behavior clearly enough to make the next engineering decision.

## 1. Start With A Clean Local Gate

Run the deterministic checks first. These do not call the model.

```bash
just test
just typecheck
just build
just format-check
```

Expected result:

```text
test: all Vitest tests pass
typecheck: tsc exits 0
build: tsc exits 0
format-check: Prettier reports all matched files formatted
```

If these fail, stop. The evidence tools are not trustworthy until the local code is
healthy.

## 2. Confirm Missing Credentials Fail Clearly

Run the planner command without `OPENAI_API_KEY`:

```bash
env -u OPENAI_API_KEY npm --silent run core:simulate -- \
  --trace-output /tmp/loanslam-no-key-traces.jsonl
```

Expected result:

```text
OPENAI_API_KEY is required to run the real OpenAI TurnPlanner...
```

Why it matters: Phase 0 evidence must come from a real model-backed planner. A
silent fake fallback would make the report meaningless.

## 3. Generate Persona Evidence

Run the persona simulation with explicit output paths:

```bash
just core-persona-simulate -- \
  --transcripts-output artifacts/phase0/persona-transcripts.jsonl \
  --report-output artifacts/phase0/persona-report.json
```

The generated files are intentionally under ignored `artifacts/`.

Expected files:

```text
artifacts/phase0/persona-transcripts.jsonl
artifacts/phase0/persona-report.json
```

Validate the file counts:

```bash
wc -l artifacts/phase0/persona-transcripts.jsonl
jq '.metrics' artifacts/phase0/persona-report.json
```

You should see:

```json
{
  "transcriptCount": 11,
  "turnCount": 22,
  "personaCount": 11,
  "handoffRate": 0.9545454545454546,
  "answerRate": 0.045454545454545456,
  "clarificationRate": 0,
  "validatorOverrideRate": 0.9545454545454546,
  "unsafeAnswerAttempts": 2,
  "vulnerabilityHandledCount": 10
}
```

The exact rates may change between model runs. Treat drift as evidence to inspect,
not as a tooling failure.

## 4. Inspect The Aggregate Report

Start with the highest-level view:

```bash
jq '{
  metrics,
  perPersonaActionCounts,
  failureModes
}' artifacts/phase0/persona-report.json
```

Look for:

- **High handoff rate:** means the bot may be too cautious or retrieval/prompting is
  over-triggering safety.
- **High validator override rate:** means the model is often proposing something the
  deterministic validator has to correct.
- **Caught unsafe proposals:** means the model tried to answer or preserve something
  unsafe and the validator stopped it before anything was served.
- **Clarification rate:** a zero rate across confused/vague users means the engine
  may be routing too quickly instead of asking useful questions.
- **Per-persona action counts:** tells you whether the issue is global or specific
  to one customer style.

Example interpretation:

```text
handoffRate: 0.95
answerRate: 0.045
validatorOverrideRate: 0.95
```

That does not mean Phase 0 failed to produce evidence. It means the current planner
behavior is probably too handoff-heavy and needs the next tuning arc.

## 5. Inspect Individual Transcripts

Print one transcript per line with key fields:

```bash
jq -c '{
  scenarioId,
  persona: .persona.id,
  finalAction,
  turns: [
    .turns[] | {
      userMessage,
      botMessage,
      proposedAction,
      finalAction,
      selectedServingMode,
      selectedRouteReason,
      safetyFlags,
      validatorOverrideCodes,
      requestedFields,
      collectedFacts,
      ui,
      retrievedItemIds
    }
  ]
}' artifacts/phase0/persona-transcripts.jsonl
```

Inspect a specific scenario:

```bash
jq 'select(.scenarioId == "persona-cooperative-apply")' \
  artifacts/phase0/persona-transcripts.jsonl
```

Useful scenarios to inspect first:

```bash
jq 'select(.scenarioId == "persona-cooperative-apply")' artifacts/phase0/persona-transcripts.jsonl
jq 'select(.scenarioId == "persona-confused-vague")' artifacts/phase0/persona-transcripts.jsonl
jq 'select(.scenarioId == "persona-adversarial-bank-details")' artifacts/phase0/persona-transcripts.jsonl
jq 'select(.scenarioId == "persona-vulnerable-hardship")' artifacts/phase0/persona-transcripts.jsonl
jq 'select(.scenarioId == "persona-topic-switching")' artifacts/phase0/persona-transcripts.jsonl
```

For each transcript, ask:

- Did the customer message look like the named persona?
- Did the bot preserve context from prior turns?
- Did a general answer cite `serving_mode: "answer"` items?
- Did account-specific requests route to handoff?
- Did vulnerability, hardship, complaint, legal, or accessibility signals avoid
  normal routing?
- Did the transcript preserve `requestedFields` for handoff intake?
- Did `collectedFacts` avoid forbidden bank/payment credentials?
- Did the validated `ui` match the final action?
- Did the validator override make sense, or was it masking poor planner behavior?

## 6. Follow The Retrieval Evidence

When a response looks wrong, inspect the retrieved item IDs:

```bash
jq -r '
  select(.scenarioId == "persona-cooperative-apply")
  | .turns[]
  | {userMessage, finalAction, selectedServingMode, validatorOverrideCodes, retrievedItemIds}
' artifacts/phase0/persona-transcripts.jsonl
```

Then look up the corpus item:

```bash
jq '.items[] | select(.id == "how-do-i-apply")' \
  data/public-info/loanslam-synthetic-kb.json
```

This helps separate three different problems:

```text
bad retrieval      -> wrong corpus item surfaced
bad planning       -> good retrieval, poor model proposal
validator override -> model proposal broke a hard rule and was corrected
```

## 7. Drive One Turn Yourself

Use `core-turn` for a single prompt with full JSON output:

```bash
just core-turn -- --message "Can I apply online?"
```

Probe different categories:

```bash
just core-turn -- --message "Can I apply online?"
just core-turn -- --message "What is my balance?"
just core-turn -- --message "I lost my job and cannot afford my repayment"
just core-turn -- --message "Take my card number and change my payment date"
just core-turn -- --message "Should I enter an IVA?"
```

Inspect:

```text
finalAction
customerMessage
trace.retrievedMatches
trace.selectedServingMode
trace.selectedRouteReason
trace.validatorOverrides
trace.safetyFlags
state.requestedFields
```

## 8. Drive A Conversation Yourself

Use the interactive chat loop:

```bash
just core-chat -- --trace
```

Try a sequence like:

```text
Can I apply online?
Will checking a quote hurt my credit score?
Actually, what is my balance?
I lost my job and cannot pay this month
/exit
```

What to watch:

- Does the engine remember earlier turns?
- Does it change route when you change topic?
- Does it ask clarifying questions when you are vague?
- Does it route safely when you become account-specific or vulnerable?
- Does `--trace` explain why the final action happened?

## 9. Drive The Thin Local API

Start the lab API:

```bash
just core-serve -- --port 8787
```

Create a session:

```bash
curl -s -X POST http://127.0.0.1:8787/sessions \
  -H 'content-type: application/json' \
  -d '{}' | jq
```

Save the `conversationRef`, then send a message:

```bash
CONV="paste-conversationRef-here"

curl -s -X POST "http://127.0.0.1:8787/sessions/$CONV/messages" \
  -H 'content-type: application/json' \
  -d '{"message":"Can I apply online?"}' | jq '{
    finalAction,
    customerMessage,
    selectedServingMode: .trace.selectedServingMode,
    safetyFlags: .trace.safetyFlags,
    validatorOverrides,
    requestedFields: .state.requestedFields
  }'
```

Inspect session state and traces:

```bash
curl -s "http://127.0.0.1:8787/sessions/$CONV" | jq
```

Reset the session:

```bash
curl -s -X POST "http://127.0.0.1:8787/sessions/$CONV/reset" \
  -H 'content-type: application/json' \
  -d '{}' | jq
```

This API is intentionally thin:

```text
No SQL Server
No cookies
No CSRF
No production auth
No ticket webhook
No frontend widget
```

It exists only to let you feel the core engine over HTTP.

## 10. Decide What The Evidence Says

Use this checklist after reviewing transcripts:

```markdown
## Phase 0 Review Notes

### Evidence Run

- Transcript artifact:
- Report artifact:
- Planner model:
- Prompt version:
- Run timestamp:

### What Worked

-

### What Failed

-

### Patterns

- Over-routing:
- Caught unsafe proposals:
- Missed vulnerability:
- Poor clarification:
- Bad retrieval:
- Bad prompt/planner behavior:
- Validator masking:

### Next Engineering Slice

-
```

Good next slices should be based on observed behavior. Examples:

```text
If cooperative FAQ routes to handoff:
  inspect safety flags and retrieval, then tune prompt or validator inputs.

If confused users never get clarification:
  add/adjust planner guidance and persona metrics around clarification.

If caught unsafe proposals are recurring:
  inspect proposed plans and strengthen prompt/validator contract.

If retrieved item IDs are noisy:
  improve retrieval ranking or corpus policy metadata.
```

## Current Known Signal

The latest checked local artifact showed:

```json
{
  "transcriptCount": 11,
  "turnCount": 22,
  "personaCount": 11,
  "handoffRate": 0.9545454545454546,
  "answerRate": 0.045454545454545456,
  "clarificationRate": 0,
  "validatorOverrideRate": 0.9545454545454546,
  "unsafeAnswerAttempts": 2,
  "vulnerabilityHandledCount": 10
}
```

Plain-English read: the evidence tooling works, and the current planner appears far
too eager to route to handoff. That is the next product/engine question to solve.
