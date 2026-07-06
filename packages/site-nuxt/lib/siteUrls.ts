import {
  canonicalHost,
  localPathForFirstPartyUrl,
  normalizePublicOrigin,
  normalizeSitePath,
} from "./siteRoutePolicy";

export { normalizePublicOrigin, normalizeSitePath } from "./siteRoutePolicy";

const urlPattern = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
const trailingUrlPunctuation = /[.,!?;:]+$/;

function splitTrailingPunctuation(candidate: string): {
  urlText: string;
  trailing: string;
} {
  const trailing = candidate.match(trailingUrlPunctuation)?.[0] ?? "";
  return trailing
    ? { urlText: candidate.slice(0, -trailing.length), trailing }
    : { urlText: candidate, trailing: "" };
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

  return localPathForFirstPartyUrl(parsed, currentHost);
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
