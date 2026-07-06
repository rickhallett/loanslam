import { requireReportsAuth, sendReportFile } from "../../utils/reportsAuth";

export default defineEventHandler(async (event) => {
  if (!(await requireReportsAuth(event))) {
    return;
  }

  await sendReportFile(event, "index.html");
});
