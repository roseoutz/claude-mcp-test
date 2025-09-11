import { z } from 'zod';

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