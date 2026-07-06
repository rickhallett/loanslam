import {
  loansByMalApplicationHost,
  loansByMalSiteHost,
  loanSlamApplicationHost,
  loanSlamSiteHost,
} from "./siteRoutePolicy";

function literalPattern(value: string): RegExp {
  return new RegExp(
    `\\b${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
    "gi",
  );
}

export function normalizeDemoBrandText(text: string): string {
  return text
    .replace(/\bthe LoanSlam team\b/g, "the support team")
    .replace(/\bThe LoanSlam team\b/g, "The support team")
    .replace(/\bLoanSlam team\b/g, "support team")
    .replace(/\bLoanslam team\b/g, "support team")
    .replace(/\bLoanSlam\b/g, "Loans by MAL")
    .replace(/\bLoanslam\b/g, "Loans by MAL")
    .replace(literalPattern(loanSlamApplicationHost), loansByMalApplicationHost)
    .replace(literalPattern(loanSlamSiteHost), loansByMalSiteHost);
}
