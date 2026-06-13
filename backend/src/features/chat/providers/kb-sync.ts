import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import OpenAI, { toFile } from 'openai';
import { z } from 'zod';

import { env, type AppEnv } from '../../../config/env.js';

export interface KnowledgeBaseItem {
  id: string;
  serving_mode: string;
  question: string;
  question_variants: string[];
  answer_text?: string | null | undefined;
  links: Array<{ label: string; href: string }>;
  route_reason: string | null;
  section?: string | undefined;
  intent?: string | undefined;
  tags?: string[] | undefined;
  source_type?: string | undefined;
  status?: string | undefined;
}

export interface KnowledgeBase {
  version: string;
  item_count: number;
  items: KnowledgeBaseItem[];
}

export interface KbSyncVectorStore {
  id: string;
  name: string | null;
}

export interface KbSyncClient {
  listVectorStores(): Promise<KbSyncVectorStore[]>;
  createVectorStore(input: {
    name: string;
    metadata: Record<string, string>;
  }): Promise<KbSyncVectorStore>;
  updateVectorStore(
    id: string,
    input: { name: string; metadata: Record<string, string> },
  ): Promise<KbSyncVectorStore>;
  uploadAndAttachFile(
    vectorStoreId: string,
    file: File,
    attributes: Record<string, string | number | boolean>,
  ): Promise<{ id: string; status: string; lastError?: string | null | undefined }>;
}

export interface SyncKnowledgeBaseOptions {
  client: KbSyncClient;
  knowledgeBase: KnowledgeBase;
  vectorStoreName: string;
  generatedAt?: Date | undefined;
}

export interface SyncKnowledgeBaseResult {
  vectorStoreId: string;
  vectorStoreName: string;
  uploadedFileId: string;
  itemCount: number;
}

export interface RunKbSyncOptions {
  appEnv?: AppEnv | undefined;
  client?: KbSyncClient | undefined;
  knowledgeBasePath?: string | undefined;
  stdout?: Pick<NodeJS.WriteStream, 'write'> | undefined;
}

export class KbSyncConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KbSyncConfigurationError';
  }
}

const repoRoot = resolve(import.meta.dirname, '../../../../../');
const defaultKnowledgeBasePath = resolve(repoRoot, 'data/public-info/loanslam-synthetic-kb.json');

const linkSchema = z
  .object({
    label: z.string().min(1),
    href: z.string().url(),
  })
  .strict();

const knowledgeBaseItemSchema = z
  .object({
    id: z.string().min(1),
    serving_mode: z.string().min(1),
    question: z.string().min(1),
    question_variants: z.array(z.string().min(1)),
    answer_text: z.string().min(1).nullable().optional(),
    links: z.array(linkSchema).default([]),
    route_reason: z.string().min(1).nullable(),
    section: z.string().min(1).optional(),
    intent: z.string().min(1).optional(),
    tags: z.array(z.string().min(1)).optional(),
    source_type: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
  })
  .passthrough();

const knowledgeBaseSchema = z
  .object({
    version: z.string().min(1),
    item_count: z.number().int().positive(),
    items: z.array(knowledgeBaseItemSchema).min(1),
  })
  .passthrough()
  .superRefine((value, context) => {
    if (value.item_count !== value.items.length) {
      context.addIssue({
        code: 'custom',
        path: ['item_count'],
        message: 'item_count must match items.length',
      });
    }
  });

export async function runKbSync(options: RunKbSyncOptions = {}): Promise<SyncKnowledgeBaseResult> {
  const appEnv = options.appEnv ?? env;
  const knowledgeBase = await readKnowledgeBase(
    options.knowledgeBasePath ?? defaultKnowledgeBasePath,
  );
  const client = options.client ?? createOpenAIKbSyncClient(appEnv);
  const result = await syncKnowledgeBase({
    client,
    knowledgeBase,
    vectorStoreName: appEnv.OPENAI_VECTOR_STORE_NAME,
  });

  options.stdout?.write(`${formatVectorStoreOutput(result.vectorStoreId)}\n`);

  return result;
}

export async function readKnowledgeBase(path: string): Promise<KnowledgeBase> {
  const raw = await readFile(path, 'utf8');
  return parseKnowledgeBase(JSON.parse(raw));
}

export function parseKnowledgeBase(input: unknown): KnowledgeBase {
  return knowledgeBaseSchema.parse(input);
}

export function buildKnowledgeBaseMarkdown(knowledgeBase: KnowledgeBase): string {
  const sections = knowledgeBase.items.map((item) =>
    [
      `## ${item.id}`,
      '',
      `id: ${item.id}`,
      `serving_mode: ${item.serving_mode}`,
      `section: ${item.section ?? 'null'}`,
      `intent: ${item.intent ?? 'null'}`,
      `question: ${item.question}`,
      'variants:',
      ...formatList(item.question_variants),
      `answer_text: ${item.answer_text ?? 'null'}`,
      'links:',
      ...formatLinks(item.links),
      `route_reason: ${item.route_reason ?? 'null'}`,
      `tags: ${(item.tags ?? []).join(', ')}`,
      `source_type: ${item.source_type ?? 'null'}`,
      `status: ${item.status ?? 'null'}`,
    ].join('\n'),
  );

  return [
    '# Loanslam Support Knowledge Base',
    '',
    `version: ${knowledgeBase.version}`,
    `item_count: ${knowledgeBase.items.length}`,
    '',
    ...sections,
    '',
  ].join('\n');
}

export async function syncKnowledgeBase(
  options: SyncKnowledgeBaseOptions,
): Promise<SyncKnowledgeBaseResult> {
  const generatedAt = options.generatedAt ?? new Date();
  const metadata = createVectorStoreMetadata(options.knowledgeBase, generatedAt);
  const vectorStore = await findOrCreateVectorStore(options.client, {
    name: options.vectorStoreName,
    metadata,
  });
  const markdown = buildKnowledgeBaseMarkdown(options.knowledgeBase);
  const file = await toFile(Buffer.from(markdown), `${options.knowledgeBase.version}.md`, {
    type: 'text/markdown',
  });
  const uploaded = await options.client.uploadAndAttachFile(vectorStore.id, file, {
    source: 'loanslam-synthetic-kb',
    version: options.knowledgeBase.version,
    item_count: options.knowledgeBase.items.length,
    format: 'markdown',
    generated_at: generatedAt.toISOString(),
  });

  if (uploaded.status !== 'completed') {
    throw new Error(
      `KB vector store file did not complete: ${uploaded.status}${
        uploaded.lastError ? ` (${uploaded.lastError})` : ''
      }`,
    );
  }

  return {
    vectorStoreId: vectorStore.id,
    vectorStoreName: options.vectorStoreName,
    uploadedFileId: uploaded.id,
    itemCount: options.knowledgeBase.items.length,
  };
}

export function formatVectorStoreOutput(vectorStoreId: string): string {
  return `OPENAI_VECTOR_STORE_ID=${vectorStoreId}`;
}

function createOpenAIKbSyncClient(appEnv: AppEnv): OpenAIKbSyncClient {
  if (!appEnv.OPENAI_API_KEY) {
    throw new KbSyncConfigurationError('OPENAI_API_KEY is required to sync the KB');
  }

  return new OpenAIKbSyncClient(new OpenAI({ apiKey: appEnv.OPENAI_API_KEY }));
}

async function findOrCreateVectorStore(
  client: KbSyncClient,
  input: { name: string; metadata: Record<string, string> },
): Promise<KbSyncVectorStore> {
  const stores = await client.listVectorStores();
  const existing = stores.find((store) => store.name === input.name);
  if (!existing) {
    return client.createVectorStore(input);
  }

  return client.updateVectorStore(existing.id, input);
}

function createVectorStoreMetadata(
  knowledgeBase: KnowledgeBase,
  generatedAt: Date,
): Record<string, string> {
  return {
    source: 'loanslam-synthetic-kb',
    version: knowledgeBase.version,
    item_count: String(knowledgeBase.items.length),
    generated_at: generatedAt.toISOString(),
  };
}

function formatList(values: string[]): string[] {
  return values.length > 0 ? values.map((value) => `- ${value}`) : ['- null'];
}

function formatLinks(links: Array<{ label: string; href: string }>): string[] {
  return links.length > 0 ? links.map((link) => `- [${link.label}](${link.href})`) : ['- null'];
}

class OpenAIKbSyncClient implements KbSyncClient {
  constructor(private readonly client: OpenAI) {}

  async listVectorStores(): Promise<KbSyncVectorStore[]> {
    const stores: KbSyncVectorStore[] = [];

    for await (const store of this.client.vectorStores.list({ limit: 100 })) {
      stores.push({ id: store.id, name: store.name });
    }

    return stores;
  }

  async createVectorStore(input: {
    name: string;
    metadata: Record<string, string>;
  }): Promise<KbSyncVectorStore> {
    const store = await this.client.vectorStores.create({
      name: input.name,
      metadata: input.metadata,
    });

    return { id: store.id, name: store.name };
  }

  async updateVectorStore(
    id: string,
    input: { name: string; metadata: Record<string, string> },
  ): Promise<KbSyncVectorStore> {
    const store = await this.client.vectorStores.update(id, {
      name: input.name,
      metadata: input.metadata,
    });

    return { id: store.id, name: store.name };
  }

  async uploadAndAttachFile(
    vectorStoreId: string,
    file: File,
    attributes: Record<string, string | number | boolean>,
  ): Promise<{ id: string; status: string; lastError?: string | null | undefined }> {
    const uploaded = await this.client.files.create({
      file,
      purpose: 'assistants',
    });
    const attached = await this.client.vectorStores.files.createAndPoll(vectorStoreId, {
      file_id: uploaded.id,
      attributes,
    });

    return {
      id: attached.id,
      status: attached.status,
      lastError: attached.last_error?.message,
    };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runKbSync({ stdout: process.stdout }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown KB sync error';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
