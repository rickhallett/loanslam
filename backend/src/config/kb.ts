import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { kbItemSchema, type KbItem } from '@loanslam/contracts';

const here = dirname(fileURLToPath(import.meta.url));
// src/config -> backend/data (works under tsx and compiled dist/src/config).
const KB_PATH = resolve(here, '../../data/loanslam-synthetic-kb.json');

const kbFileSchema = z.object({
  version: z.string().optional(),
  item_count: z.number().optional(),
  items: z.array(kbItemSchema),
});

/**
 * Load + validate the approved knowledge base once at startup. Validation here
 * means a malformed corpus fails loudly instead of silently degrading the
 * grounding gate. The loaded items are the single source of grounded answers.
 */
export function loadKnowledgeBase(): KbItem[] {
  const raw = JSON.parse(readFileSync(KB_PATH, 'utf-8'));
  const parsed = kbFileSchema.parse(raw);
  return parsed.items;
}

let cached: KbItem[] | null = null;
export function knowledgeBase(): KbItem[] {
  if (!cached) cached = loadKnowledgeBase();
  return cached;
}
