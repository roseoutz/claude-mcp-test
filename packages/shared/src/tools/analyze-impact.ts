/**
 * Analyze Impact Tool Handler
 * 코드 변경의 영향도를 분석
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { AnalyzeImpactInput } from '../types/mcp.js';
import { ElasticsearchVectorStore } from '../services/elasticsearch.service.js';
import { logger } from '../utils/logger.js';
import { 
  createTextResponse,
  createErrorResponse,
  createStructuredResponse,
  createTableResponse
} from '../utils/mcp-formatter.js';

/**
 * 영향도 분석 도구 핸들러
 */
export async function handleAnalyzeImpact(args: AnalyzeImpactInput): Promise<CallToolResult> {
  const toolLogger = logger.withContext('analyze-impact');
  
  try {
    toolLogger.info('Starting impact analysis', args);

    // 입력 검증
    const validation = validateInput(args);
    if (!validation.isValid) {
      return createErrorResponse(`Invalid input: ${validation.errors.join(', ')}`);
    }

    const {
      changeDescription,
      affectedFiles,
      analysisDepth = 'basic',
      includeTests = true,
      includeDependencies = true
    } = args;

    toolLogger.info(`Analyzing impact for ${affectedFiles.length} affected files`);

    // 벡터 스토어에서 관련 코드 검색
    const vectorStore = new ElasticsearchVectorStore('impact-analysis');
    await vectorStore.initialize('impact-analysis');

    // 영향도 분석 수행
    const impactAnalysis = await performImpactAnalysis({
      changeDescription,
      affectedFiles,
      vectorStore,
      analysisDepth,
      includeTests,
      includeDependencies
    });

    // 결과 포맷팅
    const summary = formatImpactSummary(impactAnalysis);
    
    return createStructuredResponse(
      `Impact Analysis: ${changeDescription}`,
      {
        summary: impactAnalysis.summary,
        directImpact: impactAnalysis.directImpact,
        indirectImpact: impactAnalysis.indirectImpact,
        riskAssessment: impactAnalysis.riskAssessment,
        recommendations: impactAnalysis.suggestions
      },
      {
        changeDescription,
        affectedFiles,
        analysisDepth,
        timestamp: new Date().toISOString()
      }
    );

  } catch (error) {
    toolLogger.error('Failed to analyze impact', error as Error);
    return createErrorResponse(error as Error);
  }
}

/**
 * 입력 검증
 */
function validateInput(args: AnalyzeImpactInput): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!args.changeDescription || args.changeDescription.trim().length === 0) {
    errors.push('changeDescription is required');
  }

  if (args.changeDescription && args.changeDescription.length > 1000) {
    errors.push('changeDescription is too long (max 1000 characters)');
  }

  if (!args.affectedFiles || args.affectedFiles.length === 0) {
    errors.push('affectedFiles is required and must not be empty');
  }

  if (args.affectedFiles && args.affectedFiles.length > 50) {
    errors.push('too many affected files (max 50)');
  }

  const validDepths = ['basic', 'deep', 'comprehensive'];
  if (args.analysisDepth && !validDepths.includes(args.analysisDepth)) {
    errors.push(`analysisDepth must be one of: ${validDepths.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 영향도 분석 수행
 */
async function performImpactAnalysis(params: {
  changeDescription: string;
  affectedFiles: string[];
  vectorStore: any;
  analysisDepth: string;
  includeTests: boolean;
  includeDependencies: boolean;
}): Promise<{
  summary: {
    totalAffectedFiles: number;
    directImpactFiles: number;
    indirectImpactFiles: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
  };
  directImpact: Array<{
    filePath: string;
    impactType: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  indirectImpact: Array<{
    filePath: string;
    impactType: string;
    description: string;
    confidence: number;
    reason: string;
  }>;
  riskAssessment: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    mitigations: string[];
  };
  suggestions: string[];
}> {
  
  const { changeDescription, affectedFiles, vectorStore, analysisDepth } = params;

  // 직접적 영향 분석
  const directImpact = affectedFiles.map(filePath => ({
    filePath,
    impactType: 'direct_modification',
    description: `File will be directly modified as part of: ${changeDescription}`,
    severity: 'medium' as const
  }));

  // 간접적 영향 분석을 위한 코드 검색
  const indirectImpact: Array<{
    filePath: string;
    impactType: string;
    description: string;
    confidence: number;
    reason: string;
  }> = [];

  // 각 영향받는 파일에 대해 의존성 검색
  for (const filePath of affectedFiles) {
    try {
      // 파일 이름이나 경로를 검색어로 사용
      const fileName = filePath.split('/').pop() || filePath;
      const searchResults = await vectorStore.search(fileName, 10);

      searchResults
        .filter((result: any) => 
          result.metadata.filePath !== filePath && // 자기 자신 제외
          result.score > 0.3 // 최소 관련성 임계값
        )
        .forEach((result: any) => {
          indirectImpact.push({
            filePath: result.metadata.filePath,
            impactType: 'dependency_reference',
            description: `May be affected due to reference or dependency`,
            confidence: result.score,
            reason: `Found reference with ${(result.score * 100).toFixed(1)}% similarity`
          });
        });

    } catch (error) {
      // 검색 오류는 무시하고 계속 진행
      continue;
    }
  }

  // 중복 제거
  const uniqueIndirectImpact = indirectImpact.filter((impact, index, arr) => 
    arr.findIndex(i => i.filePath === impact.filePath) === index
  );

  // 위험도 평가
  const riskFactors: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

  if (affectedFiles.length > 10) {
    riskFactors.push('Large number of directly affected files');
    riskLevel = 'medium';
  }

  if (uniqueIndirectImpact.length > 20) {
    riskFactors.push('Extensive indirect impact detected');
    riskLevel = 'high';
  }

  if (affectedFiles.some(f => f.includes('core') || f.includes('base') || f.includes('index'))) {
    riskFactors.push('Core system files affected');
    riskLevel = riskLevel === 'low' ? 'medium' : 'high';
  }

  if (changeDescription.toLowerCase().includes('breaking') || 
      changeDescription.toLowerCase().includes('major')) {
    riskFactors.push('Change described as breaking or major');
    riskLevel = 'critical';
  }

  // 완화 방안
  const mitigations: string[] = [];
  
  if (riskLevel !== 'low') {
    mitigations.push('Implement comprehensive testing before deployment');
    mitigations.push('Consider feature flags for gradual rollout');
    mitigations.push('Review with senior developers');
  }

  if (uniqueIndirectImpact.length > 0) {
    mitigations.push('Test all potentially affected files');
    mitigations.push('Update integration tests');
  }

  if (affectedFiles.some(f => f.includes('.test.') || f.includes('.spec.'))) {
    mitigations.push('Update test documentation');
  } else {
    mitigations.push('Add tests for the affected functionality');
  }

  // 제안사항
  const suggestions: string[] = [
    `Review all ${directImpact.length} directly affected files carefully`,
    `Consider impact on ${uniqueIndirectImpact.length} potentially related files`,
  ];

  if (analysisDepth !== 'basic') {
    suggestions.push('Perform static analysis to identify additional dependencies');
    suggestions.push('Review git history for related changes');
  }

  if (riskLevel === 'high' || riskLevel === 'critical') {
    suggestions.push('Plan for rollback strategy');
    suggestions.push('Coordinate with team leads before implementation');
  }

  return {
    summary: {
      totalAffectedFiles: affectedFiles.length + uniqueIndirectImpact.length,
      directImpactFiles: affectedFiles.length,
      indirectImpactFiles: uniqueIndirectImpact.length,
      riskLevel,
      confidence: uniqueIndirectImpact.length > 0 ? 
        uniqueIndirectImpact.reduce((sum, i) => sum + i.confidence, 0) / uniqueIndirectImpact.length : 
        0.8
    },
    directImpact,
    indirectImpact: uniqueIndirectImpact,
    riskAssessment: {
      level: riskLevel,
      factors: riskFactors,
      mitigations
    },
    suggestions
  };
}

/**
 * 영향도 분석 결과 포맷팅
 */
function formatImpactSummary(analysis: any): string {
  const { summary, directImpact, indirectImpact, riskAssessment } = analysis;
  
  let text = `# 📊 Impact Analysis Summary\n\n`;
  
  // 위험도 아이콘
  const riskIconMap: Record<string, string> = {
    'low': '🟢',
    'medium': '🟡',
    'high': '🟠',
    'critical': '🔴'
  };
  
  const riskIcon = riskIconMap[summary.riskLevel] || '⚪';
  text += `## ${riskIcon} Risk Level: ${summary.riskLevel.toUpperCase()}\n\n`;
  
  text += `### 📈 Impact Statistics\n`;
  text += `• **Total Files Affected**: ${summary.totalAffectedFiles}\n`;
  text += `• **Direct Impact**: ${summary.directImpactFiles} files\n`;
  text += `• **Indirect Impact**: ${summary.indirectImpactFiles} files\n`;
  text += `• **Analysis Confidence**: ${(summary.confidence * 100).toFixed(1)}%\n\n`;
  
  // 위험 요소
  if (riskAssessment.factors.length > 0) {
    text += `### ⚠️ Risk Factors\n`;
    riskAssessment.factors.forEach((factor: string) => {
      text += `• ${factor}\n`;
    });
    text += `\n`;
  }
  
  // 완화 방안
  if (riskAssessment.mitigations.length > 0) {
    text += `### 🛡️ Recommended Mitigations\n`;
    riskAssessment.mitigations.forEach((mitigation: string) => {
      text += `• ${mitigation}\n`;
    });
    text += `\n`;
  }
  
  return text;
}