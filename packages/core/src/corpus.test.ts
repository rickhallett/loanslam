import { describe, expect, it } from "vitest";

import { loadCorpusFromFile, parseCorpusDocument } from "./corpus";

describe("corpus loader", () => {
  it("loads all items from the default synthetic knowledge base", () => {
    const corpus = loadCorpusFromFile();

    expect(corpus.items).toHaveLength(60);
    expect(corpus.deployment_status).toBe("non_deployable_synthetic");
    expect(corpus.deployable).toBe(false);
    expect(corpus.canonical_contact_source).toBe(
      "packages/site-nuxt/data/site-copy/contact.json",
    );
    expect(corpus.items.map((item) => item.id)).toContain(
      "what-is-open-banking",
    );
  });

  it("rejects invalid corpus document shapes", () => {
    expect(() =>
      parseCorpusDocument({
        item_count: 1,
        items: [
          {
            id: "broken-answer",
            question: "How do I apply?",
            serving_mode: "answer",
          },
        ],
      }),
    ).toThrow(/answer_text/i);
  });

  it("requires synthetic corpus documents to be marked non-deployable", () => {
    expect(() =>
      parseCorpusDocument({
        item_count: 1,
        contacts: { phone: "0800 000 0000" },
        items: [
          {
            id: "synthetic-answer",
            question: "How do I apply?",
            serving_mode: "answer",
            answer_text: "Apply online.",
            source_type: "synthetic",
            status: "draft_synthetic",
          },
        ],
      }),
    ).toThrow(/deployable: false/i);
  });

  it("rejects deployable corpora that still contain synthetic items", () => {
    expect(() =>
      parseCorpusDocument({
        deployment_status: "approved_runtime",
        deployable: true,
        item_count: 1,
        items: [
          {
            id: "synthetic-answer",
            question: "How do I apply?",
            serving_mode: "answer",
            answer_text: "Apply online.",
            source_type: "synthetic",
            status: "draft_synthetic",
          },
        ],
      }),
    ).toThrow(/cannot be marked deployable/i);
  });
});
