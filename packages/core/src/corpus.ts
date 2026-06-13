import { readFileSync } from "node:fs";

import { corpusItemSchema, type CorpusItem } from "@loanslam/contracts";
import { z } from "zod";

export const defaultCorpusPath = "data/public-info/loanslam-synthetic-kb.json";

const sourceCorpusItemSchema = z.preprocess((value) => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("answer_text" in value) ||
    value.answer_text !== null
  ) {
    return value;
  }

  const { answer_text: _answerText, ...itemWithoutNullAnswer } = value;
  return itemWithoutNullAnswer;
}, corpusItemSchema);

const corpusDocumentSchema = z
  .object({
    version: z.string().trim().optional(),
    item_count: z.number().int().nonnegative().optional(),
    note: z.string().trim().optional(),
    contacts: z.unknown().optional(),
    items: z.array(sourceCorpusItemSchema),
  })
  .superRefine((document, context) => {
    if (
      document.item_count !== undefined &&
      document.item_count !== document.items.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["item_count"],
        message: `item_count ${document.item_count} does not match ${document.items.length} items`,
      });
    }
  });

export type CorpusDocument = z.infer<typeof corpusDocumentSchema>;

export function parseCorpusDocument(document: unknown): CorpusDocument {
  return corpusDocumentSchema.parse(document);
}

export function loadCorpusFromFile(
  filePath = defaultCorpusPath,
): CorpusDocument {
  const rawDocument = readFileSync(filePath, "utf8");
  return parseCorpusDocument(JSON.parse(rawDocument));
}
