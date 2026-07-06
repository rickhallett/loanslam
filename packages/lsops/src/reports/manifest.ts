import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface ReportManifest {
  reports: ReportEntry[];
}

export interface ReportEntry {
  id: string;
  title: string;
  date: string;
  campaign: string;
  kind: string;
  source: {
    type: "markdown" | "static-html";
    path: string;
  };
  summary: string;
  provenance?: string[];
}

export function loadReportManifest(root: string): ReportManifest {
  const manifestPath = resolve(root, "packages/review-host/reports-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ReportManifest;
  validateReportManifest(root, manifest);
  return manifest;
}

export function validateReportManifest(root: string, manifest: ReportManifest): void {
  const reports = manifest.reports;
  if (!Array.isArray(reports) || reports.length === 0) {
    throw new Error("manifest has no reports");
  }

  for (const report of reports) {
    for (const field of [
      "id",
      "title",
      "date",
      "campaign",
      "kind",
      "source",
      "summary",
    ] as const) {
      if (!report[field]) {
        throw new Error(`report '${report.id || "?"}' is missing '${field}'`);
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(report.date)) {
      throw new Error(`report '${report.id}' has non ISO date '${report.date}'`);
    }
    if (!existsSync(resolve(root, report.source.path))) {
      throw new Error(
        `report '${report.id}' source does not exist: ${report.source.path}`,
      );
    }
  }

  const ids = new Set(reports.map((report) => report.id));
  if (ids.size !== reports.length) {
    throw new Error("duplicate report ids in manifest");
  }
}
