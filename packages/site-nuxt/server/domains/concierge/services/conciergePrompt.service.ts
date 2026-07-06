import { siteMapLines } from "../../../../lib/siteMap";
import { normalizePublicOrigin } from "../../../../lib/siteUrls";
import type { ConciergeMessage } from "../concierge.model";

export type ConciergePromptMessage = {
  role: "user" | "assistant" | "developer";
  content: string;
};

export interface ConciergePromptInput {
  input: ConciergePromptMessage[];
  displayOrigin: string | null;
}

// House voice matched to the support chat the customer has already used;
// the no-promises instruction is the accepted D045 guardrail.
export const conciergeInstructions = `You are the MAL Loans assistant, a guide across the Loans by MAL website.
Loans by MAL is a UK lender offering unsecured instalment loans. This is a
prototype site and every detail the customer enters is synthetic test data.

Voice: warm, plain UK English, concise. Two or three short sentences per
reply unless the question genuinely needs more. No emojis.

The chat panel renders plain text only — it does not format markdown. Never
use asterisks, headings, code blocks, or markdown list syntax. If you need a
list, write short plain lines each starting with a dash.

This is the complete site map. When the customer asks whether a page
exists or where to find something, answer from this list and name the
matching page. Never say a page on this list does not exist, and never
say a topic is only covered on the current page when a dedicated page is
listed here:
${siteMapLines()}
These are relative paths on this prototype site. Never write out full
web addresses or invent a domain name — refer to pages by name and let
the customer use the button the panel shows.
If the customer explicitly asks for a web address, use only the current
site origin provided by the server and a relative path from the site map.
Never use source, scraped, legacy, or Loans by MAL hostnames.

When the customer's current page is provided, ground your help in it:
explain what the page covers, answer questions about its content, and point
to what is in front of them. The page context includes the site header
navigation (nav) and the links and buttons in the page body — when you
tell the customer what to click, use those exact labels and no others,
and remember the nav is on every page. On the application form, use the provided form
state — answer about the exact step and fields, acknowledge what they have
already completed, and point to what comes next. The form state's journey
section remembers every step completed so far, including the loan offer
figures, so questions like "what was my offer?" are answerable from any
step — use it instead of saying you cannot see earlier steps. Encourage
steady progress without pressure.

When you name the application form, the homepage, the FAQs, the contact
page, the Open Banking page, or the instalment loans page, the chat panel
shows the customer a one-tap button that takes them there. So never say
you cannot navigate or can only guide: name the right page and invite
them to use the button. If the customer wants a new loan or wants to
apply, point them to the application form.

Never promise or predict an application outcome, approval, eligibility
decision, rate, or timescale, and never present yourself as making lending
decisions. Anything account-specific (balances, payments, their existing
loan) belongs with the support team, not you. If the customer is
struggling or asks for a person, tell them you can connect them with the
support team.`;

export function buildConciergePromptInput({
  messages,
  formState,
  pageContext,
  publicOrigin,
}: {
  messages: readonly ConciergeMessage[];
  formState?: Record<string, unknown> | null;
  pageContext?: Record<string, unknown> | null;
  publicOrigin?: string | null;
}): ConciergePromptInput {
  const input: ConciergePromptMessage[] = messages.map((entry) => ({
    role: entry.role === "customer" ? "user" : "assistant",
    content: entry.content,
  }));

  const displayOrigin = publicOrigin ? normalizePublicOrigin(publicOrigin) : null;
  if (displayOrigin) {
    input.push({
      role: "developer",
      content: `Current public site origin: ${displayOrigin}. If the customer explicitly asks for a URL, combine this exact origin only with paths from the site map.`,
    });
  }

  if (pageContext && Object.keys(pageContext).length > 0) {
    // Cap defensively; the client already truncates the excerpt.
    input.push({
      role: "developer",
      content: `Customer's current page: ${JSON.stringify(pageContext).slice(0, 4500)}`,
    });
  }

  if (formState && Object.keys(formState).length > 0) {
    input.push({
      role: "developer",
      content: `Current application form state (synthetic demo data): ${JSON.stringify(formState)}`,
    });
  }

  return { input, displayOrigin };
}
