/**
 * 코드 검색 및 질의응답 라우터
 * 사용자 질문을 받아 Elasticsearch에서 검색 후 Claude가 답변 생성
 */

import express from 'express';
import { ApiResponse } from '@code-ai/shared';
import { ElasticsearchService } from '../services/elasticsearch.service.js';
import { UniversalImpactAnalyzer } from '../services/universal-impact-analyzer.js';
import Anthropic from '@anthropic-ai/sdk';
import { promises as fs } from 'fs';
import path from 'path';

const router = express.Router();
const esService = new ElasticsearchService();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
});

interface SearchRequest {
  query: string;
  repositoryPath?: string;
  maxResults?: number;
}

interface SearchResponse {
  answer: string;
  relevantFiles: Array<{
    path: string;
    score: number;
    description?: string;
  }>;
}

/**
 * POST /api/v1/search
 * 사용자 질문에 대한 검색 및 응답
 */
router.post('/', async (req, res: express.Response<ApiResponse>) => {
  try {
    const request: SearchRequest = req.body;

    if (!request.query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    console.log(`Processing search query: ${request.query}`);

    // 1. Claude를 사용하여 질문 의도 파악 및 검색 쿼리 생성
    const intentPrompt = `사용자가 다음과 같은 질문을 했습니다:
"${request.query}"

이 질문에서 찾고자 하는 핵심 키워드와 개념을 추출해주세요.
또한 이 질문이 어떤 종류의 코드를 찾는 것인지 분석해주세요.

응답 형식:
키워드: [키워드1, 키워드2, ...]
코드 유형: [예: 인증, 데이터베이스, API, 설정, 알고리즘 등]
검색 쿼리: [Elasticsearch용 검색어]`;

    const intentResponse = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-1-20250805',
      max_tokens: 300,
      temperature: 0,
      messages: [{
        role: 'user',
        content: intentPrompt
      }]
    });

    let searchQuery = request.query;
    if (intentResponse.content[0].type === 'text') {
      const intentText = intentResponse.content[0].text;
      // 검색 쿼리 추출
      const queryMatch = intentText.match(/검색 쿼리: (.+)/);
      if (queryMatch) {
        searchQuery = queryMatch[1];
      }
    }

    // 2. 검색 쿼리를 임베딩으로 변환
    const analyzer = new UniversalImpactAnalyzer();
    const queryEmbedding = await analyzer.generateEmbedding(searchQuery);

    // 3. Elasticsearch에서 하이브리드 검색 (텍스트 + 벡터)
    const searchResults = await esService.hybridSearch(
      searchQuery,
      queryEmbedding,
      request.maxResults || 5
    );

    if (searchResults.length === 0) {
      return res.json({
        success: true,
        data: {
          answer: '관련된 코드를 찾을 수 없습니다. 코드베이스가 분석되었는지 확인해주세요.',
          relevantFiles: []
        }
      });
    }

    // 4. 검색 결과에서 실제 코드 내용 가져오기 (상위 3개)
    const fileContents = [];
    for (const result of searchResults.slice(0, 3)) {
      if (request.repositoryPath && result.file_path) {
        try {
          const fullPath = path.join(request.repositoryPath, result.file_path);
          const content = await fs.readFile(fullPath, 'utf-8');
          fileContents.push({
            path: result.file_path,
            content: content,
            description: result.description,
            score: result.score
          });
        } catch (err) {
          // 파일을 읽을 수 없으면 검색 결과의 내용 사용
          fileContents.push({
            path: result.file_path,
            content: result.content || '',
            description: result.description,
            score: result.score
          });
        }
      } else {
        // repositoryPath가 없으면 인덱싱된 내용 사용
        fileContents.push({
          path: result.file_path,
          content: result.content || '',
          description: result.description,
          score: result.score
        });
      }
    }

    // 5. Claude에게 검색 결과와 함께 답변 생성 요청
    const answerPrompt = `사용자가 다음과 같은 질문을 했습니다:
"${request.query}"

다음은 관련성이 높은 코드 파일들입니다:

${fileContents.map((file, idx) => `
=== 파일 ${idx + 1}: ${file.path} (관련도: ${(file.score * 100).toFixed(1)}%) ===
설명: ${file.description || '없음'}

코드:
${file.content.substring(0, 3000)}
${file.content.length > 3000 ? '\n... (생략) ...' : ''}
`).join('\n')}

위 코드를 분석하여 사용자의 질문에 대한 구체적이고 실용적인 답변을 제공해주세요.

답변 형식:
1. 질문에 대한 직접적인 답변
2. 관련 파일과 위치 (구체적인 파일명과 라인 번호 포함)
3. 필요한 경우 코드 예시
4. 추가 고려사항

중요: 실제 코드의 내용을 기반으로 구체적인 파일명, 클래스명, 메소드명, 라인 번호를 언급하며 답변해주세요.`;

    const answerResponse = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-1-20250805',
      max_tokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '2000'),
      temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0'),
      messages: [{
        role: 'user',
        content: answerPrompt
      }]
    });

    const answer = answerResponse.content[0].type === 'text'
      ? answerResponse.content[0].text
      : '답변을 생성할 수 없습니다.';

    res.json({
      success: true,
      data: {
        answer,
        relevantFiles: searchResults.map(r => ({
          path: r.file_path,
          score: r.score,
          description: r.description
        }))
      }
    });

  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

export { router };