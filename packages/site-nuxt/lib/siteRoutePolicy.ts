import { sitePages } from "./siteMap";

export const loansByMalSiteHost = "loansbymal.co.uk";
export const loanSlamSiteHost = "loanslam.co.uk";
export const loansByMalApplicationHost = "applyloansbymal.co.uk";
export const loanSlamApplicationHost = "apply.loanslam.co.uk";
export const loanSlamApplicationHostAlias = "apply.loansbymal.co.uk";
export const loginHost = "monthlyadvanceloans.anchor.co.uk";

export const firstPartySiteHosts = [
  loansByMalSiteHost,
  loanSlamSiteHost,
] as const;

export const firstPartyApplicationHosts = [
  loansByMalApplicationHost,
  loanSlamApplicationHost,
  loanSlamApplicationHostAlias,
] as const;

export const firstPartyHosts = [
  ...firstPartyApplicationHosts,
  loginHost,
  ...firstPartySiteHosts,
] as const;

export type SiteRouteTarget = "site" | "application" | "login";

export type SiteRouteResolution =
  | {
      kind: "local_route";
      target: SiteRouteTarget;
      path: string;
      sourceHost: string;
      sourcePath: string;
      preservesUrlSuffix: boolean;
    }
  | {
      kind: "unknown_first_party_path";
      target: "site";
      sourceHost: string;
      sourcePath: string;
    }
  | {
      kind: "external_url";
      sourceHost: string;
      sourcePath: string;
    };

export interface SiteNavOfferRule {
  key:
    | "application"
    | "home"
    | "faq"
    | "open_banking"
    | "instalment_loan"
    | "contact";
  pattern: RegExp;
  label: string;
  path: string;
}

const siteHosts = new Set<string>(firstPartySiteHosts);
const applicationHosts = new Set<string>(firstPartyApplicationHosts);
const sitePagePaths = new Set(sitePages.map((page) => page.path));
const legacyPathAliases = new Map([
  ["/faqs", "/faq/"],
  ["/faqs/", "/faq/"],
]);

export const siteNavOfferRules = [
  {
    key: "application",
    pattern:
      /application form|apply (?:page|now|online)|start (?:an?|your) application/i,
    label: "Take me to the application",
    path: "/apply/",
  },
  {
    key: "home",
    pattern: /home ?page/i,
    label: "Take me to the homepage",
    path: "/",
  },
  {
    key: "faq",
    pattern: /\bFAQs?\b/i,
    label: "Take me to the FAQs",
    path: "/faq/",
  },
  // Page-anchored on purpose: these phrases appear constantly in ordinary
  // product copy; only an explicit page mention should offer navigation.
  {
    key: "open_banking",
    pattern: /open banking page/i,
    label: "Take me to the Open Banking page",
    path: "/open-banking/",
  },
  {
    key: "instalment_loan",
    pattern: /instalment loans? page/i,
    label: "Take me to the instalment loans page",
    path: "/instalment-loan/",
  },
  {
    key: "contact",
    pattern: /contact (?:page|form)/i,
    label: "Take me to the contact page",
    path: "/contact/",
  },
] as const satisfies readonly SiteNavOfferRule[];

export const siteNavOfferPaths: string[] = siteNavOfferRules.map(
  (offer) => offer.path,
);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const firstPartyUrlPattern = new RegExp(
  `https?:\\/\\/\\s*(?:www\\.)?(?:${firstPartyHosts
    .map(escapeRegExp)
    .join("|")})(?:\\/[^"'<\\s]*)?`,
  "gi",
);

export function canonicalHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function isApplicationHost(hostname: string): boolean {
  return applicationHosts.has(canonicalHost(hostname));
}

export function isSiteHost(hostname: string): boolean {
  return siteHosts.has(canonicalHost(hostname));
}

export function isLoginHost(hostname: string): boolean {
  return canonicalHost(hostname) === loginHost;
}

export function comparablePath(routePath: string): string {
  const trimmed = routePath.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

export function normalizePublicOrigin(origin: string): string {
  try {
    return new URL(origin).origin;
  } catch {
    return "http://localhost";
  }
}

export function normalizeSitePath(pathname: string): string | null {
  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const aliased = legacyPathAliases.get(withLeadingSlash);
  if (aliased) return aliased;

  const normalized = withLeadingSlash.endsWith("/")
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
  return sitePagePaths.has(normalized) ? normalized : null;
}

export function resolveSiteRouteUrl(
  url: URL,
  currentHost?: string | null,
): SiteRouteResolution {
  const host = canonicalHost(url.hostname);
  const normalizedCurrentHost = currentHost ? canonicalHost(currentHost) : null;

  if (normalizedCurrentHost && host === normalizedCurrentHost) {
    return resolvedSitePath(host, url.pathname);
  }

  if (isApplicationHost(host)) {
    return {
      kind: "local_route",
      target: "application",
      path: "/apply/",
      sourceHost: host,
      sourcePath: url.pathname,
      preservesUrlSuffix: false,
    };
  }

  if (isLoginHost(host)) {
    return {
      kind: "local_route",
      target: "login",
      path: "/login/",
      sourceHost: host,
      sourcePath: url.pathname,
      preservesUrlSuffix: false,
    };
  }

  if (isSiteHost(host)) {
    return resolvedSitePath(host, url.pathname);
  }

  return {
    kind: "external_url",
    sourceHost: host,
    sourcePath: url.pathname,
  };
}

export function localPathForFirstPartyUrl(
  url: URL,
  currentHost?: string | null,
): string | null {
  const resolved = resolveSiteRouteUrl(url, currentHost);
  return resolved.kind === "local_route" ? resolved.path : null;
}

function resolvedSitePath(host: string, pathname: string): SiteRouteResolution {
  const path = normalizeSitePath(pathname);

  if (!path) {
    return {
      kind: "unknown_first_party_path",
      target: "site",
      sourceHost: host,
      sourcePath: pathname,
    };
  }

  return {
    kind: "local_route",
    target: "site",
    path,
    sourceHost: host,
    sourcePath: pathname,
    preservesUrlSuffix: true,
  };
}

function rewriteFirstPartyContentUrl(match: string): string {
  let parsed: URL;
  try {
    parsed = new URL(match.replace(/:\/\/\s*/, "://"));
  } catch {
    return match;
  }

  const resolved = resolveSiteRouteUrl(parsed);
  if (resolved.kind !== "local_route") return match;
  if (!resolved.preservesUrlSuffix) return resolved.path;
  return `${resolved.path}${parsed.search}${parsed.hash}`;
}

/** Original absolute URLs become local paths when the rebuilt site renders that route. */
export function rewriteLinks(html: string): string {
  return html
    .replace(firstPartyUrlPattern, rewriteFirstPartyContentUrl)
    .replace(/href="\/cdn-cgi\/l\/email-protection#[^"]+"/g, 'href="/contact/"')
    .replace(
      /http:\/\/moneyadviceservice\.org\.uk\/?/g,
      "https://www.moneyhelper.org.uk",
    );
}
