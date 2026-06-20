# Policy Authority Boundaries

## Practical Takeaway

Phase 0 should have one hard policy authority. Retrieval should surface evidence,
the planner should propose an untrusted next move, the validator should enforce hard
rules, and reports should describe what happened. Complexity appears when several
layers each start making or reshaping policy decisions.

## Current Shape

```mermaid
flowchart TB
  subgraph Current["Current: policy authority is spread out"]
    A1["Customer message"] --> B1["Retriever<br/>Finds corpus matches<br/>+ boosts safety/advice routes"]
    B1 --> C1["Prompt<br/>Large policy manual<br/>grounding, vulnerability, credentials, handoff, UI"]
    C1 --> D1["Planner<br/>Proposes action/copy/UI<br/>+ emits safety flags"]
    D1 --> E1["Validator<br/>Enforces hard rules<br/>+ infers extra flags<br/>+ overrides action/copy/UI"]
    E1 --> F1["Reports and docs<br/>Count outcomes<br/>+ label failures<br/>+ steer future agents"]

    B1 -. "soft policy" .-> X1["Routing pressure"]
    C1 -. "soft policy" .-> X1
    D1 -. "soft policy" .-> X1
    E1 -. "hard policy" .-> X1
    F1 -. "future behavior pressure" .-> X1
  end
```

In this shape, an over-handoff can come from retrieval ranking, prompt caution,
planner flags, validator inference, or report wording. The system may still behave
safely, but debugging gets muddy because several layers have shaped the decision.

## Proposed Shape

```mermaid
flowchart TB
  subgraph Proposed["Proposed: one hard policy authority"]
    A2["Customer message"] --> B2["Retriever<br/>Finds relevant evidence only"]
    B2 --> C2["Planner prompt<br/>States constraints, not final authority"]
    C2 --> D2["Planner<br/>Proposes untrusted TurnPlan"]
    D2 --> E2["Validator<br/>Sole hard policy authority<br/>enforces grounding, safety, credentials, handoff"]
    E2 --> F2["Reports and docs<br/>Describe observed behavior only"]

    B2 -. "evidence" .-> Y2["Clear decision path"]
    D2 -. "proposal" .-> Y2
    E2 -. "decision" .-> Y2
    F2 -. "observation" .-> Y2
  end
```

This does not mean making the system less safe. It means being strict about roles:

- Retriever: evidence only.
- Prompt and planner: untrusted proposal only.
- Validator: hard policy authority.
- Reports and docs: observation only.

## Consequence

With one hard policy authority, failure analysis stays simple:

```text
Did retrieval find the right evidence?
Did the planner propose something reasonable?
Did the validator enforce the correct hard rule?
Did the report describe the outcome accurately?
```

With several policy owners, each failure has more possible causes, and future changes
are harder to make safely.
