import { describe, it, expect, beforeEach } from 'vitest';
import { MockAIService } from '../../services/ai.service.js';

describe('AIService', () => {
  let aiService: MockAIService;

  beforeEach(() => {
    aiService = new MockAIService();
  });

  describe('MockAIService', () => {
    it('should generate embeddings', async () => {
      const embedding = await aiService.generateEmbedding('test text');
      
      expect(embedding).toHaveLength(1536);
      expect(embedding.every(v => v >= 0 && v <= 1)).toBe(true);
    });

    it('should generate consistent embeddings for same text', async () => {
      const embedding1 = await aiService.generateEmbedding('test');
      const embedding2 = await aiService.generateEmbedding('test');
      
      expect(embedding1).toEqual(embedding2);
    });

    it('should generate multiple embeddings', async () => {
      const texts = ['hello', 'world', 'test'];
      const embeddings = await aiService.generateEmbeddings(texts);
      
      expect(embeddings).toHaveLength(3);
      expect(embeddings[0]).toHaveLength(1536);
      expect(embeddings[1]).toHaveLength(1536);
      expect(embeddings[2]).toHaveLength(1536);
    });

    it('should analyze code', async () => {
      const code = `
        function add(a: number, b: number): number {
          return a + b;
        }
      `;
      
      const analysis = await aiService.analyzeCode(code, 'typescript', 'math utility');
      
      expect(analysis.summary).toContain('typescript');
      expect(analysis.summary).toContain('math utility');
      expect(analysis.complexity).toBeGreaterThan(0);
      expect(analysis.complexity).toBeLessThanOrEqual(10);
      expect(Array.isArray(analysis.components)).toBe(true);
      expect(Array.isArray(analysis.dependencies)).toBe(true);
    });

    it('should explain code', async () => {
      const explanation = await aiService.explainCode(
        'function add(a, b) { return a + b; }',
        'javascript',
        'math utility'
      );
      
      expect(explanation).toContain('math utility');
      expect(explanation.length).toBeGreaterThan(0);
    });

    it('should generate documentation', async () => {
      const code = 'function add(a, b) { return a + b; }';
      const docs = await aiService.generateDocumentation(code, 'javascript', 'jsdoc');
      
      expect(docs).toContain('jsdoc');
      expect(docs).toContain('javascript');
      expect(docs.length).toBeGreaterThan(0);
    });

    it('should detect vulnerabilities', async () => {
      const codeWithIssues = `
        function dangerous() {
          eval(userInput);
          element.innerHTML = userContent;
        }
      `;
      
      const vulnerabilities = await aiService.detectVulnerabilities(codeWithIssues, 'javascript');
      
      expect(vulnerabilities.length).toBe(2);
      expect(vulnerabilities.some(v => v.type === 'Code Injection')).toBe(true);
      expect(vulnerabilities.some(v => v.type === 'XSS')).toBe(true);
      expect(vulnerabilities.some(v => v.severity === 'critical')).toBe(true);
      expect(vulnerabilities.some(v => v.severity === 'high')).toBe(true);
    });

    it('should not find vulnerabilities in safe code', async () => {
      const safeCode = `
        function safe(a: number, b: number): number {
          return a + b;
        }
      `;
      
      const vulnerabilities = await aiService.detectVulnerabilities(safeCode, 'typescript');
      
      expect(vulnerabilities.length).toBe(0);
    });

    it('should suggest refactoring', async () => {
      const code = 'function test() { let x = 1; return x; }';
      const suggestions = await aiService.suggestRefactoring(code, 'javascript');
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toHaveProperty('type');
      expect(suggestions[0]).toHaveProperty('description');
      expect(suggestions[0]).toHaveProperty('before');
      expect(suggestions[0]).toHaveProperty('after');
    });

    it('should suggest improvements', async () => {
      const suggestions = await aiService.suggestImprovements();
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toContain('test');
    });

    it('should analyze security issues', async () => {
      const codeWithIssues = `
        function dangerous() {
          eval(userInput);
          element.innerHTML = userContent;
        }
      `;
      
      const issues = await aiService.analyzeSecurity(codeWithIssues);
      
      expect(issues.length).toBe(2);
      expect(issues.some(i => i.type === 'Code Injection')).toBe(true);
      expect(issues.some(i => i.type === 'XSS')).toBe(true);
      expect(issues.every(i => ['low', 'medium', 'high', 'critical'].includes(i.severity))).toBe(true);
    });

    it('should not find issues in safe code', async () => {
      const safeCode = `
        function safe(a: number, b: number): number {
          return a + b;
        }
      `;
      
      const issues = await aiService.analyzeSecurity(safeCode);
      
      expect(issues.length).toBe(0);
    });

    it('should summarize code', async () => {
      const code = `
        function calculateTotal(items) {
          let total = 0;
          for (let item of items) {
            total += item.price;
          }
          return total;
        }
      `;
      
      const summary = await aiService.summarizeCode(code, 100);
      
      expect(summary.length).toBeLessThanOrEqual(100);
      expect(summary).toContain('lines');
    });

    it('should convert query to code pattern', async () => {
      const testCases = [
        { query: 'find function', expected: 'function*' },
        { query: 'search class', expected: 'class*' },
        { query: 'import statement', expected: 'import*' },
        { query: 'other query', expected: 'other query' },
      ];

      for (const { query, expected } of testCases) {
        const result = await aiService.queryToCode(query);
        expect(result).toBe(expected);
      }
    });

    it('should generate function signature for TypeScript', async () => {
      const description = 'Create a function to add two numbers';
      const signature = await aiService.generateFunctionSignature(description, 'typescript');
      
      expect(signature).toContain('function');
      expect(signature).toContain('param: any');
      expect(signature).toContain(': any');
      expect(signature).toContain(description);
    });

    it('should generate function signature for JavaScript', async () => {
      const description = 'Create a method to process data';
      const signature = await aiService.generateFunctionSignature(description, 'javascript');
      
      expect(signature).toContain('function');
      expect(signature).toContain('param');
      expect(signature).not.toContain(': any');
      expect(signature).toContain(description);
    });

    it('should handle empty descriptions', async () => {
      const signature = await aiService.generateFunctionSignature('');
      
      expect(signature).toContain('function');
      expect(signature).toContain('generatedFunction');
    });

    it('should handle descriptions without function keywords', async () => {
      const signature = await aiService.generateFunctionSignature('process some data');
      
      expect(signature).toContain('function');
      expect(signature).toContain('generatedFunction');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty text for embedding', async () => {
      const embedding = await aiService.generateEmbedding('');
      
      expect(embedding).toHaveLength(1536);
      expect(embedding.every(v => v >= 0 && v <= 1)).toBe(true);
    });

    it('should handle very long text for embedding', async () => {
      const longText = 'a'.repeat(10000);
      const embedding = await aiService.generateEmbedding(longText);
      
      expect(embedding).toHaveLength(1536);
      expect(embedding.every(v => v >= 0 && v <= 1)).toBe(true);
    });

    it('should handle empty code for analysis', async () => {
      const analysis = await aiService.analyzeCode('', 'typescript');
      
      expect(analysis).toBeDefined();
      expect(analysis.summary).toBeDefined();
      expect(analysis.complexity).toBeGreaterThan(0);
    });

    it('should handle unknown language', async () => {
      const analysis = await aiService.analyzeCode('some code', 'unknown-language');
      
      expect(analysis).toBeDefined();
      expect(analysis.summary).toContain('unknown-language');
    });

    it('should handle very short maxLength for summary', async () => {
      const code = 'function test() { return 1; }';
      const summary = await aiService.summarizeCode(code, 10);
      
      expect(summary.length).toBeLessThanOrEqual(10);
    });
  });
});