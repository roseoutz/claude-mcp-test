import { OpenAI } from 'openai';
import { StorageService } from './storage.service';

/**
 * Analysis Service
 * 
 * 코드 분석 및 AI 기반 인사이트 생성을 담당하는 서비스입니다.
 * 
 * 주요 기능:
 * - OpenAI API를 통한 코드 분석
 * - 임베딩 생성 및 검색
 * - 분석 결과 저장 및 조회
 * - 세션 기반 상태 관리
 */
export class AnalysisService {
  private openai: OpenAI;
  private storage: StorageService;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.storage = new StorageService();
  }

  /**
   * 코드베이스 학습 시작
   */
  async startLearning(sessionId: string, repository: string, branch: string, patterns: string[]): Promise<any> {
    try {
      // 세션 정보 저장
      await this.storage.saveSession(sessionId, {
        repository,
        branch,
        patterns,
        status: 'learning',
        started_at: new Date().toISOString(),
      });

      // 학습 프로세스 시뮬레이션 (실제로는 파일 시스템 스캔 등)
      const mockFiles = [
        'src/app.ts',
        'src/services/user.service.ts', 
        'src/controllers/auth.controller.ts',
        'src/utils/helper.ts',
        'test/user.test.ts'
      ];

      // 각 파일에 대한 임베딩 생성 (실제로는 파일 내용 읽어서 처리)
      const embeddings = [];
      for (const file of mockFiles) {
        const mockContent = `// Mock content for ${file}\nexport class Example {}`;
        const embedding = await this.generateEmbedding(mockContent);
        
        embeddings.push({
          file,
          content: mockContent,
          embedding,
          metadata: {
            language: file.endsWith('.ts') ? 'typescript' : 'javascript',
            size: mockContent.length,
          },
        });
      }

      // 임베딩 결과 저장
      await this.storage.saveAnalysisResult(`embeddings_${sessionId}`, embeddings);

      // 세션 상태 업데이트
      const sessionData = await this.storage.getSession(sessionId);
      await this.storage.saveSession(sessionId, {
        ...sessionData,
        status: 'learned',
        files_processed: mockFiles.length,
        completed_at: new Date().toISOString(),
      });

      return {
        success: true,
        session_id: sessionId,
        files_processed: mockFiles.length,
        total_size_bytes: embeddings.reduce((sum, e) => sum + e.content.length, 0),
        message: 'Codebase learning completed',
      };

    } catch (error) {
      await this.storage.saveSession(sessionId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        failed_at: new Date().toISOString(),
      });

      throw error;
    }
  }

  /**
   * 코드 검색 수행
   */
  async searchCode(sessionId: string, query: string, semanticSearch: boolean = false): Promise<any[]> {
    try {
      if (semanticSearch) {
        // 시맨틱 검색: 쿼리의 임베딩 생성
        const queryEmbedding = await this.generateEmbedding(query);
        
        // 저장된 임베딩과 비교 (실제로는 벡터 검색)
        const embeddings = await this.storage.getAnalysisResult(`embeddings_${sessionId}`);
        
        if (!embeddings) {
          throw new Error('No learned codebase found for this session');
        }

        // 유사도 계산 (코사인 유사도 시뮬레이션)
        const results = embeddings.map((item: any) => ({
          file_path: item.file,
          line_number: 1,
          code_snippet: item.content.split('\n')[0],
          relevance_score: Math.random() * 0.5 + 0.5, // Mock similarity
          explanation: `Semantic match for: ${query}`,
        })).sort((a: any, b: any) => b.relevance_score - a.relevance_score);

        return results.slice(0, 10);
      } else {
        // 텍스트 검색: 단순 문자열 매칭
        const embeddings = await this.storage.getAnalysisResult(`embeddings_${sessionId}`);
        
        if (!embeddings) {
          throw new Error('No learned codebase found for this session');
        }

        const results = embeddings.filter((item: any) => 
          item.content.toLowerCase().includes(query.toLowerCase())
        ).map((item: any) => ({
          file_path: item.file,
          line_number: 1,
          code_snippet: item.content.split('\n')[0],
          relevance_score: 0.8,
          explanation: `Text match for: ${query}`,
        }));

        return results;
      }
    } catch (error) {
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 코드 임베딩 생성
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.warn('Failed to generate embedding, using mock:', error);
      // 임베딩 생성 실패시 mock 데이터 반환
      return Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
    }
  }

  /**
   * 코드 분석 수행
   */
  async analyzeCode(sessionId: string, analysisType: string): Promise<any> {
    try {
      const sessionData = await this.storage.getSession(sessionId);
      
      if (!sessionData) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // 분석 유형에 따른 처리
      let analysisResult;
      
      switch (analysisType) {
        case 'security':
          analysisResult = await this.performSecurityAnalysis(sessionId);
          break;
        case 'architecture':
          analysisResult = await this.performArchitectureAnalysis(sessionId);
          break;
        case 'quality':
          analysisResult = await this.performQualityAnalysis(sessionId);
          break;
        default:
          throw new Error(`Unknown analysis type: ${analysisType}`);
      }

      // 분석 결과 저장
      const analysisId = `${analysisType}_${sessionId}_${Date.now()}`;
      await this.storage.saveAnalysisResult(analysisId, analysisResult);

      return {
        analysis_id: analysisId,
        session_id: sessionId,
        analysis_type: analysisType,
        result: analysisResult,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 보안 분석 수행
   */
  private async performSecurityAnalysis(sessionId: string): Promise<any> {
    // Mock 보안 분석 결과
    return {
      summary: 'Security analysis completed',
      findings: [
        {
          type: 'vulnerability',
          severity: 'high',
          file_path: 'src/auth.ts',
          line_number: 25,
          description: 'Hardcoded API key detected',
          suggestion: 'Use environment variables for sensitive data',
        },
        {
          type: 'weakness',
          severity: 'medium',
          file_path: 'src/validation.ts',
          line_number: 12,
          description: 'Insufficient input validation',
          suggestion: 'Add proper input sanitization',
        },
      ],
      statistics: {
        total_files_analyzed: 15,
        vulnerabilities_found: 1,
        weaknesses_found: 1,
        score: 85,
      },
    };
  }

  /**
   * 아키텍처 분석 수행
   */
  private async performArchitectureAnalysis(sessionId: string): Promise<any> {
    return {
      summary: 'Architecture analysis completed',
      patterns: [
        {
          name: 'MVC Pattern',
          confidence: 0.85,
          files: ['src/controllers/', 'src/models/', 'src/views/'],
          description: 'Model-View-Controller pattern detected',
        },
        {
          name: 'Repository Pattern',
          confidence: 0.72,
          files: ['src/repositories/'],
          description: 'Data access layer abstraction found',
        },
      ],
      dependencies: {
        circular_dependencies: [],
        unused_dependencies: ['lodash'],
        outdated_packages: [
          { name: 'express', current: '4.18.0', latest: '4.18.2' },
        ],
      },
      metrics: {
        complexity_score: 6.2,
        maintainability_index: 78,
        coupling_score: 3.4,
      },
    };
  }

  /**
   * 코드 품질 분석 수행
   */
  private async performQualityAnalysis(sessionId: string): Promise<any> {
    return {
      summary: 'Code quality analysis completed',
      metrics: {
        overall_score: 82,
        test_coverage: 75,
        code_duplication: 5,
        technical_debt_hours: 12.5,
      },
      issues: [
        {
          type: 'code_smell',
          severity: 'minor',
          file_path: 'src/utils.ts',
          line_number: 45,
          description: 'Long parameter list',
          suggestion: 'Consider using object parameter',
        },
        {
          type: 'duplication',
          severity: 'major',
          files: ['src/service1.ts', 'src/service2.ts'],
          description: 'Duplicated code block detected',
          suggestion: 'Extract common functionality to shared utility',
        },
      ],
      recommendations: [
        'Increase test coverage to 85%+',
        'Reduce code duplication below 3%',
        'Add JSDoc comments to public methods',
      ],
    };
  }

  /**
   * Diff 분석 수행
   */
  async analyzeDiff(sessionId: string, baseBranch: string, targetBranch: string, includeImpact: boolean): Promise<any[]> {
    // Mock diff 분석 결과
    const changes = [
      {
        file_path: 'src/app.ts',
        changes: [
          {
            type: 'modified',
            line_number: 10,
            before: 'const port = 3000;',
            after: 'const port = process.env.PORT || 3000;',
            explanation: 'Made port configurable via environment variable',
          },
        ],
        impact_summary: includeImpact ? 'Low impact - configuration change only' : '',
        affected_components: includeImpact ? ['ServerConfig'] : [],
      },
      {
        file_path: 'src/database.ts',
        changes: [
          {
            type: 'added',
            line_number: 25,
            after: 'async connectToDatabase() { ... }',
            explanation: 'Added database connection method',
          },
        ],
        impact_summary: includeImpact ? 'Medium impact - new database functionality' : '',
        affected_components: includeImpact ? ['DatabaseService', 'UserService'] : [],
      },
    ];

    return changes;
  }
}