import { sitePages } from "./siteMap";

export const loansByMalSiteHost = "loansbymal.co.uk";
export const loanSlamSiteHost = "loanslam.co.uk";
export const loansByMalApplicationHost = "applyloansbymal.co.uk";
export const loanSlamApplicationHost = "apply.loanslam.co.uk";
export const loanSlamApplicationHostAlias = "apply.loansbymal.co.uk";
export const loginHost = "monthlyadvanceloans.anchor.co.uk";

const siteHosts = new Set([loansByMalSiteHost, loanSlamSiteHost]);
const applicationHosts = new Set([
  loansByMalApplicationHost,
  loanSlamApplicationHost,
  loanSlamApplicationHostAlias,
]);
const firstPartyHosts = [...applicationHosts, loginHost, ...siteHosts];
const sitePagePaths = new Set(sitePages.map((page) => page.path));
const legacyPathAliases = new Map([
  ["/faqs", "/faq/"],
  ["/faqs/", "/faq/"],
]);

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

export function localPathForFirstPartyUrl(
  url: URL,
  currentHost?: string | null,
): string | null {
  const host = canonicalHost(url.hostname);
  const normalizedCurrentHost = currentHost ? canonicalHost(currentHost) : null;

  if (normalizedCurrentHost && host === normalizedCurrentHost) {
    return normalizeSitePath(url.pathname);
  }
  if (isApplicationHost(host)) return "/apply/";
  if (isLoginHost(host)) return "/login/";
  if (isSiteHost(host)) return normalizeSitePath(url.pathname);

  return null;
}

function rewriteFirstPartyContentUrl(match: string): string {
  let parsed: URL;
  try {
    parsed = new URL(match.replace(/:\/\/\s*/, "://"));
  } catch {
    return match;
  }

  const localPath = localPathForFirstPartyUrl(parsed);
  if (!localPath) return match;
  if (isApplicationHost(parsed.hostname) || isLoginHost(parsed.hostname)) {
    return localPath;
  }
  return `${localPath}${parsed.search}${parsed.hash}`;
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
