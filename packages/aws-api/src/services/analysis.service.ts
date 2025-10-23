import { OpenAI } from 'openai';
import { StorageService } from './storage.service';
import { ElasticsearchVectorStore } from '@code-ai/shared/src/services/elasticsearch.service';
import { AIService } from '@code-ai/shared/src/services/ai.service';
import { CodeGraphService } from '@code-ai/shared/src/services/code-graph.service';
import { GitService } from '@code-ai/shared/src/services/git.service';
import { IntelligentSearchService, IntelligentSearchResult } from '@code-ai/shared/src/services/intelligent-search.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

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
  // 검색 및 분석 가중치 설정
  private static readonly SEARCH_WEIGHTS = {
    HYBRID_SEARCH_WEIGHT: 0.7,
    SEMANTIC_SIMILARITY_WEIGHT: 0.30,
    STRUCTURAL_RELEVANCE_WEIGHT: 0.25,
    CONTEXTUAL_FIT_WEIGHT: 0.15,
    PATTERN_MATCH_WEIGHT: 0.10,
    IMPORTANCE_WEIGHT: 0.20
  };

  // 분석 임계값 설정
  private static readonly ANALYSIS_THRESHOLDS = {
    HIGH_COUPLING_THRESHOLD: 0.8,
    HIGH_PAGERANK_THRESHOLD: 0.7,
    MAX_FILES_TO_ANALYZE: 100,
    MAX_RESULTS_TO_RETURN: 20,
    MAX_RECOMMENDATIONS: 10,
    COMPLEXITY_NORMALIZATION_FACTOR: 3
  };

  // 보안 점수 감점
  private static readonly SECURITY_PENALTIES = {
    CRITICAL_PENALTY: 25,
    HIGH_PENALTY: 10,
    MEDIUM_PENALTY: 5,
    LOW_PENALTY: 2
  };

  // 품질 점수 감점
  private static readonly QUALITY_PENALTIES = {
    MAJOR_ISSUE_PENALTY: 10,
    MINOR_ISSUE_PENALTY: 3,
    COMPLEXITY_PENALTY_FACTOR: 2,
    MAJOR_ISSUE_DEBT_HOURS: 2,
    MINOR_ISSUE_DEBT_HOURS: 0.5
  };

  // 파일 필터링 설정
  private static readonly ALLOWED_EXTENSIONS = ['.kt', '.java'];
  private static readonly EXCLUDED_PATHS = [
    '/build/',
    '/target/',
    '/.gradle/',
    '/generated/',
    '.class'
  ];
  private openai: OpenAI;
  private storage: StorageService;
  private vectorStore: ElasticsearchVectorStore;
  private aiService: AIService;
  private graphService: CodeGraphService;
  private intelligentSearch: IntelligentSearchService;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.storage = new StorageService();

    // 실제 서비스들 초기화
    this.vectorStore = new ElasticsearchVectorStore();
    this.aiService = new AIService();
    this.graphService = new CodeGraphService();
    this.intelligentSearch = new IntelligentSearchService(
      this.vectorStore,
      this.graphService,
      this.aiService
    );
  }

  /**
   * 서비스 초기화
   */
  async initialize(): Promise<void> {
    await this.vectorStore.initialize(`codebase-${Date.now()}`);
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

      // 실제 Git 저장소에서 파일 수집
      const repoPath = await GitService.cloneOrUpdate(repository, branch);
      const files = await this.collectFiles(repoPath, patterns);

      // 코드 그래프 구축
      const codeGraph = await this.graphService.buildGraph(files);

      console.log(`Graph built: ${codeGraph.nodes.size} nodes, ${codeGraph.relations.length} relations`);

      let processedCount = 0;
      const totalFiles = files.length;
      const failedFiles: string[] = [];

      // 배치 크기 설정 (API rate limit 고려)
      const BATCH_SIZE = 10;

      // 파일을 배치로 나누어 병렬 처리
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);

        // 배치 내 파일들을 병렬로 처리
        const batchResults = await Promise.allSettled(
          batch.map(async (fileInfo) => {
            const embedding = await this.aiService.generateEmbedding(fileInfo.content);

            // 그래프 메타데이터 생성
            const relevantNodes = Array.from(codeGraph.nodes.values()).filter(
              node => node.filePath === fileInfo.path
            );

            const graphMetadata = relevantNodes.length > 0
              ? this.graphService.generateGraphMetadata(relevantNodes[0].id)
              : undefined;

            await this.vectorStore.addDocumentWithEmbedding(
              `${sessionId}_${fileInfo.path}`,
              fileInfo.content,
              embedding,
              {
                sessionId,
                filePath: fileInfo.path,
                language: fileInfo.language,
                repository,
                branch,
                size: fileInfo.content.length,
                graphMetadata
              }
            );

            return fileInfo.path;
          })
        );

        // 배치 결과 처리
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            processedCount++;
          } else {
            const fileInfo = batch[index];
            failedFiles.push(fileInfo.path);
            console.warn(`Failed to process file ${fileInfo.path}:`, result.reason);
          }
        });

        // 진행 상황 로깅
        console.log(`Processed ${processedCount}/${totalFiles} files (${failedFiles.length} failed)`);
      }

      // 실패한 파일이 있으면 경고
      if (failedFiles.length > 0) {
        console.warn(`⚠️  ${failedFiles.length}개 파일 처리 실패:`, failedFiles.slice(0, 5));
      }

      // 세션 상태 업데이트
      const sessionData = await this.storage.getSession(sessionId);
      await this.storage.saveSession(sessionId, {
        ...sessionData,
        status: 'learned',
        files_processed: processedCount,
        total_files: totalFiles,
        completed_at: new Date().toISOString(),
        graph_stats: {
          nodes: codeGraph.nodes.size,
          relations: codeGraph.relations.length
        }
      });

      return {
        success: true,
        session_id: sessionId,
        files_processed: processedCount,
        total_files: totalFiles,
        total_size_bytes: files.reduce((sum, f) => sum + f.content.length, 0),
        graph_nodes: codeGraph.nodes.size,
        graph_relations: codeGraph.relations.length,
        message: 'Codebase learning completed with graph analysis',
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
   * 파일 수집
   */
  private async collectFiles(repoPath: string, patterns: string[]): Promise<Array<{
    path: string;
    content: string;
    language: string;
  }>> {
    const files: Array<{
      path: string;
      content: string;
      language: string;
    }> = [];

    // 패턴에 맞는 파일들 찾기
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: repoPath,
        ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
      });

      for (const match of matches) {
        try {
          const fullPath = path.join(repoPath, match);
          const content = await fs.readFile(fullPath, 'utf8');
          const language = this.detectLanguage(match);

          // Kotlin/Java 전용 필터링
          const ext = path.extname(match).toLowerCase();
          if (!AnalysisService.ALLOWED_EXTENSIONS.includes(ext)) {
            console.warn(`Non Kotlin/Java file ${match}, skipping`);
            continue;
          }

          // 생성된 파일 제외 (빌드 결과물, IDE 생성 파일 등)
          if (AnalysisService.EXCLUDED_PATHS.some(excludedPath =>
            match.includes(excludedPath) || match.endsWith(excludedPath)
          )) {
            console.warn(`Generated file ${match}, skipping`);
            continue;
          }

          files.push({
            path: match,
            content,
            language,
          });
        } catch (readError) {
          console.warn(`Failed to read file ${match}:`, readError);
        }
      }
    }

    return files;
  }

  /**
   * 언어 감지
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
      '.ts': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
    };
    return langMap[ext] || 'text';
  }

  /**
   * 코드 검색 수행 - 지능형 검색 활용
   */
  async searchCode(sessionId: string, query: string, semanticSearch: boolean = false): Promise<any[]> {
    try {
      const sessionData = await this.storage.getSession(sessionId);
      if (!sessionData) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      if (semanticSearch) {
        // 지능형 시맨틱 검색 사용
        const searchContext = {
          sessionId,
          taskContext: 'search',
          codebaseArea: 'all'
        };

        const results = await this.intelligentSearch.intelligentSearch(query, searchContext);

        return results.map((result: IntelligentSearchResult) => ({
          file_path: result.metadata?.filePath || 'unknown',
          line_number: result.metadata?.lineStart || 1,
          code_snippet: this.truncateContent(result.content, 200),
          relevance_score: result.intelligenceScore || result.score,
          explanation: `Intelligent semantic match (${result.relevanceFactors?.semanticSimilarity?.toFixed(2)} semantic, ${result.relevanceFactors?.structuralRelevance?.toFixed(2)} structural)`,
          related_nodes: result.relatedNodes?.slice(0, 3).map((n: { id: string; type: string; relation: string; strength: number }) => n.id) || [],
          graph_context: result.suggestedActions.join(', ') || 'none'
        }));
      } else {
        // 하이브리드 검색 (키워드 + 벡터)
        const searchFilter = {
          must: [
            { term: { 'metadata.sessionId': sessionId } }
          ]
        };

        const results = await this.vectorStore.hybridSearch(
          query,
          undefined, // queryEmbedding - AI가 생성하도록 내비
          10,
          searchFilter
        );

        return results.map(result => ({
          file_path: result.metadata?.filePath || 'unknown',
          line_number: result.metadata?.lineStart || 1,
          code_snippet: this.truncateContent(result.content, 200),
          relevance_score: result.score,
          explanation: `Hybrid search match (keyword + semantic)`,
          language: result.metadata?.language || 'unknown'
        }));
      }
    } catch (error) {
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 내용 자르기
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }

  // 임베딩 생성은 이제 AIService를 통해 처리됨

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
   * 보안 분석 수행 - 실제 AI 분석 사용
   */
  private async performSecurityAnalysis(sessionId: string): Promise<any> {
    try {
      const sessionData = await this.storage.getSession(sessionId);
      if (!sessionData) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // 세션의 모든 파일 검색
      const searchFilter = {
        must: [
          { term: { 'metadata.sessionId': sessionId } }
        ]
      };

      const allFiles = await this.vectorStore.search(
        '*', // 모든 파일
        AnalysisService.ANALYSIS_THRESHOLDS.MAX_FILES_TO_ANALYZE,
        searchFilter
      );

      let totalFindings: any[] = [];
      let analyzedFiles = 0;

      // 각 파일에 대해 보안 분석 수행
      for (const fileResult of allFiles) {
        try {
          const vulnerabilities = await this.aiService.detectVulnerabilities(
            fileResult.content,
            fileResult.metadata?.language || 'unknown'
          );

          if (vulnerabilities.length > 0) {
            totalFindings.push(...vulnerabilities.map(vuln => ({
              type: vuln.type.toLowerCase().includes('vulnerability') ? 'vulnerability' : 'weakness',
              severity: vuln.severity,
              file_path: fileResult.metadata?.filePath || 'unknown',
              line_number: vuln.line || 1,
              description: vuln.description,
              suggestion: vuln.suggestion || 'Review and address this security issue',
            })));
          }

          analyzedFiles++;
        } catch (analysisError) {
          console.warn(`Security analysis failed for file ${fileResult.metadata?.filePath}:`, analysisError);
        }
      }

      const vulnerabilities = totalFindings.filter(f => f.type === 'vulnerability');
      const weaknesses = totalFindings.filter(f => f.type === 'weakness');

      // 보안 점수 계산 (100 - 발견된 이슈에 따른 감점)
      const criticalCount = totalFindings.filter(f => f.severity === 'critical').length;
      const highCount = totalFindings.filter(f => f.severity === 'high').length;
      const mediumCount = totalFindings.filter(f => f.severity === 'medium').length;
      const lowCount = totalFindings.filter(f => f.severity === 'low').length;

      const score = Math.max(0, 100 -
        (criticalCount * AnalysisService.SECURITY_PENALTIES.CRITICAL_PENALTY) -
        (highCount * AnalysisService.SECURITY_PENALTIES.HIGH_PENALTY) -
        (mediumCount * AnalysisService.SECURITY_PENALTIES.MEDIUM_PENALTY) -
        (lowCount * AnalysisService.SECURITY_PENALTIES.LOW_PENALTY));

      return {
        summary: `Security analysis completed - analyzed ${analyzedFiles} files`,
        findings: totalFindings.slice(0, AnalysisService.ANALYSIS_THRESHOLDS.MAX_RESULTS_TO_RETURN),
        statistics: {
          total_files_analyzed: analyzedFiles,
          vulnerabilities_found: vulnerabilities.length,
          weaknesses_found: weaknesses.length,
          critical_issues: criticalCount,
          high_issues: highCount,
          medium_issues: mediumCount,
          low_issues: lowCount,
          score,
        },
      };
    } catch (error) {
      console.error('Security analysis failed:', error);
      return {
        summary: 'Security analysis failed',
        findings: [],
        statistics: {
          total_files_analyzed: 0,
          vulnerabilities_found: 0,
          weaknesses_found: 0,
          score: 0,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 아키텍처 분석 수행 - 코드 그래프 기반 분석
   */
  private async performArchitectureAnalysis(sessionId: string): Promise<any> {
    try {
      const sessionData = await this.storage.getSession(sessionId);
      if (!sessionData) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // 그래프 기반 패턴 검색
      const patterns = await this.vectorStore.searchByPattern([
        'Repository', 'Service', 'Controller', 'Factory', 'Observer',
        'Singleton', 'Strategy', 'Decorator', 'Adapter'
      ]);

      // 클러스터 분석
      const clusters = await this.vectorStore.searchByCluster('all', undefined, 50);

      // 중요한 노드들 (높은 PageRank)
      const criticalNodes = await this.vectorStore.searchByCentrality('pagerank', AnalysisService.ANALYSIS_THRESHOLDS.HIGH_PAGERANK_THRESHOLD);

      // 순환 의존성 검사
      const circularDeps: string[] = [];
      for (const cluster of clusters) {
        const clusterMetadata = cluster.metadata?.graphMetadata as any;
        if (clusterMetadata?.cluster?.coupling && clusterMetadata.cluster.coupling > AnalysisService.ANALYSIS_THRESHOLDS.HIGH_COUPLING_THRESHOLD) {
          circularDeps.push(cluster.content);
        }
      }

      // 복잡도 계산
      const complexitySum = clusters.reduce((sum, item) => {
        const itemMetadata = item.metadata?.graphMetadata as any;
        return sum + (itemMetadata?.centrality?.degree || 0);
      }, 0);
      const avgComplexity = clusters.length > 0 ? complexitySum / clusters.length : 0;

      return {
        summary: `Architecture analysis completed - found ${patterns.length} patterns, ${clusters.length} clusters`,
        patterns: patterns.map(pattern => ({
          name: pattern.content.split(' ')[0] + ' Pattern',
          confidence: pattern.score || 0.5,
          files: [pattern.metadata?.filePath || 'unknown'],
          description: `Pattern detected through graph analysis: ${pattern.content}`,
        })),
        clusters: {
          total_clusters: clusters.length,
          critical_components: criticalNodes.length,
          high_coupling_components: circularDeps.length,
        },
        dependencies: {
          circular_dependencies: circularDeps.slice(0, 5), // 최대 5개만 표시
          unused_dependencies: [], // TODO: package.json 분석 필요
          outdated_packages: [], // TODO: dependency 버전 분석 필요
        },
        metrics: {
          complexity_score: Math.min(10, Math.max(1, avgComplexity / AnalysisService.ANALYSIS_THRESHOLDS.COMPLEXITY_NORMALIZATION_FACTOR)),
          maintainability_index: Math.max(0, 100 - avgComplexity * AnalysisService.QUALITY_PENALTIES.COMPLEXITY_PENALTY_FACTOR),
          coupling_score: clusters.reduce((sum, c) => {
            const metadata = c.metadata?.graphMetadata as any;
            return sum + (metadata?.cluster?.coupling || 0);
          }, 0) / Math.max(1, clusters.length),
          cohesion_score: clusters.reduce((sum, c) => {
            const metadata = c.metadata?.graphMetadata as any;
            return sum + (metadata?.cluster?.cohesion || 0);
          }, 0) / Math.max(1, clusters.length),
        },
      };
    } catch (error) {
      console.error('Architecture analysis failed:', error);
      return {
        summary: 'Architecture analysis failed',
        patterns: [],
        dependencies: { circular_dependencies: [], unused_dependencies: [], outdated_packages: [] },
        metrics: { complexity_score: 0, maintainability_index: 0, coupling_score: 0 },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 코드 품질 분석 수행 - AI 기반 분석
   */
  private async performQualityAnalysis(sessionId: string): Promise<any> {
    try {
      const sessionData = await this.storage.getSession(sessionId);
      if (!sessionData) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // 세션의 모든 파일 검색
      const searchFilter = {
        must: [
          { term: { 'metadata.sessionId': sessionId } }
        ]
      };

      const allFiles = await this.vectorStore.search('*', AnalysisService.ANALYSIS_THRESHOLDS.MAX_FILES_TO_ANALYZE / 2, searchFilter);

      let totalIssues: any[] = [];
      let totalComplexity = 0;
      let analyzedFiles = 0;
      let totalLines = 0;

      // 각 파일에 대해 품질 분석 수행
      for (const fileResult of allFiles) {
        try {
          const analysis = await this.aiService.analyzeCode(
            fileResult.content,
            fileResult.metadata?.language || 'unknown'
          );

          const refactoring = await this.aiService.suggestRefactoring(
            fileResult.content,
            fileResult.metadata?.language || 'unknown'
          );

          totalComplexity += analysis.complexity || 1;
          analyzedFiles++;
          totalLines += fileResult.content.split('\n').length;

          // 리팩토링 제안을 이슈로 변환
          totalIssues.push(...refactoring.map(suggestion => ({
            type: suggestion.type.toLowerCase().replace(' ', '_'),
            severity: this.getSeverityFromType(suggestion.type),
            file_path: fileResult.metadata?.filePath || 'unknown',
            line_number: 1, // TODO: 정확한 라인 번호 추출
            description: suggestion.description,
            suggestion: `Before: ${suggestion.before}\nAfter: ${suggestion.after}`,
          })));
        } catch (analysisError) {
          console.warn(`Quality analysis failed for file ${fileResult.metadata?.filePath}:`, analysisError);
        }
      }

      const avgComplexity = analyzedFiles > 0 ? totalComplexity / analyzedFiles : 0;

      // AI를 통한 전반적인 개선 제안
      const improvements = await this.aiService.suggestImprovements({
        statistics: {
          totalFiles: analyzedFiles,
          totalLines,
          avgComplexity,
        }
      });

      // 품질 점수 계산
      const majorIssues = totalIssues.filter(i => i.severity === 'major').length;
      const minorIssues = totalIssues.filter(i => i.severity === 'minor').length;
      const overallScore = Math.max(0, 100 -
        (majorIssues * AnalysisService.QUALITY_PENALTIES.MAJOR_ISSUE_PENALTY) -
        (minorIssues * AnalysisService.QUALITY_PENALTIES.MINOR_ISSUE_PENALTY) -
        (avgComplexity * AnalysisService.QUALITY_PENALTIES.COMPLEXITY_PENALTY_FACTOR));

      return {
        summary: `Code quality analysis completed - analyzed ${analyzedFiles} files`,
        metrics: {
          overall_score: Math.round(overallScore),
          average_complexity: Math.round(avgComplexity * 10) / 10,
          total_lines: totalLines,
          files_analyzed: analyzedFiles,
          issues_found: totalIssues.length,
          technical_debt_hours: Math.round((
            majorIssues * AnalysisService.QUALITY_PENALTIES.MAJOR_ISSUE_DEBT_HOURS +
            minorIssues * AnalysisService.QUALITY_PENALTIES.MINOR_ISSUE_DEBT_HOURS
          ) * 10) / 10,
        },
        issues: totalIssues.slice(0, AnalysisService.ANALYSIS_THRESHOLDS.MAX_RESULTS_TO_RETURN),
        recommendations: improvements.slice(0, AnalysisService.ANALYSIS_THRESHOLDS.MAX_RECOMMENDATIONS),
      };
    } catch (error) {
      console.error('Quality analysis failed:', error);
      return {
        summary: 'Code quality analysis failed',
        metrics: { overall_score: 0, average_complexity: 0, total_lines: 0, files_analyzed: 0 },
        issues: [],
        recommendations: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 이슈 타입에서 심각도 추출
   */
  private getSeverityFromType(type: string): 'minor' | 'major' | 'critical' {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('critical') || lowerType.includes('security')) return 'critical';
    if (lowerType.includes('performance') || lowerType.includes('duplication')) return 'major';
    return 'minor';
  }

  /**
   * Diff 분석 수행 - Git과 AI 기반 실제 분석
   */
  async analyzeDiff(sessionId: string, baseBranch: string, targetBranch: string, includeImpact: boolean): Promise<any[]> {
    try {
      const sessionData = await this.storage.getSession(sessionId);
      if (!sessionData) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const repository = sessionData.repository;
      if (!repository) {
        throw new Error('Repository information not found in session');
      }

      // Git diff 가져오기
      const repoPath = await GitService.cloneOrUpdate(repository, targetBranch);
      const gitService = new GitService(repoPath);
      const diffResult = await gitService.getDiff(baseBranch, targetBranch);

      const analyzedChanges = [];

      for (const fileDiff of diffResult.files) {
        try {
          // 변경된 코드에 대한 AI 분석
          const changeContent = fileDiff.additions.concat(fileDiff.deletions).join('\n');

          if (changeContent.trim()) {
            const explanation = await this.aiService.explainCode(
              changeContent,
              this.detectLanguage(fileDiff.path),
              'This is a code diff analysis'
            );

            const changes = [];

            // 추가된 라인들
            for (const addition of fileDiff.additions) {
              changes.push({
                type: 'added',
                line_number: addition.lineNumber,
                after: addition.content,
                explanation: `Added: ${explanation.split('.')[0]}`, // 첫 문장만 사용
              });
            }

            // 삭제된 라인들
            for (const deletion of fileDiff.deletions) {
              changes.push({
                type: 'deleted',
                line_number: deletion.lineNumber,
                before: deletion.content,
                explanation: `Removed: ${explanation.split('.')[0]}`,
              });
            }

            let impactSummary = '';
            let affectedComponents: string[] = [];

            if (includeImpact) {
              // 그래프 기반 영향도 분석
              try {
                const impact = await this.vectorStore.analyzeImpact(fileDiff.path);
                impactSummary = `${impact.riskLevel} impact - ${impact.directlyAffected.length} files directly affected, ${impact.indirectlyAffected.length} indirectly affected`;
                affectedComponents = impact.directlyAffected.slice(0, 5).map(item =>
                  item.metadata?.filePath || item.content.substring(0, 50)
                );
              } catch (impactError) {
                console.warn(`Impact analysis failed for ${fileDiff.path}:`, impactError);
                impactSummary = 'Impact analysis unavailable';
              }
            }

            analyzedChanges.push({
              file_path: fileDiff.path,
              changes,
              impact_summary: impactSummary,
              affected_components: affectedComponents,
              change_summary: explanation.split('.')[0], // AI가 생성한 변경 요약
            });
          }
        } catch (fileError) {
          console.warn(`Failed to analyze diff for ${fileDiff.path}:`, fileError);
          // 기본 정보라도 포함
          analyzedChanges.push({
            file_path: fileDiff.path,
            changes: [
              {
                type: 'unknown',
                line_number: 0,
                explanation: 'Analysis failed but changes detected',
              }
            ],
            impact_summary: includeImpact ? 'Unknown impact' : '',
            affected_components: [],
            error: fileError instanceof Error ? fileError.message : 'Unknown error',
          });
        }
      }

      return analyzedChanges;
    } catch (error) {
      console.error('Diff analysis failed:', error);
      throw new Error(`Diff analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}