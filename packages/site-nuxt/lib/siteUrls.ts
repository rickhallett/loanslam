import { sitePages } from "./siteMap";

const sitePagePaths = new Set(sitePages.map((page) => page.path));

const applicationHosts = new Set([
  "apply.loansbymal.co.uk",
  "apply.loanslam.co.uk",
  "applyloansbymal.co.uk",
]);
const siteHosts = new Set(["loansbymal.co.uk", "loanslam.co.uk"]);
const loginHost = "monthlyadvanceloans.anchor.co.uk";

const urlPattern = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
const trailingUrlPunctuation = /[.,!?;:]+$/;

function canonicalHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function splitTrailingPunctuation(candidate: string): {
  urlText: string;
  trailing: string;
} {
  const trailing = candidate.match(trailingUrlPunctuation)?.[0] ?? "";
  return trailing
    ? { urlText: candidate.slice(0, -trailing.length), trailing }
    : { urlText: candidate, trailing: "" };
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
  if (withLeadingSlash === "/faqs" || withLeadingSlash === "/faqs/")
    return "/faq/";

  const normalized = withLeadingSlash.endsWith("/")
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
  return sitePagePaths.has(normalized) ? normalized : null;
}

function pathForDisplayUrl(
  urlText: string,
  publicOrigin: string,
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(urlText.replace(/:\/\/\s+/, "://"));
  } catch {
    return null;
  }

  const host = canonicalHost(parsed.hostname);
  const currentHost = canonicalHost(
    new URL(normalizePublicOrigin(publicOrigin)).hostname,
  );

  if (host === currentHost) return normalizeSitePath(parsed.pathname);
  if (applicationHosts.has(host)) return "/apply/";
  if (host === loginHost) return "/login/";

  if (siteHosts.has(host)) {
    return normalizeSitePath(parsed.pathname);
  }

  return null;
}

export function displaySiteUrl(
  pathname: string,
  publicOrigin: string,
): string | null {
  const path = normalizeSitePath(pathname);
  return path
    ? new URL(path, normalizePublicOrigin(publicOrigin)).toString()
    : null;
}

export function rewriteDisplayedSiteUrls(
  text: string,
  publicOrigin: string,
): string {
  return text.replace(urlPattern, (candidate) => {
    const { urlText, trailing } = splitTrailingPunctuation(candidate);
    const path = pathForDisplayUrl(urlText, publicOrigin);
    return path
      ? `${new URL(path, normalizePublicOrigin(publicOrigin)).toString()}${trailing}`
      : candidate;
  });
}
