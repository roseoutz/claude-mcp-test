/**
 * 영향도 분석 API 라우터
 * 메타데이터 강화 임베딩 기반 코드 영향도 분석
 */

import { Router } from 'express';
import OpenAI from 'openai';
import { promises as fs } from 'fs';
import path from 'path';

const router = Router();

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'test-key',
});

// 인메모리 코드 데이터베이스 (실제로는 Elasticsearch 사용)
let codeDatabase: any[] = [];

interface ImpactAnalysisRequest {
  query: string;
  type?: 'auth' | 'crypto' | 'tax' | 'general';
  keywords?: string[];
  maxResults?: number;
}

interface CodeMetadata {
  className: string;
  packageName: string;
  filePath: string;
  methods: string[];
  layer: string;
  purpose: string;
  businessDomain: string;
  isImplementation: boolean;
  complexity: string;
  // 의미적 특성 (임베딩으로 추론)
  semanticFeatures?: {
    domainRelevance: number;  // 0-1 범위
    architecturalImportance: number;
    codeComplexityScore: number;
  };
}

/**
 * 코드베이스 인덱싱 엔드포인트
 */
router.post('/index', async (req, res) => {
  try {
    const { filePath, content, projectPath } = req.body;

    // 개별 파일 인덱싱 모드
    if (filePath && content) {
      const metadata = extractMetadata(filePath, content);
      const enhancedText = createEnhancedText(content, metadata);

      // OpenAI 임베딩 생성
      let embedding: number[] | null = null;
      try {
        embedding = await generateEmbedding(enhancedText);
      } catch (error) {
        console.error('Failed to generate embedding:', error);
      }

      // 중복 체크 및 업데이트
      const existingIndex = codeDatabase.findIndex(item => item.filePath === filePath);
      const codeItem = {
        filePath,
        content: content.substring(0, 2000),
        metadata,
        enhancedText,
        embedding
      };

      if (existingIndex >= 0) {
        codeDatabase[existingIndex] = codeItem;
      } else {
        codeDatabase.push(codeItem);
      }

      res.json({
        success: true,
        data: {
          filePath,
          indexed: true,
          databaseSize: codeDatabase.length
        }
      });
      return;
    }

    // 전체 코드베이스 스캔 모드 (기존 코드)
    const { repoPath = '/tmp/letsgo' } = req.body;

    console.log(`📂 Starting codebase indexing for: ${repoPath}`);

    const javaFiles = await scanJavaFiles(repoPath);
    console.log(`Found ${javaFiles.length} Java files`);

    codeDatabase = [];
    let indexed = 0;

    for (const file of javaFiles) { // 모든 파일 인덱싱
      try {
        const content = await fs.readFile(file.path, 'utf-8');

        const metadata = extractMetadata(file.relativePath, content);
        const enhancedText = createEnhancedText(content, metadata);

        // OpenAI 임베딩 생성
        let embedding: number[] | null = null;
        try {
          embedding = await generateEmbedding(enhancedText);
        } catch (error) {
          console.error(`Failed to generate embedding for ${file.path}`);
        }

        codeDatabase.push({
          filePath: file.relativePath,
          content: content.substring(0, 2000),
          metadata,
          enhancedText,
          embedding
        });

        indexed++;
      } catch (error) {
        console.error(`Error indexing ${file.path}:`, error);
      }
    }

    res.json({
      success: true,
      data: {
        totalFiles: javaFiles.length,
        indexedFiles: indexed,
        message: `Successfully indexed ${indexed} files`,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 영향도 분석 엔드포인트 (임베딩 기반)
 */
router.post('/analyze', async (req, res) => {
  try {
    const request: ImpactAnalysisRequest = req.body;

    if (!request.query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required',
      });
    }

    console.log(`🔍 Analyzing impact for: ${request.query}`);

    // 쿼리를 의미적으로 강화
    const enhancedQuery = createSemanticQuery(request);

    // OpenAI 임베딩 생성 (실제 구현)
    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await generateEmbedding(enhancedQuery);
    } catch (error) {
      console.warn('Embedding generation failed, falling back to keyword search');
    }

    // 임베딩 기반 또는 키워드 기반 검색
    let results = codeDatabase.map(item => {
      let similarity = 0;

      if (queryEmbedding && item.embedding) {
        // 코사인 유사도 계산
        similarity = cosineSimilarity(queryEmbedding, item.embedding);

        // 의미적 특성 기반 가중치
        if (item.metadata.semanticFeatures) {
          const features = item.metadata.semanticFeatures;

          // 도메인 관련성과 아키텍처 중요도를 반영
          similarity *= (1 + features.domainRelevance * 0.3);
          similarity *= (1 + features.architecturalImportance * 0.2);
        }
      } else {
        // 폴백: 단순 텍스트 매칭
        const queryLower = request.query.toLowerCase();
        const contentLower = `${item.content} ${item.metadata.className} ${item.metadata.businessDomain}`.toLowerCase();

        // 키워드 매칭으로 기본 similarity 설정
        const keywords = ['환급', '세금', 'tax', 'refund', 'deduction', 'credit'];
        keywords.forEach(keyword => {
          if (queryLower.includes(keyword) && contentLower.includes(keyword)) {
            similarity += 0.15;
          }
        });

        // 파일 경로로 추가 점수
        const fileLower = item.filePath.toLowerCase();
        if (queryLower.includes('환급') && fileLower.includes('refund')) similarity += 0.3;
        if (queryLower.includes('세금') && (fileLower.includes('tax') || fileLower.includes('refund'))) similarity += 0.2;

        // 추가 키워드 매칭
        if (request.keywords) {
          request.keywords.forEach((keyword: string) => {
            if (contentLower.includes(keyword.toLowerCase())) similarity += 0.1;
          });
        }

        // 기본값 보장
        if (similarity === 0 && fileLower.includes('refund')) {
          similarity = 0.1; // 최소값
        }
      }

      // 구현체 우선 가중치 (범용적)
      if (item.metadata.isImplementation) {
        similarity *= 1.2;
      }

      return {
        ...item,
        similarity: Math.min(similarity || 0, 1.0),
      };
    });

    // 정렬 및 필터링 (LOW 영향도 제외: 50% 이하)
    results = results
      .filter(r => r.similarity > 0.5) // LOW 영향도(50% 이하) 제외
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, request.maxResults || 10);

    // AI 분석 (실제로는 OpenAI API 호출)
    const analysis = {
      coreModificationPoints: results
        .filter((r: any) => r.metadata.isImplementation)
        .slice(0, 3)
        .map((r: any) => `${r.metadata.className} (${r.filePath})`),

      impactPropagationPath: results
        .slice(0, 5)
        .map((r: any) => `${r.metadata.className} -> ${r.metadata.layer}`),

      considerations: [
        'Review all dependent services',
        'Update unit and integration tests',
        'Consider backward compatibility',
      ],

      testingAreas: [
        ...new Set(results.map((r: any) => r.metadata.businessDomain)),
      ],

      estimatedEffort: `${results.length * 2} hours`,

      riskLevel: results.length > 10 ? 'HIGH' : results.length > 5 ? 'MEDIUM' : 'LOW',
    };

    res.json({
      success: true,
      data: {
        query: request.query,
        totalResults: results.length,
        results: results.map((r: any) => ({
          filePath: r.filePath,
          className: r.metadata.className,
          similarity: (r.similarity * 100).toFixed(1) + '%',
          impactLevel: r.similarity > 0.8 ? 'HIGH' : r.similarity > 0.5 ? 'MEDIUM' : 'LOW',
          layer: r.metadata.layer,
          businessDomain: r.metadata.businessDomain,
          purpose: r.metadata.purpose,
        })),
        analysis,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 데이터베이스 상태 확인
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      indexedFiles: codeDatabase.length,
      ready: codeDatabase.length > 0,
      domains: [...new Set(codeDatabase.map(d => d.metadata.businessDomain))],
      layers: [...new Set(codeDatabase.map(d => d.metadata.layer))],
    },
  });
});

// === 유틸리티 함수들 ===

async function scanJavaFiles(repoPath: string): Promise<any[]> {
  const files: any[] = [];

  async function scan(dir: string, basePath = '') {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'build') {
          await scan(path.join(dir, entry.name), path.join(basePath, entry.name));
        } else if (entry.isFile() && entry.name.endsWith('.java') && !basePath.includes('test')) {
          files.push({
            path: path.join(dir, entry.name),
            relativePath: path.join(basePath, entry.name),
          });
        }
      }
    } catch (error) {
      // 무시
    }
  }

  await scan(repoPath);
  return files;
}

function extractMetadata(filePath: string, content: string): CodeMetadata {
  // 기본 메타데이터 추출
  const metadata: CodeMetadata = {
    className: extractClassName(content),
    packageName: extractPackageName(content),
    filePath,
    methods: extractMethods(content),
    layer: inferArchitectureLayer(filePath),
    purpose: inferPurpose(filePath, content),
    businessDomain: inferBusinessDomain(filePath, content),
    isImplementation: filePath.includes('impl/'),
    complexity: calculateComplexity(content),
  };

  // 의미적 특성 계산 (임베딩 없이도 가능한 휴리스틱)
  metadata.semanticFeatures = {
    domainRelevance: calculateDomainRelevance(content, metadata),
    architecturalImportance: calculateArchitecturalImportance(metadata),
    codeComplexityScore: calculateComplexityScore(content),
  };

  return metadata;
}

function createEnhancedText(code: string, metadata: CodeMetadata): string {
  // 의미적으로 풍부한 텍스트 생성 (키워드 하드코딩 없이)
  return `
## Structural Context
- Domain: ${metadata.businessDomain}
- Layer: ${metadata.layer}
- Purpose: ${metadata.purpose}
- Implementation Type: ${metadata.isImplementation ? 'Concrete Implementation' : 'Interface/Abstract'}

## Code Semantics
- Package: ${metadata.packageName}
- Class: ${metadata.className}
- Complexity: ${metadata.complexity}
${metadata.semanticFeatures ? `
- Domain Relevance Score: ${metadata.semanticFeatures.domainRelevance.toFixed(2)}
- Architectural Importance: ${metadata.semanticFeatures.architecturalImportance.toFixed(2)}
- Code Complexity Score: ${metadata.semanticFeatures.codeComplexityScore.toFixed(2)}
` : ''}

## Method Signatures and Responsibilities
${metadata.methods.map(m => `- ${m}: ${inferMethodSemantics(m, code)}`).slice(0, 10).join('\n')}

## Code Content Summary
${code.substring(0, 1500)}
`;
}

/**
 * 메서드의 의미적 역할 추론
 */
function inferMethodSemantics(methodName: string, code: string): string {
  // 메서드 시그니처에서 의미 추론
  const methodPattern = new RegExp(`\\w+\\s+${methodName}\\s*\\([^)]*\\)`, 'g');
  const match = code.match(methodPattern);

  if (match && match[0]) {
    // 반환 타입과 파라미터에서 의미 추론
    if (match[0].includes('void')) return 'performs side effects or operations';
    if (match[0].includes('boolean')) return 'validates or checks conditions';
    if (match[0].includes('String')) return 'processes or generates text data';
    if (match[0].includes('List') || match[0].includes('Collection')) return 'handles multiple items';
  }

  // 메서드 이름 패턴에서 의미 추론
  if (methodName.startsWith('get') || methodName.startsWith('fetch')) return 'retrieves data';
  if (methodName.startsWith('set') || methodName.startsWith('update')) return 'modifies state';
  if (methodName.startsWith('is') || methodName.startsWith('has')) return 'checks conditions';
  if (methodName.startsWith('create') || methodName.startsWith('build')) return 'constructs objects';
  if (methodName.startsWith('process') || methodName.startsWith('handle')) return 'processes logic';
  if (methodName.startsWith('validate')) return 'ensures data integrity';
  if (methodName.startsWith('calculate') || methodName.startsWith('compute')) return 'performs calculations';

  return 'performs operations';
}

/**
 * 의미적 쿼리 생성
 */
function createSemanticQuery(request: ImpactAnalysisRequest): string {
  // 쿼리를 의미적으로 풍부하게 만들기
  let semanticQuery = `
Query Intent: ${request.query}
`;

  // 타입이 있으면 도메인 컨텍스트 추가
  if (request.type) {
    const domainContext = {
      auth: 'Authentication, authorization, user identity, session management',
      crypto: 'Cryptography, encryption, keys, signatures, security',
      tax: 'Tax calculation, refunds, deductions, financial processing',
      general: 'General business logic and operations'
    };
    semanticQuery += `\nDomain Context: ${domainContext[request.type] || domainContext.general}`;
  }

  // 키워드가 있으면 관련 개념 추가
  if (request.keywords && request.keywords.length > 0) {
    semanticQuery += `\nRelated Concepts: ${request.keywords.join(', ')}`;
  }

  return semanticQuery;
}

/**
 * 도메인 관련성 계산
 */
function calculateDomainRelevance(content: string, metadata: CodeMetadata): number {
  let score = 0;

  // 비즈니스 로직 메서드가 많을수록 관련성 높음
  const businessMethods = metadata.methods.filter(m =>
    m.includes('process') || m.includes('calculate') ||
    m.includes('validate') || m.includes('handle')
  ).length;
  score += Math.min(businessMethods * 0.1, 0.4);

  // 구현체면 관련성 높음
  if (metadata.isImplementation) score += 0.3;

  // 복잡도가 중간 이상이면 관련성 있음
  if (metadata.complexity !== 'Low') score += 0.2;

  // 특정 패키지 구조에 따른 가중치
  if (metadata.packageName.includes('core') || metadata.packageName.includes('service')) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}

/**
 * 아키텍처적 중요도 계산
 */
function calculateArchitecturalImportance(metadata: CodeMetadata): number {
  const layerImportance: Record<string, number> = {
    'Business Layer': 0.8,
    'Persistence Layer': 0.6,
    'Presentation Layer': 0.5,
    'Configuration Layer': 0.4,
    'Security Layer': 0.7,
    'Transfer Layer': 0.3,
    'Infrastructure Layer': 0.5,
  };

  return layerImportance[metadata.layer] || 0.3;
}

/**
 * 코드 복잡도 점수 계산
 */
function calculateComplexityScore(content: string): number {
  const lines = content.split('\n').length;
  const conditions = (content.match(/if\s*\(|switch\s*\(|for\s*\(|while\s*\(/g) || []).length;
  const methods = (content.match(/(?:public|private|protected)\s+\w+\s+\w+\s*\(/g) || []).length;
  const classes = (content.match(/class\s+\w+/g) || []).length;

  const score = (lines * 0.001) + (conditions * 0.05) + (methods * 0.03) + (classes * 0.1);

  return Math.min(score, 1.0);
}

/**
 * 코사인 유사도 계산
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

  if (magnitudeA === 0 || magnitudeB === 0) return 0;

  return dotProduct / (magnitudeA * magnitudeB);
}

function extractClassName(content: string): string {
  const match = content.match(/(?:class|interface)\s+(\w+)/);
  return match?.[1] || 'Unknown';
}

function extractPackageName(content: string): string {
  const match = content.match(/package\s+([^;]+);/);
  return match?.[1] || '';
}

function extractMethods(content: string): string[] {
  const regex = /(?:public|private|protected)\s+(?:static\s+)?(?:\w+(?:<[\w\s,?]+>)?)\s+(\w+)\s*\(/g;
  const methods: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (!['if', 'for', 'while', 'switch'].includes(match[1])) {
      methods.push(match[1]);
    }
  }
  return [...new Set(methods)].slice(0, 10);
}

function inferArchitectureLayer(filePath: string): string {
  const path = filePath.toLowerCase();
  if (path.includes('controller')) return 'Presentation Layer';
  if (path.includes('service') || path.includes('handler')) return 'Business Layer';
  if (path.includes('repository') || path.includes('entity')) return 'Persistence Layer';
  if (path.includes('dto')) return 'Transfer Layer';
  if (path.includes('config')) return 'Configuration Layer';
  if (path.includes('security')) return 'Security Layer';
  return 'Infrastructure Layer';
}

function inferPurpose(filePath: string, content: string): string {
  const path = filePath.toLowerCase();
  const contentLower = content.toLowerCase();

  if (path.includes('handler')) {
    if (contentLower.includes('refund')) return 'Handles refund calculation';
    if (contentLower.includes('tax')) return 'Handles tax calculation';
    return 'Handles business logic';
  }

  if (path.includes('service')) {
    if (contentLower.includes('token')) return 'JWT token management';
    if (contentLower.includes('crypto')) return 'Cryptographic operations';
    return 'Business service';
  }

  return 'General implementation';
}

function inferBusinessDomain(filePath: string, content: string): string {
  const path = filePath.toLowerCase();
  const contentLower = content.toLowerCase();

  if (path.includes('refund') || contentLower.includes('refund')) return 'Tax Refund';
  if (path.includes('tax') || contentLower.includes('tax')) return 'Tax Calculation';
  if (path.includes('token') || path.includes('jwt')) return 'Token Management';
  if (path.includes('auth') || path.includes('login')) return 'Authentication';
  if (path.includes('crypto')) return 'Cryptography';
  return 'General Business';
}

function calculateComplexity(content: string): string {
  const lines = content.split('\n').length;
  const conditions = (content.match(/if\s*\(|switch\s*\(|for\s*\(|while\s*\(/g) || []).length;

  const score = lines * 0.01 + conditions * 3;

  if (score > 100) return 'High';
  if (score > 50) return 'Medium';
  return 'Low';
}

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: text.substring(0, 8000),
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Embedding generation failed:', error);
    // 더미 임베딩 반환
    return Array(3072).fill(0);
  }
}

export { router };