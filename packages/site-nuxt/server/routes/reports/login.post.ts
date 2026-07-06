import {
  getQuery,
  getRequestURL,
  readBody,
  sendRedirect,
  setResponseHeader,
  setResponseStatus,
} from "h3";

import { loginHtml } from "./login.get";
import {
  createReportsSessionToken,
  reportsAuthConfigured,
  reportsAuthConfig,
  reportsAuthRequiredForHostname,
  reportsPasswordMatches,
  safeReportsNext,
  setReportsSessionCookie,
} from "../../utils/reportsAuth";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");

  const body = await readBody<Record<string, unknown>>(event);
  const next = safeReportsNext(body.next ?? getQuery(event).next);
  const password = typeof body.password === "string" ? body.password : "";
  const config = reportsAuthConfig();

  if (
    !reportsAuthRequiredForHostname(getRequestURL(event).hostname, config)
  ) {
    await sendRedirect(event, next, 302);
    return;
  }

  if (!reportsAuthConfigured(config)) {
    setResponseStatus(event, 503);
    return loginHtml({
      configured: false,
      error: "Reports access is not configured on this server.",
      next,
    });
  }

  if (!reportsPasswordMatches(password, config)) {
    setResponseStatus(event, 401);
    return loginHtml({
      configured: true,
      error: "Password did not match.",
      next,
    });
  }

  setReportsSessionCookie(
    event,
    createReportsSessionToken({ config }),
    config,
  );
  await sendRedirect(event, next, 302);
});
