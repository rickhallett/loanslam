import type { CorpusItem } from "@loanslam/contracts";
import { describe, expect, it } from "vitest";

import { retrieveMatches } from "./retriever";

describe("lexical retrieval", () => {
  it("uses deterministic item id ordering for tied scores", () => {
    const tiedItems: CorpusItem[] = [
      {
        id: "tie-b",
        question: "Shared phrase",
        serving_mode: "answer",
        answer_text: "Shared phrase.",
      },
      {
        id: "tie-a",
        question: "Shared phrase",
        serving_mode: "answer",
        answer_text: "Shared phrase.",
      },
    ];

    expect(
      retrieveMatches("shared", tiedItems).map((match) => match.itemId),
    ).toEqual(["tie-a", "tie-b"]);
  });
});
