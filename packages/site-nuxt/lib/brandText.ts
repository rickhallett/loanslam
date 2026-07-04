export function normalizeDemoBrandText(text: string): string {
  return text
    .replace(/\bthe LoanSlam team\b/g, "the support team")
    .replace(/\bThe LoanSlam team\b/g, "The support team")
    .replace(/\bLoanSlam team\b/g, "support team")
    .replace(/\bLoanslam team\b/g, "support team")
    .replace(/\bLoanSlam\b/g, "Loans by MAL")
    .replace(/\bLoanslam\b/g, "Loans by MAL")
    .replace(/\bapply\.loanslam\.co\.uk\b/gi, "applyloansbymal.co.uk")
    .replace(/\bloanslam\.co\.uk\b/gi, "loansbymal.co.uk");
}
