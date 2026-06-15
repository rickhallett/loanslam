Hi Sam,

I wanted to send this with a bit of distance from the end of the engagement.

First, I do accept responsibility for the parts I should have called more clearly at the time. I should have been firmer about prototype boundaries, acceptance criteria, and what we were trying to prove in each phase. Looking back, I think I tried to absorb too much uncertainty by working harder rather than forcing some of those conversations earlier.

I was genuinely disappointed by where we ended, because I believed in the direction of the product and still do. I don’t think the core issue was that the idea is out of reach, or that the technical fit was wrong. I think we were trying to answer too many questions at once: can the product work, can it be safe enough for a regulated lender, can it fit the existing codebase, can it match the team’s conventions, and can all of that happen at prototype speed.

Since then, I’ve continued working on a cleaner version of the prototype. It looks deliberately close to the version you saw, but the engine behind it is much more intelligent and much easier to reason about.

Link: [insert prototype link]

The main change is architectural. The newer version separates the product question from the codebase-integration question. It uses the LLM for what it is good at — interpreting messy customer language — while keeping deterministic code responsible for the hard safety boundaries: no ungrounded answers, no account-specific promises, no credential capture, and safe routing for vulnerability or complaint cases.

That boundary only became clear after the simulation work. The lab showed that static phrase matching and lexical routing were too brittle for this domain, especially around negation, complaint language, vulnerability signals, and ordinary support phrases. The newer version reflects that lesson.

I’m not sending this to relitigate the decision. I’m sending it because I still think there is something genuinely viable here, and because the later version shows the product more clearly than I was able to show it inside the original constraints.

If you’re open to it, I’d be glad to walk you through the updated prototype and discuss whether there is a smaller, better-scoped next phase with clearer success criteria and decision points.

Best,
Richard
