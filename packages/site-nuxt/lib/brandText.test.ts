import { describe, expect, it } from "vitest";

import { normalizeDemoBrandText } from "./brandText";

describe("normalizeDemoBrandText", () => {
  it("removes the LoanSlam team leak from customer-facing handoff copy", () => {
    expect(
      normalizeDemoBrandText(
        "I can pass this to the LoanSlam team so a person can help.",
      ),
    ).toBe("I can pass this to the support team so a person can help.");
  });

  it("keeps general product copy on the Loans by MAL brand", () => {
    expect(
      normalizeDemoBrandText(
        "Ask another LoanSlam loan question or visit https://loanslam.co.uk/open-banking/. Start at https://apply.loanslam.co.uk/step-one/step-one.html.",
      ),
    ).toBe(
      "Ask another Loans by MAL loan question or visit https://loansbymal.co.uk/open-banking/. Start at https://applyloansbymal.co.uk/step-one/step-one.html.",
    );
  });
});
