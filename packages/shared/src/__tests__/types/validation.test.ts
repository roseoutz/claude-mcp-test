import { describe, it, expect } from 'vitest';
import {
  LearnCodebaseInputSchema,
  AnalyzeDiffInputSchema,
  SearchCodeInputSchema,
  type LearnCodebaseInput,
  type AnalyzeDiffInput,
  type SearchCodeInput,
} from '../../types/index.js';

describe('Type Validation', () => {
  describe('LearnCodebaseInput', () => {
    it('should validate valid input', () => {
      const validInput: LearnCodebaseInput = {
        repoPath: '/path/to/repo',
        branch: 'main',
        includeTests: true,
        maxFileSize: 1048576,
        filePatterns: ['**/*.ts', '**/*.js'],
        excludePatterns: ['node_modules/**'],
      };

      expect(() => LearnCodebaseInputSchema.parse(validInput)).not.toThrow();
    });

    it('should validate minimal input', () => {
      const minimalInput: LearnCodebaseInput = {
        repoPath: '/path/to/repo',
      };

      expect(() => LearnCodebaseInputSchema.parse(minimalInput)).not.toThrow();
    });

    it('should reject empty repoPath', () => {
      const invalidInput = {
        repoPath: '',
        branch: 'main',
      };

      expect(() => LearnCodebaseInputSchema.parse(invalidInput)).toThrow();
    });

    it('should reject negative maxFileSize', () => {
      const invalidInput = {
        repoPath: '/path/to/repo',
        maxFileSize: -100,
      };

      expect(() => LearnCodebaseInputSchema.parse(invalidInput)).toThrow();
    });
  });

  describe('AnalyzeDiffInput', () => {
    it('should validate valid input', () => {
      const validInput: AnalyzeDiffInput = {
        repoPath: '/path/to/repo',
        baseBranch: 'main',
        targetBranch: 'feature/new-feature',
        includeStats: true,
        contextLines: 3,
      };

      expect(() => AnalyzeDiffInputSchema.parse(validInput)).not.toThrow();
    });

    it('should reject missing required fields', () => {
      const invalidInput = {
        repoPath: '/path/to/repo',
        baseBranch: 'main',
        // missing targetBranch
      };

      expect(() => AnalyzeDiffInputSchema.parse(invalidInput)).toThrow();
    });

    it('should reject empty branch names', () => {
      const invalidInput = {
        repoPath: '/path/to/repo',
        baseBranch: '',
        targetBranch: 'feature',
      };

      expect(() => AnalyzeDiffInputSchema.parse(invalidInput)).toThrow();
    });
  });

  describe('SearchCodeInput', () => {
    it('should validate valid input', () => {
      const validInput: SearchCodeInput = {
        query: 'function handleRequest',
        repoPath: '/path/to/repo',
        searchType: 'semantic',
        fileTypes: ['ts', 'js'],
        maxResults: 50,
      };

      expect(() => SearchCodeInputSchema.parse(validInput)).not.toThrow();
    });

    it('should validate minimal input', () => {
      const minimalInput: SearchCodeInput = {
        query: 'TODO',
      };

      expect(() => SearchCodeInputSchema.parse(minimalInput)).not.toThrow();
    });

    it('should reject empty query', () => {
      const invalidInput = {
        query: '',
        searchType: 'literal',
      };

      expect(() => SearchCodeInputSchema.parse(invalidInput)).toThrow();
    });

    it('should reject invalid searchType', () => {
      const invalidInput = {
        query: 'test',
        searchType: 'invalid' as any,
      };

      expect(() => SearchCodeInputSchema.parse(invalidInput)).toThrow();
    });

    it('should reject negative maxResults', () => {
      const invalidInput = {
        query: 'test',
        maxResults: -1,
      };

      expect(() => SearchCodeInputSchema.parse(invalidInput)).toThrow();
    });
  });
});