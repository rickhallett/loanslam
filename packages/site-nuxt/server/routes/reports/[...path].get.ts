import { getRouterParam } from "h3";

import { requireReportsAuth, sendReportFile } from "../../utils/reportsAuth";

export default defineEventHandler(async (event) => {
  if (!(await requireReportsAuth(event))) {
    return;
  }

  await sendReportFile(event, getRouterParam(event, "path") ?? "index.html");
});
