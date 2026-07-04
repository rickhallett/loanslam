import { afterEach, describe, expect, it, vi } from "vitest";

import { snapshotPage } from "./pageSnapshot";

interface StubElement {
  tagName: string;
  textContent: string;
  value?: string;
  getAttribute: (name: string) => string | null;
}

function anchor(label: string, href: string): StubElement {
  return {
    tagName: "A",
    textContent: label,
    getAttribute: (name) => (name === "href" ? href : null),
  };
}

function button(label: string): StubElement {
  return { tagName: "BUTTON", textContent: label, getAttribute: () => null };
}

function stubDocument({
  headings = [] as StubElement[],
  anchors = [] as StubElement[],
  buttons = [] as StubElement[],
  navAnchors = [] as StubElement[],
  text = "",
} = {}) {
  const main = {
    textContent: text,
    querySelectorAll: (selector: string) => {
      if (selector === "h1, h2") return headings;
      if (selector === "a[href]") return anchors;
      if (selector === "button, input[type='submit']") return buttons;
      return [];
    },
  };
  const header = {
    querySelectorAll: (selector: string) => (selector === "a[href]" ? navAnchors : []),
  };
  vi.stubGlobal("document", {
    title: "Stub title",
    querySelector: (selector: string) => {
      if (selector === "main#main") return main;
      if (selector === "header") return header;
      return null;
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("snapshotPage", () => {
  it("collects deduped local links and skips hash fragments", () => {
    stubDocument({
      anchors: [
        anchor("Apply now", "/apply/"),
        anchor("Apply now", "/apply/"),
        anchor("Jump", "#section"),
        anchor("  FAQs\n  ", "/faq/"),
        anchor("", "/nowhere/"),
      ],
    });
    const snapshot = snapshotPage("/");
    expect(snapshot.links).toEqual([
      { label: "Apply now", href: "/apply/" },
      { label: "FAQs", href: "/faq/" },
    ]);
  });

  it("caps links at twenty", () => {
    stubDocument({
      anchors: Array.from({ length: 30 }, (_, i) => anchor(`Link ${i}`, `/page-${i}/`)),
    });
    expect(snapshotPage("/").links).toHaveLength(20);
  });

  it("collects button labels from text and submit values", () => {
    stubDocument({
      buttons: [
        button("Continue"),
        button("Continue"),
        {
          tagName: "INPUT",
          textContent: "",
          value: "Get my quote",
          getAttribute: () => null,
        },
      ],
    });
    expect(snapshotPage("/").buttons).toEqual(["Continue", "Get my quote"]);
  });

  it("collects the header nav separately from body links", () => {
    stubDocument({
      navAnchors: [
        anchor("Open Banking", "/open-banking/"),
        anchor("Login", "/login/"),
      ],
      anchors: [anchor("Apply now", "/apply/")],
    });
    const snapshot = snapshotPage("/");
    expect(snapshot.nav).toEqual([
      { label: "Open Banking", href: "/open-banking/" },
      { label: "Login", href: "/login/" },
    ]);
    expect(snapshot.links).toEqual([{ label: "Apply now", href: "/apply/" }]);
  });

  it("returns empty inventories without a main element", () => {
    vi.stubGlobal("document", { title: "Stub", querySelector: () => null });
    const snapshot = snapshotPage("/missing/");
    expect(snapshot.links).toEqual([]);
    expect(snapshot.buttons).toEqual([]);
    expect(snapshot.headings).toEqual([]);
  });
});
