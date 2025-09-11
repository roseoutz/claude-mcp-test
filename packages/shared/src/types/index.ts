import { z } from 'zod';

// Re-export all types
export * from './git.js';
export * from './analysis.js';
export * from './mcp.js';
export * from './config.js';
export * from './errors.js';

// Zod schemas for runtime validation
export const CodebaseInfoSchema = z.object({
  repository: z.string(),
  branch: z.string(),
  files: z.array(z.object({
    path: z.string(),
    size: z.number(),
    language: z.string().optional(),
  })),
  totalFiles: z.number(),
  totalSize: z.number(),
  components: z.array(z.object({
    name: z.string(),
    type: z.string(),
    path: z.string(),
    description: z.string().optional(),
  })),
});

export type CodebaseInfo = z.infer<typeof CodebaseInfoSchema>;

export const AnalysisRequestSchema = z.object({
  repository: z.string(),
  branch: z.string().optional(),
  analysisType: z.enum(['learn', 'diff', 'feature', 'impact']),
  options: z.record(z.any()).optional(),
});

export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;

export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
});

export type ApiResponse = z.infer<typeof ApiResponseSchema>;

// Additional Zod schemas for new types
export const LearnCodebaseInputSchema = z.object({
  repoPath: z.string().min(1),
  branch: z.string().optional(),
  includeTests: z.boolean().optional(),
  maxFileSize: z.number().positive().optional(),
  filePatterns: z.array(z.string()).optional(),
  excludePatterns: z.array(z.string()).optional(),
});

export const AnalyzeDiffInputSchema = z.object({
  repoPath: z.string().min(1),
  baseBranch: z.string().min(1),
  targetBranch: z.string().min(1),
  includeStats: z.boolean().optional(),
  contextLines: z.number().positive().optional(),
});

export const SearchCodeInputSchema = z.object({
  query: z.string().min(1),
  repoPath: z.string().optional(),
  searchType: z.enum(['literal', 'regex', 'semantic']).optional(),
  fileTypes: z.array(z.string()).optional(),
  maxResults: z.number().positive().optional(),
});