// DOM-free stub test for the snapshot serializer (no jsdom dependency).
// Live-flow behavior (what the concierge actually says about the form) is
// proven on the integration surface, not here; this pins the serialization
// rules that produced the 2026-07-03 UAT bug: checkboxes always reported
// their constant .value ("on"), and the last radio in a group always won.

import { afterEach, describe, expect, it, vi } from "vitest";

import { snapshotApplicationForm } from "./formSnapshot";

interface StubField {
  name: string;
  value: string;
  type: string;
  checked?: boolean;
}

function stubDocument(fields: StubField[], step: string | null = "Step 1 of 9") {
  const root = {
    querySelector: (selector: string) =>
      selector === ".progress-eyebrow" && step !== null ? { textContent: ` ${step} ` } : null,
    querySelectorAll: () => fields,
  };
  vi.stubGlobal("document", {
    querySelector: (selector: string) => (selector === "section.application" ? root : null),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("snapshotApplicationForm", () => {
  it("returns null when no application section is rendered", () => {
    vi.stubGlobal("document", { querySelector: () => null });
    expect(snapshotApplicationForm()).toBeNull();
  });

  it("reports text, number, and select values verbatim with the trimmed step", () => {
    stubDocument([
      { name: "firstName", value: "Priya", type: "text" },
      { name: "monthlyIncome", value: "2600", type: "number" },
      { name: "employmentStatus", value: "", type: "select-one" },
    ]);
    expect(snapshotApplicationForm()).toEqual({
      step: "Step 1 of 9",
      fields: { firstName: "Priya", monthlyIncome: "2600", employmentStatus: "" },
      journey: null,
    });
  });

  it("carries the published journey state when the hook is present", () => {
    stubDocument([{ name: "signature", value: "", type: "text" }]);
    const journey = {
      step: 4,
      stepTitle: "Read and sign",
      offer: { "Loan advance": "£2,500.00" },
    };
    vi.stubGlobal("window", { __malJourneyState: journey });
    expect(snapshotApplicationForm()?.journey).toEqual(journey);
  });

  it("reports checkbox state from .checked, never the constant .value", () => {
    stubDocument([
      { name: "acceptTerms", value: "on", type: "checkbox", checked: false },
      { name: "smsMarketing", value: "on", type: "checkbox", checked: true },
    ]);
    expect(snapshotApplicationForm()?.fields).toEqual({
      acceptTerms: "unchecked",
      smsMarketing: "checked",
    });
  });

  it("reports the selected radio's value even when later radios follow in the DOM", () => {
    stubDocument([
      { name: "loanTerm", value: "36", type: "radio", checked: false },
      { name: "loanTerm", value: "24", type: "radio", checked: true },
      { name: "loanTerm", value: "12", type: "radio", checked: false },
      { name: "loanTerm", value: "9", type: "radio", checked: false },
    ]);
    expect(snapshotApplicationForm()?.fields).toEqual({ loanTerm: "24" });
  });

  it("reports an unanswered radio group as empty", () => {
    stubDocument([
      { name: "loanTerm", value: "24", type: "radio", checked: false },
      { name: "loanTerm", value: "9", type: "radio", checked: false },
    ]);
    expect(snapshotApplicationForm()?.fields).toEqual({ loanTerm: "" });
  });

  it("reports a missing progress eyebrow as a null step", () => {
    stubDocument([{ name: "firstName", value: "", type: "text" }], null);
    expect(snapshotApplicationForm()?.step).toBeNull();
  });
});
