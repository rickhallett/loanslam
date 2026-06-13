import { describe, expect, it } from 'vitest';

import {
  buildKnowledgeBaseMarkdown,
  formatVectorStoreOutput,
  parseKnowledgeBase,
  syncKnowledgeBase,
  type KbSyncClient,
  type KnowledgeBase,
} from './kb-sync.js';

const knowledgeBase: KnowledgeBase = {
  version: 'loanslam-synthetic-kb-test',
  item_count: 2,
  items: [
    {
      id: 'how-to-apply',
      serving_mode: 'answer',
      question: 'How do I apply?',
      question_variants: ['Can I apply online?'],
      answer_text: 'Apply online through the Loanslam application form.',
      links: [{ label: 'application form', href: 'https://apply.loanslam.co.uk/apply' }],
      route_reason: null,
      section: 'application_questions',
      intent: 'how-to-apply',
      tags: ['apply'],
      source_type: 'synthetic',
      status: 'draft_synthetic',
    },
    {
      id: 'change-payment-date',
      serving_mode: 'handoff_account_specific',
      question: 'Can you change my payment date?',
      question_variants: ['Move my Direct Debit'],
      links: [],
      route_reason: 'account_specific_change',
      section: 'repayment_questions',
      intent: 'change-payment-date',
      tags: ['repayments'],
      source_type: 'synthetic',
      status: 'draft_synthetic',
    },
  ],
};

describe('kb sync', () => {
  it('builds markdown with one section per KB item and route fields', () => {
    const markdown = buildKnowledgeBaseMarkdown(knowledgeBase);

    expect(markdown).toContain('# Loanslam Support Knowledge Base');
    expect(markdown).toContain('## how-to-apply');
    expect(markdown).toContain('serving_mode: answer');
    expect(markdown).toContain('question: How do I apply?');
    expect(markdown).toContain('- Can I apply online?');
    expect(markdown).toContain('answer_text: Apply online through the Loanslam application form.');
    expect(markdown).toContain('- [application form](https://apply.loanslam.co.uk/apply)');
    expect(markdown).toContain('## change-payment-date');
    expect(markdown).toContain('answer_text: null');
    expect(markdown).toContain('route_reason: account_specific_change');
  });

  it('accepts route-only KB items with null answer text', () => {
    const parsed = parseKnowledgeBase({
      version: 'loanslam-synthetic-kb-test',
      item_count: 1,
      items: [
        {
          id: 'route-only',
          serving_mode: 'route_vulnerability',
          question: 'I cannot afford this',
          question_variants: [],
          answer_text: null,
          links: [],
          route_reason: 'vulnerability_signal',
        },
      ],
    });

    expect(parsed.items[0]?.answer_text).toBeNull();
    expect(buildKnowledgeBaseMarkdown(parsed)).toContain('answer_text: null');
  });

  it('creates a named vector store and uploads the generated KB file', async () => {
    const client = new FakeKbSyncClient();

    const result = await syncKnowledgeBase({
      client,
      knowledgeBase,
      vectorStoreName: 'loanslam-support-kb',
    });

    expect(result.vectorStoreId).toBe('vs_created');
    expect(client.createdStores).toHaveLength(1);
    expect(client.createdStores[0]?.name).toBe('loanslam-support-kb');
    expect(client.createdStores[0]?.metadata.source).toBe('loanslam-synthetic-kb');
    expect(client.createdStores[0]?.metadata.version).toBe('loanslam-synthetic-kb-test');
    expect(client.createdStores[0]?.metadata.item_count).toBe('2');
    expect(client.uploads).toHaveLength(1);
    expect(client.uploads[0]?.vectorStoreId).toBe('vs_created');
    expect(client.uploads[0]?.attributes.source).toBe('loanslam-synthetic-kb');
    expect(client.uploads[0]?.attributes.version).toBe('loanslam-synthetic-kb-test');
    expect(client.uploads[0]?.attributes.item_count).toBe(2);
    expect(client.uploads[0]?.attributes.format).toBe('markdown');
    expect(client.uploads[0]?.file.name).toBe('loanslam-synthetic-kb-test.md');
    expect(await client.uploads[0]?.file.text()).toContain('## how-to-apply');
  });

  it('updates an existing named vector store instead of creating another one', async () => {
    const client = new FakeKbSyncClient([{ id: 'vs_existing', name: 'loanslam-support-kb' }]);

    const result = await syncKnowledgeBase({
      client,
      knowledgeBase,
      vectorStoreName: 'loanslam-support-kb',
    });

    expect(result.vectorStoreId).toBe('vs_existing');
    expect(client.createdStores).toHaveLength(0);
    expect(client.updatedStores).toHaveLength(1);
    expect(client.updatedStores[0]?.id).toBe('vs_existing');
    expect(client.updatedStores[0]?.name).toBe('loanslam-support-kb');
    expect(client.updatedStores[0]?.metadata.version).toBe('loanslam-synthetic-kb-test');
  });

  it('formats only the vector store id for env output', () => {
    expect(formatVectorStoreOutput('vs_123')).toBe('OPENAI_VECTOR_STORE_ID=vs_123');
  });
});

class FakeKbSyncClient implements KbSyncClient {
  readonly createdStores: Array<{
    name: string;
    metadata: Record<string, string>;
  }> = [];
  readonly updatedStores: Array<{
    id: string;
    name: string;
    metadata: Record<string, string>;
  }> = [];
  readonly uploads: Array<{
    vectorStoreId: string;
    file: File;
    attributes: Record<string, string | number | boolean>;
  }> = [];

  constructor(private readonly stores: Array<{ id: string; name: string }> = []) {}

  listVectorStores(): Promise<Array<{ id: string; name: string }>> {
    return Promise.resolve(this.stores);
  }

  createVectorStore(input: {
    name: string;
    metadata: Record<string, string>;
  }): Promise<{ id: string; name: string }> {
    this.createdStores.push(input);
    const store = { id: 'vs_created', name: input.name };
    this.stores.push(store);
    return Promise.resolve(store);
  }

  updateVectorStore(
    id: string,
    input: { name: string; metadata: Record<string, string> },
  ): Promise<{ id: string; name: string }> {
    this.updatedStores.push({ id, ...input });
    return Promise.resolve({ id, name: input.name });
  }

  uploadAndAttachFile(
    vectorStoreId: string,
    file: File,
    attributes: Record<string, string | number | boolean>,
  ): Promise<{ id: string; status: 'completed' }> {
    this.uploads.push({ vectorStoreId, file, attributes });
    return Promise.resolve({ id: 'vsf_uploaded', status: 'completed' });
  }
}
