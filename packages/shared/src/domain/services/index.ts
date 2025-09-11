/**
 * Domain Services
 * 엔티티나 값 객체에 속하지 않는 도메인 로직
 */

import type { 
  CodeComponent, 
  FileAnalysis,
  CodebaseAnalysis,
  ImpactAnalysis
} from '../../types/analysis.js';
import type { Repository, CommitInfo, GitFile } from '../../types/git.js';
import { ComponentGraph, BranchComparison } from '../entities/index.js';
import { FilePath, Language, Complexity, RelevanceScore } from '../value-objects/index.js';

/**
 * 코드 분석 도메인 서비스
 */
export class CodeAnalysisService {
  /**
   * 파일 복잡도 계산
   */
  static calculateFileComplexity(content: string, language: Language): Complexity {
    let complexity = 1; // Base complexity

    // Count control flow statements
    const controlFlowPatterns = [
      /\bif\b/g,
      /\belse\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\btry\b/g,
    ];

    controlFlowPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });

    // Additional complexity for certain language features
    if (language.isProgramming) {
      // Count nested levels (simplified)
      const lines = content.split('\n');
      let maxNesting = 0;
      let currentNesting = 0;

      lines.forEach(line => {
        const openBraces = (line.match(/{/g) || []).length;
        const closeBraces = (line.match(/}/g) || []).length;
        currentNesting += openBraces - closeBraces;
        maxNesting = Math.max(maxNesting, currentNesting);
      });

      complexity += Math.floor(maxNesting / 2);
    }

    return new Complexity(complexity);
  }

  /**
   * 컴포넌트 간 의존성 분석
   */
  static analyzeDependencies(
    components: CodeComponent[],
    fileContents: Map<string, string>
  ): ComponentGraph {
    const graph = new ComponentGraph();

    // Add all components to graph
    components.forEach(component => {
      graph.addComponent(component);
    });

    // Analyze dependencies between components
    components.forEach(component => {
      const content = fileContents.get(component.filePath);
      if (!content) return;

      // Extract relevant code section
      const lines = content.split('\n');
      const componentCode = lines
        .slice(component.lineStart - 1, component.lineEnd)
        .join('\n');

      // Find references to other components
      components.forEach(target => {
        if (component.id === target.id) return;

        // Check if component references target
        if (componentCode.includes(target.name)) {
          graph.addDependency(component.id, target.id);
        }
      });
    });

    return graph;
  }

  /**
   * 코드베이스 통계 생성
   */
  static generateStatistics(analysis: CodebaseAnalysis): {
    totalFiles: number;
    totalLines: number;
    averageComplexity: number;
    languageDistribution: Record<string, number>;
    componentDistribution: Record<string, number>;
  } {
    const stats = {
      totalFiles: analysis.files.length,
      totalLines: 0,
      averageComplexity: 0,
      languageDistribution: {} as Record<string, number>,
      componentDistribution: {} as Record<string, number>,
    };

    let totalComplexity = 0;

    analysis.files.forEach(file => {
      stats.totalLines += file.lineCount;
      totalComplexity += file.complexity;

      // Language distribution
      if (!stats.languageDistribution[file.language]) {
        stats.languageDistribution[file.language] = 0;
      }
      stats.languageDistribution[file.language]++;

      // Component distribution
      file.components.forEach(component => {
        if (!stats.componentDistribution[component.type]) {
          stats.componentDistribution[component.type] = 0;
        }
        stats.componentDistribution[component.type]++;
      });
    });

    stats.averageComplexity = stats.totalFiles > 0 
      ? totalComplexity / stats.totalFiles 
      : 0;

    return stats;
  }
}

/**
 * 영향도 분석 도메인 서비스
 */
export class ImpactAnalysisService {
  /**
   * 변경 영향도 계산
   */
  static calculateImpact(
    changedFiles: string[],
    componentGraph: ComponentGraph,
    fileAnalyses: Map<string, FileAnalysis>
  ): ImpactAnalysis {
    const directImpact: string[] = [...changedFiles];
    const indirectImpact: string[] = [];
    const affectedComponents: string[] = [];

    // Find directly affected components
    changedFiles.forEach(filePath => {
      const analysis = fileAnalyses.get(filePath);
      if (analysis) {
        analysis.components.forEach(component => {
          affectedComponents.push(component.id);
        });
      }
    });

    // Find indirectly affected components and files
    const visited = new Set<string>();
    const queue = [...affectedComponents];

    while (queue.length > 0) {
      const componentId = queue.shift()!;
      if (visited.has(componentId)) continue;
      visited.add(componentId);

      // Get components that depend on this one
      const dependents = componentGraph.getDependents(componentId);
      dependents.forEach(dependentId => {
        if (!visited.has(dependentId)) {
          queue.push(dependentId);
          
          const component = componentGraph.getComponent(dependentId);
          if (component && !indirectImpact.includes(component.filePath)) {
            indirectImpact.push(component.filePath);
          }
        }
      });
    }

    // Calculate risk assessment
    const riskFactors: string[] = [];
    
    if (directImpact.length > 10) {
      riskFactors.push('Large number of directly modified files');
    }
    
    if (indirectImpact.length > 20) {
      riskFactors.push('Extensive indirect impact on codebase');
    }

    const cycles = componentGraph.findCycles();
    if (cycles.length > 0) {
      riskFactors.push('Circular dependencies detected');
    }

    // Calculate risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (riskFactors.length === 0) {
      riskLevel = 'low';
    } else if (riskFactors.length === 1) {
      riskLevel = 'medium';
    } else if (riskFactors.length === 2) {
      riskLevel = 'high';
    } else {
      riskLevel = 'critical';
    }

    return {
      directImpact,
      indirectImpact,
      affectedComponents: Array.from(visited),
      riskAssessment: {
        level: riskLevel,
        factors: riskFactors
      },
      suggestions: ImpactAnalysisService.generateSuggestions(
        riskLevel,
        riskFactors,
        cycles
      )
    };
  }

  /**
   * 개선 제안 생성
   */
  private static generateSuggestions(
    riskLevel: string,
    riskFactors: string[],
    cycles: string[][]
  ): string[] {
    const suggestions: string[] = [];

    if (riskLevel === 'high' || riskLevel === 'critical') {
      suggestions.push('Consider breaking this change into smaller, incremental updates');
      suggestions.push('Ensure comprehensive testing of all affected components');
      suggestions.push('Schedule a code review with senior developers');
    }

    if (cycles.length > 0) {
      suggestions.push('Refactor circular dependencies to improve code maintainability');
      cycles.forEach((cycle, index) => {
        suggestions.push(
          `Circular dependency ${index + 1}: ${cycle.join(' -> ')}`
        );
      });
    }

    if (riskFactors.includes('Large number of directly modified files')) {
      suggestions.push('Consider using feature flags for gradual rollout');
    }

    if (riskFactors.includes('Extensive indirect impact on codebase')) {
      suggestions.push('Update integration tests to cover indirect dependencies');
      suggestions.push('Document the changes and their potential impacts');
    }

    return suggestions;
  }
}

/**
 * 검색 관련도 도메인 서비스
 */
export class SearchRelevanceService {
  /**
   * 텍스트 유사도 계산
   */
  static calculateTextSimilarity(query: string, text: string): RelevanceScore {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    // Exact match
    if (textLower.includes(queryLower)) {
      return new RelevanceScore(1.0);
    }

    // Word-based matching
    const queryWords = queryLower.split(/\s+/);
    const textWords = textLower.split(/\s+/);
    
    let matchCount = 0;
    queryWords.forEach(queryWord => {
      if (textWords.some(textWord => textWord.includes(queryWord))) {
        matchCount++;
      }
    });

    const wordScore = matchCount / queryWords.length;

    // Character-based similarity (simplified Levenshtein)
    const commonChars = SearchRelevanceService.countCommonCharacters(
      queryLower,
      textLower
    );
    const charScore = commonChars / Math.max(queryLower.length, textLower.length);

    // Combine scores
    const finalScore = wordScore * 0.7 + charScore * 0.3;
    return new RelevanceScore(Math.min(1.0, finalScore));
  }

  /**
   * 의미적 관련도 계산 (임베딩 기반)
   */
  static calculateSemanticRelevance(
    queryEmbedding: number[],
    textEmbedding: number[]
  ): RelevanceScore {
    // Cosine similarity
    const dotProduct = queryEmbedding.reduce(
      (sum, val, i) => sum + val * textEmbedding[i],
      0
    );
    
    const queryMagnitude = Math.sqrt(
      queryEmbedding.reduce((sum, val) => sum + val * val, 0)
    );
    
    const textMagnitude = Math.sqrt(
      textEmbedding.reduce((sum, val) => sum + val * val, 0)
    );

    const similarity = dotProduct / (queryMagnitude * textMagnitude);
    
    // Normalize to 0-1 range
    const normalized = (similarity + 1) / 2;
    return new RelevanceScore(normalized);
  }

  /**
   * 컨텍스트 기반 관련도 계산
   */
  static calculateContextualRelevance(
    query: string,
    snippet: string,
    context: { before: string[]; after: string[] }
  ): RelevanceScore {
    // Base relevance from snippet
    const snippetRelevance = SearchRelevanceService.calculateTextSimilarity(
      query,
      snippet
    );

    // Context relevance
    const contextText = [
      ...context.before,
      snippet,
      ...context.after
    ].join(' ');
    
    const contextRelevance = SearchRelevanceService.calculateTextSimilarity(
      query,
      contextText
    );

    // Weighted combination (snippet is more important)
    return snippetRelevance.combine(contextRelevance, 0.7);
  }

  private static countCommonCharacters(str1: string, str2: string): number {
    const chars1 = new Set(str1);
    const chars2 = new Set(str2);
    
    let common = 0;
    chars1.forEach(char => {
      if (chars2.has(char)) {
        common++;
      }
    });
    
    return common;
  }
}

/**
 * 브랜치 관리 도메인 서비스
 */
export class BranchManagementService {
  /**
   * 브랜치 병합 가능성 평가
   */
  static assessMergeability(comparison: BranchComparison): {
    canMerge: boolean;
    conflicts: string[];
    recommendations: string[];
  } {
    const result = {
      canMerge: true,
      conflicts: [] as string[],
      recommendations: [] as string[],
    };

    // Check for large changes
    if (comparison.isLargeChange) {
      result.recommendations.push(
        'Large change detected. Consider reviewing in smaller chunks'
      );
    }

    // Check commit count
    if (comparison.commits.length > 20) {
      result.recommendations.push(
        'Many commits detected. Consider squashing related commits'
      );
    }

    // Check for merge commits
    const mergeCommits = comparison.commits.filter(
      commit => commit.message.toLowerCase().startsWith('merge')
    );
    
    if (mergeCommits.length > 0) {
      result.recommendations.push(
        `${mergeCommits.length} merge commits found. Consider rebasing for cleaner history`
      );
    }

    // Analyze file changes for potential conflicts
    const fileChangeMap = new Map<string, number>();
    comparison.commits.forEach(commit => {
      commit.files.forEach(file => {
        const count = fileChangeMap.get(file.path) || 0;
        fileChangeMap.set(file.path, count + 1);
      });
    });

    // Files changed multiple times might have conflicts
    fileChangeMap.forEach((count, filePath) => {
      if (count > 3) {
        result.conflicts.push(
          `${filePath} modified ${count} times - potential conflict`
        );
      }
    });

    if (result.conflicts.length > 0) {
      result.canMerge = false;
      result.recommendations.push(
        'Resolve potential conflicts before merging'
      );
    }

    return result;
  }

  /**
   * 브랜치 전략 추천
   */
  static recommendBranchingStrategy(
    repository: Repository,
    teamSize: number,
    releaseFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  ): {
    strategy: string;
    branches: string[];
    rules: string[];
  } {
    if (teamSize <= 5 && releaseFrequency === 'daily') {
      return {
        strategy: 'GitHub Flow',
        branches: ['main', 'feature/*'],
        rules: [
          'Create feature branches from main',
          'Merge to main via pull requests',
          'Deploy from main',
          'Keep branches short-lived (< 2 days)'
        ]
      };
    }

    if (teamSize > 20 || releaseFrequency === 'quarterly') {
      return {
        strategy: 'Git Flow',
        branches: [
          'main',
          'develop',
          'feature/*',
          'release/*',
          'hotfix/*'
        ],
        rules: [
          'Feature branches from develop',
          'Release branches from develop',
          'Hotfix branches from main',
          'Merge back to both main and develop',
          'Tag releases on main'
        ]
      };
    }

    // Default: GitLab Flow
    return {
      strategy: 'GitLab Flow',
      branches: [
        'main',
        'production',
        'feature/*',
        'environment/*'
      ],
      rules: [
        'Feature branches from main',
        'Merge to main first',
        'Cherry-pick or merge to production',
        'Use environment branches for staging',
        'Tag production deployments'
      ]
    };
  }
}