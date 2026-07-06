import {
  comparablePath,
  isApplicationHost,
  siteNavOfferPaths,
  siteNavOfferRules,
} from "./siteRoutePolicy";

// Deterministic navigation offers for concierge replies, mirroring the
// dc-003/dc-006 quick-action pattern: when the concierge names a site page,
// the panel renders a one-tap chip to it. The model never navigates; this
// whitelist is the entire action surface, and the chip is suppressed on the
// page it points to.

export interface NavOffer {
  label: string;
  path: string;
}

export interface LinkCandidate {
  label: string;
  url?: string | null;
  href?: string | null;
}

const refusalReplyPattern =
  /\b(?:I cannot answer|I can't answer|I can only help|I'm not able to help|I am not able to help)\b/i;
const markdownLinkPattern = /\[[^\]]+\]\([^)]+\)/g;
const applicationFormLabelPattern =
  /\b(?:application form|apply(?: now| online)?)\b/i;

function offerText(reply: string): string {
  return reply.replace(markdownLinkPattern, "");
}

// Exposed for the siteMap drift test: every offer must point at a mapped page.
export const navOfferPaths: string[] = siteNavOfferPaths;

export function hasApplicationFormLink(
  links: readonly LinkCandidate[],
): boolean {
  return links.some((link) => {
    const target = link.url ?? link.href ?? "";
    if (!target) return false;

    try {
      const url = new URL(target, "https://mal-demo.local");
      const path = comparablePath(url.pathname);
      const pointsToApplication =
        isApplicationHost(url.hostname) || path === "/apply";
      return (
        pointsToApplication && applicationFormLabelPattern.test(link.label)
      );
    } catch {
      return false;
    }
  });
}

export function navOfferForReply(
  reply: string,
  currentPath: string,
): NavOffer | null {
  const text = offerText(reply);
  if (refusalReplyPattern.test(text)) return null;

  const current = comparablePath(currentPath);
  for (const offer of siteNavOfferRules) {
    if (comparablePath(offer.path) === current) continue;
    if (offer.pattern.test(text)) {
      return { label: offer.label, path: offer.path };
    }
  }
  return null;
}
