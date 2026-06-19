import { describe, it, expect, beforeAll, vi } from 'vitest';
import { appRouter } from '../routers/_app.js';
import { createTestContext } from '../test/setup.js';
import { createTestOrg, createTestUser } from '../test/factory.js';

// Mock the AI service module
vi.mock('../services/ai.js', () => ({
  parseDocumentWithAI: vi.fn().mockResolvedValue({
    documentType: 'invoice',
    extractedFields: { amount: 1000, vendor: 'Acme Corp' },
    confidence: 0.95,
  }),
  suggestAccountWithAI: vi.fn().mockResolvedValue({
    suggestions: ['6000', '5000'],
    confidence: 0.9,
    reasoning: 'Looks like an operating expense',
  }),
  checkComplianceWithAI: vi.fn().mockResolvedValue({
    risks: [],
    suggestions: [],
    itemsAnalyzed: 0,
  }),
  analyzeTransactionsWithAI: vi.fn().mockResolvedValue({
    anomalies: [],
    transactionsAnalyzed: 0,
  }),
  generateW2PreviewWithAI: vi.fn().mockResolvedValue({
    preview: null,
  }),
}));

describe('AI Router', () => {
  let testOrg: any;
  let testUser: any;
  let caller: any;

  beforeAll(async () => {
    testOrg = await createTestOrg();
    testUser = await createTestUser(testOrg.id, 'owner');
    caller = appRouter.createCaller(createTestContext(testUser, testOrg.id));
  });

  describe('parseDocument with mocked OpenAI', () => {
    it('should return parsed document data', async () => {
      const result = await caller.ai.parseDocument({
        fileContent: 'Invoice for $1000 from Acme Corp',
        fileType: 'txt',
      });

      expect(result).toBeDefined();
      expect(result.documentType).toBe('invoice');
      expect(result.extractedFields).toBeDefined();
      expect(result.confidence).toBe(0.95);
    });
  });

  describe('suggestAccount with mocked OpenAI', () => {
    it('should return account suggestions', async () => {
      const result = await caller.ai.suggestAccount({
        description: 'Office supplies purchase',
        amount: 150,
      });

      expect(result).toBeDefined();
      expect(result.suggestions).toContain('6000');
      expect(result.confidence).toBe(0.9);
      expect(result.reasoning).toBeDefined();
    });
  });

  describe('without API key', () => {
    it('should return fallback data when no API key is configured', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const { parseDocumentWithAI } = await vi.importActual('../services/ai.js');
      const result = await parseDocumentWithAI('test content', 'txt');

      expect(result.documentType).toBe('unknown');
      expect(result.warning).toContain('OpenAI API key not configured');
      expect(result.confidence).toBe(0);

      if (originalKey) process.env.OPENAI_API_KEY = originalKey;
    });
  });
});
