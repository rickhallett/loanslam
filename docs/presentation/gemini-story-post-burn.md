This repository tells a fascinating, high-speed engineering story that unfolds over just a few days in mid-June 2026. It is a masterclass in how to build, test, and safely constrain Generative AI in a highly regulated industry. 

The author, Rick Hallett, is under a 30-day deadline to build an embeddable customer support AI widget for "Loanslam" (the trading name for a UK consumer credit lender, Monthly Advance Loans or "MAL"). Because the company is regulated by the FCA, the cost of the AI giving bad financial advice, harvesting bank credentials, or ignoring vulnerable customers is catastrophic.

Here is the story of how the engine was built, broken, and ultimately reimagined.

### Act I: The "Phase 0" Philosophy (June 13)
Rick realizes that rushing to build the cloud infrastructure (AWS) and the frontend (Vue widget) is a trap. If the core AI engine cannot safely handle messy human conversations, the UI doesn't matter. 

He establishes a boundary called **"Phase 0: Engine Proof."** He defines a strict architecture where the LLM is treated as an *untrusted reasoning engine*. The flow is strictly defined:
1. **Retrieval:** Fetch approved knowledge base answers.
2. **TurnPlanner:** An OpenAI model proposes a `TurnPlan` (e.g., answer, handoff to human, ask a clarifying question).
3. **Validator:** A deterministic, hard-coded cop that inspects the plan. If the LLM tries to promise a loan approval, ask for a CVV code, or ignore a customer's financial hardship, the Validator overrides the LLM and forces a safe fallback or human handoff.

### Act II: The Crucible of the Lab (June 13–14)
To prove the engine works, Rick builds a massive testing apparatus. He knows that testing "happy paths" isn't enough for customer service. 

He creates the **Stochastic Test Simulator (STS)**. This framework generates highly varied, messy customer scenarios across different personas: cooperative, adversarial, confused, terse, impatient, oversharing, and vulnerable. He also builds a local Vue.js engineer console (`lab-ui`) to watch the bot's internal traces in real-time.

Over the weekend, Rick runs these simulations and captures massive stress-test logs (scenarios 2 through 20). The lab reveals exactly what he feared: *the bot is failing, but not where he expected.*

### Act III: The Lexical Trap (June 14)
Rick discovers a critical flaw in how the bot retrieves knowledge and flags danger. He was using traditional "lexical retrieval" and regexes to spot keywords. 

The lab exposes the brittleness of this approach:
* A customer says, *"I can't find my ticket."* The system sees the word **"can't"**, panics, flags the customer as "vulnerable/in financial hardship," and halts the conversation to mandate a human handoff.
* A customer says, *"I'm not complaining, but..."* The system sees the word **"complaining"** and locks the chat into a formal legal complaint workflow.
* A customer pastes a server log with the word **"so"**, and the bot hallucinates a vulnerability route.

Rick tries to fix this the traditional way: he adds stop-words, tweaks regexes, and writes code to catch negated phrases. But it quickly turns into a game of Whac-A-Mole. He is building a "hand-maintained mini-language" that will inevitably break in production.

### Act IV: The Pivot & The Great Purge (June 15)
On the morning of Monday, June 15, Rick writes the **"LLM-Centric Intelligence PRD"**. He has an epiphany: *Code shouldn't parse human nuance, and LLMs shouldn't enforce laws.* 

He shifts the architecture. Instead of using regex to guess intent, he creates an `OpenAiSignalExtractor`. He uses OpenAI's structured outputs to read the customer's message and extract formal "Signals" (Is the customer in distress? Are they asking a public FAQ? Is this an account mutation request?). The LLM is allowed to understand the nuance of negations and context.

However, he leaves the **Validator** fully intact. The LLM interprets the customer, but the hard-coded Validator still checks the resulting plan to ensure no rules are broken.

At 3:14 PM, Rick executes the climax of the repository: **`commit 02b0a77eae0`**. 
He titles it: *"refactor(core): Burn the static phrase/lexical routing layer."*
He deletes over 2,200 lines of brittle regexes, lexical scoring logic, and hyper-specific unit tests. He leaves behind a note: *"Static routing tests are false-positive/false-negative magnets; they usually make tuning harder unless they guard a tiny non-negotiable safety invariant."*

### Epilogue: Ready for the Stakeholders (June 15)
With the engine finally stable, deeply tested, and elegantly separated into "LLM for nuance, Code for rules," Rick prepares for the stakeholder review with the client (someone named "Sam"). 

He scaffolds two frontend demos: a generic "Loanslam" widget and an exact mock of the original "MAL" branded site. Finally, as a crowning touch for modern AI development, he adds a Model Context Protocol (MCP) server so that AI agents can interact natively with his lab simulator API.

**The story of this repository is a masterclass in modern AI engineering:** It shows a developer resisting the urge to build UI wrappers around raw LLMs, building rigorous observability to discover the real failure modes of language models, and finding the exact right boundary between stochastic AI reasoning and deterministic code safety.