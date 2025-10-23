/**
 * 코드 분석 및 인덱싱 라우터
 * MCP 초기화 시 소스코드를 분석하고 Elasticsearch에 저장
 */

import express from 'express';
import { ApiResponse } from '@code-ai/shared';
import { ElasticsearchService } from '../services/elasticsearch.service.js';
import { UniversalImpactAnalyzer } from '../services/universal-impact-analyzer.js';
import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const router = express.Router();
const esService = new ElasticsearchService();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

// Zod 스키마 정의
const AnalysisRequestSchema = z.object({
  repositoryPath: z.string().min(1, 'Repository path is required'),
  patterns: z.array(z.string()).optional().default(['**/*.{ts,js,tsx,jsx,py,java,kt}']),
  excludePaths: z.array(z.string()).optional().default(['node_modules', 'dist', 'build']),
  forceReindex: z.boolean().optional().default(false),
});

type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;

/**
 * POST /api/v1/analyze
 * 코드베이스 분석 및 인덱싱 (MCP 초기화 시 실행)
 */
router.post('/', async (req, res: express.Response<ApiResponse>) => {
  try {
    // 입력 유효성 검증
    const validationResult = AnalysisRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors.map(
        err => `${err.path.join('.')}: ${err.message}`
      );
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${errorMessages.join(', ')}`
      });
    }

    const request = validationResult.data;

    // Elasticsearch 인덱스 초기화
    await esService.ensureIndex();

    if (request.forceReindex) {
      await esService.clearIndex();
    }

    const analyzer = new UniversalImpactAnalyzer();

    // 파일 찾기
    const files: string[] = [];
    const patterns = request.patterns || ['**/*.{java,kt,py,ts,js,tsx,jsx}'];
    const excludePaths = request.excludePaths || ['node_modules', '.git', 'dist', 'build'];

    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: request.repositoryPath,
        ignore: excludePaths,
        nodir: true
      });
      files.push(...matches);
    }

    console.log(`Found ${files.length} files to analyze`);

    // 파일별로 분석 및 인덱싱
    const documents = [];
    let processedCount = 0;
    const errors: Array<{ file: string; error: string }> = [];

    // 배치 크기 설정
    const FILE_READ_BATCH = 20; // 파일 읽기는 I/O bound이므로 크게
    const AI_BATCH = 5; // AI 호출은 rate limit 고려하여 작게

    // 1단계: 파일 읽기 및 메타데이터 추출 (병렬)
    const fileContents: Array<{ file: string; content: string; metadata: any }> = [];

    for (let i = 0; i < files.length; i += FILE_READ_BATCH) {
      const batch = files.slice(i, i + FILE_READ_BATCH);

      const batchResults = await Promise.allSettled(
        batch.map(async (file) => {
          const fullPath = path.join(request.repositoryPath, file);
          const content = await fs.readFile(fullPath, 'utf-8');

          // 기본 메타데이터 추출
          const language = analyzer.detectLanguage(file, content);
          const metadata = {
            language,
            classes: analyzer.extractClasses(content),
            functions: analyzer.extractFunctions(content),
            imports: analyzer.extractImports(content)
          };

          return { file, content, metadata, fullPath };
        })
      );

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          fileContents.push(result.value);
        } else {
          const error = result.reason;
          errors.push({
            file: 'unknown',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });
    }

    // 2단계: AI 분석 및 임베딩 생성 (배치 처리)
    for (let i = 0; i < fileContents.length; i += AI_BATCH) {
      const batch = fileContents.slice(i, i + AI_BATCH);

      const batchResults = await Promise.allSettled(
        batch.map(async ({ file, content, metadata, fullPath }) => {
          // Claude를 통한 코드 분석 및 설명 생성
          let description = '';
          try {
            const codeSnippet = content.split('\n').slice(0, 100).join('\n');
            const prompt = `다음 코드 파일을 분석하고 핵심 기능을 한국어 2-3문장으로 요약해주세요:

파일명: ${file}
언어: ${metadata.language}

코드:
${codeSnippet}

핵심 기능만 간결하게 설명해주세요.`;

            const response = await anthropic.messages.create({
              model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-1-20250805',
              max_tokens: 200,
              temperature: 0,
              messages: [{
                role: 'user',
                content: prompt
              }]
            });

            description = response.content[0].type === 'text'
              ? response.content[0].text
              : '';
          } catch (err) {
            console.error(`Failed to generate description for ${file}:`, err);
            // Continue without description
          }

          // 임베딩용 콘텐츠 생성
          const embeddingContent = `
File: ${file}
Language: ${metadata.language}
Classes: ${metadata.classes?.join(', ') || 'none'}
Functions: ${metadata.functions?.join(', ') || 'none'}
Imports: ${metadata.imports?.join(', ') || 'none'}
Description: ${description}

Content:
${content}`;

          // OpenAI 임베딩 생성
          const embedding = await analyzer.generateEmbedding(embeddingContent);

          return {
            file_path: file,
            content,
            language: metadata.language,
            classes: metadata.classes,
            functions: metadata.functions,
            imports: metadata.imports,
            description,
            embedding,
            metadata: {
              path: fullPath,
              extension: path.extname(file),
              lines: content.split('\n').length,
              size: content.length
            }
          };
        })
      );

      // 배치 결과 처리
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          documents.push(result.value);
          processedCount++;
        } else {
          const { file } = batch[index];
          const error = result.reason;
          errors.push({
            file,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });

      // 진행상황 로그
      console.log(`Analyzed ${processedCount}/${files.length} files...`);

      // 50개마다 배치로 Elasticsearch에 저장
      if (documents.length >= 50) {
        await esService.bulkIndex(documents);
        documents.length = 0;
      }
    }

    // 남은 문서들 저장
    if (documents.length > 0) {
      await esService.bulkIndex(documents);
    }

    console.log(`✅ Analysis complete! Processed ${processedCount} files`);

    res.json({
      success: true,
      data: {
        totalFiles: files.length,
        processedFiles: processedCount,
        errors: errors.length,
        errorDetails: errors.slice(0, 10)
      }
    });

  } catch (error: any) {
    console.error('Analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

export { router };