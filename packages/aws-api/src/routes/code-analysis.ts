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

const router = express.Router();
const esService = new ElasticsearchService();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

interface AnalysisRequest {
  repositoryPath: string;
  patterns?: string[];
  excludePaths?: string[];
  forceReindex?: boolean;
}

/**
 * POST /api/v1/analyze
 * 코드베이스 분석 및 인덱싱 (MCP 초기화 시 실행)
 */
router.post('/', async (req, res: express.Response<ApiResponse>) => {
  try {
    const request: AnalysisRequest = req.body;

    if (!request.repositoryPath) {
      return res.status(400).json({
        success: false,
        error: 'Repository path is required'
      });
    }

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
    const errors = [];

    for (const file of files) {
      try {
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

        // Claude를 통한 코드 분석 및 설명 생성
        let description = '';
        try {
          const codeSnippet = content.split('\n').slice(0, 100).join('\n');
          const prompt = `다음 코드 파일을 분석하고 핵심 기능을 한국어 2-3문장으로 요약해주세요:

파일명: ${file}
언어: ${language}

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
        }

        // 임베딩용 콘텐츠 생성
        const embeddingContent = `
File: ${file}
Language: ${language}
Classes: ${metadata.classes?.join(', ') || 'none'}
Functions: ${metadata.functions?.join(', ') || 'none'}
Imports: ${metadata.imports?.join(', ') || 'none'}
Description: ${description}

Content:
${content}`;

        // OpenAI 임베딩 생성
        const embedding = await analyzer.generateEmbedding(embeddingContent);

        documents.push({
          file_path: file,
          content,
          language,
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
        });

        processedCount++;

        // 10개마다 진행상황 로그
        if (processedCount % 10 === 0) {
          console.log(`Analyzed ${processedCount}/${files.length} files...`);
        }

        // 50개마다 배치로 Elasticsearch에 저장
        if (documents.length >= 50) {
          await esService.bulkIndex(documents);
          documents.length = 0;
        }

      } catch (err: any) {
        console.error(`Error analyzing ${file}:`, err.message);
        errors.push({ file, error: err.message });
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