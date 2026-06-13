import { describe, expect, it } from "vitest";

import { loadCorpusFromFile, parseCorpusDocument } from "./corpus";

describe("corpus loader", () => {
  it("loads all items from the default synthetic knowledge base", () => {
    const corpus = loadCorpusFromFile();

    expect(corpus.items).toHaveLength(60);
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
});
