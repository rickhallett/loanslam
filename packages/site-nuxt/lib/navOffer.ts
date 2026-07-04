// Deterministic navigation offers for concierge replies, mirroring the
// dc-003/dc-006 quick-action pattern: when the concierge names a site page,
// the panel renders a one-tap chip to it. The model never navigates; this
// whitelist is the entire action surface, and the chip is suppressed on the
// page it points to.

export interface NavOffer {
  label: string;
  path: string;
}

const NAV_OFFERS: Array<NavOffer & { pattern: RegExp }> = [
  {
    pattern:
      /application form|apply (?:page|now|online)|start (?:an?|your) application/i,
    label: "Take me to the application",
    path: "/apply/",
  },
  {
    pattern: /home ?page/i,
    label: "Take me to the homepage",
    path: "/",
  },
  {
    pattern: /\bFAQs?\b/i,
    label: "Take me to the FAQs",
    path: "/faq/",
  },
  // Page-anchored on purpose: "Open Banking" and "instalment loans" appear
  // constantly in ordinary product copy; only an explicit page mention
  // should offer navigation.
  {
    pattern: /open banking page/i,
    label: "Take me to the Open Banking page",
    path: "/open-banking/",
  },
  {
    pattern: /instalment loans? page/i,
    label: "Take me to the instalment loans page",
    path: "/instalment-loan/",
  },
  {
    pattern: /contact (?:page|form)/i,
    label: "Take me to the contact page",
    path: "/contact/",
  },
];

function normalizePath(routePath: string): string {
  const trimmed = routePath.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

// Exposed for the siteMap drift test: every offer must point at a mapped page.
export const navOfferPaths: string[] = NAV_OFFERS.map((offer) => offer.path);

export function navOfferForReply(
  reply: string,
  currentPath: string,
): NavOffer | null {
  const current = normalizePath(currentPath);
  for (const offer of NAV_OFFERS) {
    if (normalizePath(offer.path) === current) continue;
    if (offer.pattern.test(reply)) {
      return { label: offer.label, path: offer.path };
    }
  }
  return null;
}
