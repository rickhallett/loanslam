import { getQuery, getRequestURL, sendRedirect, setResponseHeader } from "h3";

import {
  reportsAuthConfigured,
  reportsAuthConfig,
  reportsAuthRequiredForHostname,
  safeReportsNext,
} from "../../utils/reportsAuth";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  const config = reportsAuthConfig();
  const next = safeReportsNext(getQuery(event).next);
  if (
    !reportsAuthRequiredForHostname(getRequestURL(event).hostname, config)
  ) {
    await sendRedirect(event, next, 302);
    return;
  }

  return loginHtml({
    configured: reportsAuthConfigured(config),
    next,
  });
});

function loginHtml({
  configured,
  error,
  next,
}: {
  configured: boolean;
  error?: string;
  next: string;
}): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>Reports access</title>
    <style>
      :root{color-scheme:light;--ink:#20242a;--muted:#69727d;--line:#dce2e8;--accent:#1f6feb;--bad:#b42318}
      *{box-sizing:border-box}
      body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f8fa;color:var(--ink);font:15px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      main{width:min(92vw,380px);padding:28px;border:1px solid var(--line);background:#fff}
      h1{margin:0 0 8px;font-size:1.35rem}
      p{margin:0 0 18px;color:var(--muted)}
      label{display:block;font-weight:650;margin:0 0 6px}
      input{width:100%;min-height:42px;padding:8px 10px;border:1px solid #b8c2cc;font:inherit}
      button{margin-top:14px;min-height:42px;width:100%;border:0;background:var(--accent);color:#fff;font-weight:700;font:inherit;cursor:pointer}
      .error{color:var(--bad);font-weight:650}
    </style>
  </head>
  <body>
    <main>
      <h1>Reports access</h1>
      <p>${configured ? "Enter the reports password to continue." : "Reports access is not configured on this server."}</p>
      ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
      <form method="post" action="/reports/login">
        <input type="hidden" name="next" value="${escapeHtml(next)}">
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" autofocus ${configured ? "" : "disabled"}>
        <button type="submit" ${configured ? "" : "disabled"}>Continue</button>
      </form>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export { loginHtml };
