import { readFileSync } from "node:fs";

import { corpusItemSchema, type CorpusItem } from "@loanslam/contracts";
import { z } from "zod";

export const defaultCorpusPath = "data/public-info/loanslam-synthetic-kb.json";

export const corpusDeploymentStatusSchema = z.enum([
  "non_deployable_synthetic",
  "approved_runtime",
]);
export type CorpusDeploymentStatus = z.infer<
  typeof corpusDeploymentStatusSchema
>;

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
    deployment_status: corpusDeploymentStatusSchema.optional(),
    deployable: z.boolean().optional(),
    canonical_contact_source: z.string().trim().min(1).optional(),
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

    const hasSyntheticItems = document.items.some(
      (item) =>
        item.source_type === "synthetic" ||
        item.status === "draft_synthetic",
    );
    const hasSyntheticDocumentHint = [
      document.version,
      document.deployment_status,
      document.note,
    ].some((value) => value?.toLowerCase().includes("synthetic"));
    const isSyntheticCorpus = hasSyntheticItems || hasSyntheticDocumentHint;

    if (document.deployable === true && hasSyntheticItems) {
      context.addIssue({
        code: "custom",
        path: ["deployable"],
        message: "synthetic corpus items cannot be marked deployable",
      });
    }

    if (isSyntheticCorpus && document.deployable !== false) {
      context.addIssue({
        code: "custom",
        path: ["deployable"],
        message: "synthetic corpus documents must set deployable: false",
      });
    }

    if (
      isSyntheticCorpus &&
      document.deployment_status !== "non_deployable_synthetic"
    ) {
      context.addIssue({
        code: "custom",
        path: ["deployment_status"],
        message:
          "synthetic corpus documents must set deployment_status to non_deployable_synthetic",
      });
    }

    if (
      isSyntheticCorpus &&
      document.contacts !== undefined &&
      !document.canonical_contact_source
    ) {
      context.addIssue({
        code: "custom",
        path: ["canonical_contact_source"],
        message:
          "synthetic corpus contact facts must name the canonical contact source",
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
