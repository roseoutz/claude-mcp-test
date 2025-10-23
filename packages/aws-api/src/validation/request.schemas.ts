/**
 * API 요청 검증 스키마
 */
import { z } from 'zod';

/**
 * 코드 분석 요청 스키마
 */
export const AnalysisRequestSchema = z.object({
  repositoryPath: z.string().min(1, 'Repository path is required'),
  patterns: z.array(z.string()).optional().default(['**/*.{ts,js,tsx,jsx,py,java,kt}']),
  excludePaths: z.array(z.string()).optional().default(['node_modules', 'dist', 'build']),
  forceReindex: z.boolean().optional().default(false),
});

export type AnalysisRequestValidated = z.infer<typeof AnalysisRequestSchema>;

/**
 * 코드 검색 요청 스키마
 */
export const SearchRequestSchema = z.object({
  query: z.string().min(1, 'Query is required').max(1000, 'Query too long'),
  repositoryPath: z.string().min(1, 'Repository path is required'),
  maxResults: z.number().int().min(1).max(100).optional().default(10),
  semanticSearch: z.boolean().optional().default(true),
});

export type SearchRequestValidated = z.infer<typeof SearchRequestSchema>;

/**
 * 공통 검증 유틸리티
 */
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Validation failed: ${errorMessages.join(', ')}`);
    }
    throw error;
  }
}
