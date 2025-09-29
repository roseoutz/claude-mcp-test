/**
 * Explain Feature Tool Handler
 * 특정 기능에 대한 설명을 제공
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ExplainFeatureInput } from '../types/mcp.js';
import { ElasticsearchVectorStore } from '../services/elasticsearch.service.js';
import { logger } from '../utils/logger.js';
import { 
  createTextResponse,
  createErrorResponse,
  createStructuredResponse,
  createCodeResponse
} from '../utils/mcp-formatter.js';

/**
 * 기능 설명 도구 핸들러
 */
export async function handleExplainFeature(args: ExplainFeatureInput): Promise<CallToolResult> {
  const toolLogger = logger.withContext('explain-feature');
  
  try {
    toolLogger.info('Starting feature explanation', args);

    // 입력 검증
    const validation = validateInput(args);
    if (!validation.isValid) {
      return createErrorResponse(`Invalid input: ${validation.errors.join(', ')}`);
    }

    const {
      featureId,
      includeCodeExamples = true,
      depth = 'basic',
      format = 'markdown'
    } = args;

    toolLogger.info(`Explaining feature: ${featureId}`);

    // 벡터 스토어에서 관련 정보 검색
    const vectorStore = new ElasticsearchVectorStore('feature-explanation');
    await vectorStore.initialize('feature-explanation');
    
    const searchResults = await vectorStore.search(featureId, 10, {
      // 기능 관련 메타데이터로 필터링할 수 있음
    });

    if (searchResults.length === 0) {
      return createTextResponse(
        `🔍 No information found for feature: "${featureId}"\n\n` +
        `This could mean:\n` +
        `• The feature doesn't exist in the analyzed codebase\n` +
        `• The codebase hasn't been learned yet (run learn_codebase first)\n` +
        `• The feature might be referred to by a different name\n\n` +
        `💡 **Suggestions:**\n` +
        `• Try searching with related keywords\n` +
        `• Use partial feature names\n` +
        `• Check for alternative naming conventions`
      );
    }

    // 검색 결과 분석 및 설명 생성
    const explanation = await generateFeatureExplanation(featureId, searchResults, {
      includeCodeExamples,
      depth,
      format
    });

    return explanation;

  } catch (error) {
    toolLogger.error('Failed to explain feature', error as Error);
    return createErrorResponse(error as Error);
  }
}

/**
 * 입력 검증
 */
function validateInput(args: ExplainFeatureInput): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!args.featureId || args.featureId.trim().length === 0) {
    errors.push('featureId is required');
  }

  if (args.featureId && args.featureId.length > 200) {
    errors.push('featureId is too long (max 200 characters)');
  }

  const validDepths = ['basic', 'detailed', 'comprehensive'];
  if (args.depth && !validDepths.includes(args.depth)) {
    errors.push(`depth must be one of: ${validDepths.join(', ')}`);
  }

  const validFormats = ['markdown', 'plain', 'json'];
  if (args.format && !validFormats.includes(args.format)) {
    errors.push(`format must be one of: ${validFormats.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 기능 설명 생성
 */
async function generateFeatureExplanation(
  featureId: string,
  searchResults: Array<{
    id: string;
    score: number;
    content: string;
    metadata: Record<string, any>;
  }>,
  options: {
    includeCodeExamples: boolean;
    depth: 'basic' | 'detailed' | 'comprehensive';
    format: 'markdown' | 'plain' | 'json';
  }
): Promise<CallToolResult> {
  
  // 검색 결과를 관련도순으로 정렬
  const sortedResults = searchResults
    .sort((a, b) => b.score - a.score)
    .slice(0, options.depth === 'comprehensive' ? 10 : options.depth === 'detailed' ? 5 : 3);

  // 파일별로 그룹화
  const fileGroups = new Map<string, Array<typeof sortedResults[0]>>();
  sortedResults.forEach(result => {
    const filePath = result.metadata.filePath || 'unknown';
    if (!fileGroups.has(filePath)) {
      fileGroups.set(filePath, []);
    }
    fileGroups.get(filePath)!.push(result);
  });

  // 언어별 통계
  const languageStats = new Map<string, number>();
  sortedResults.forEach(result => {
    const language = result.metadata.language || 'unknown';
    languageStats.set(language, (languageStats.get(language) || 0) + 1);
  });

  // 설명 텍스트 생성
  let explanation = `# 🔍 Feature Explanation: ${featureId}\n\n`;

  // 요약 정보
  explanation += `## 📊 Overview\n\n`;
  explanation += `• **Found in**: ${fileGroups.size} file(s)\n`;
  explanation += `• **Code segments**: ${sortedResults.length}\n`;
  explanation += `• **Primary languages**: ${Array.from(languageStats.keys()).join(', ')}\n`;
  explanation += `• **Relevance score**: ${(sortedResults[0]?.score * 100).toFixed(1)}%\n\n`;

  // 상세 설명 (depth에 따라)
  if (options.depth !== 'basic') {
    explanation += `## 📝 Description\n\n`;
    
    // 가장 관련성 높은 코드 세그먼트에서 설명 추출
    const topResult = sortedResults[0];
    explanation += `Based on the most relevant code segment found:\n\n`;
    explanation += `**File**: \`${topResult.metadata.filePath}\`\n`;
    explanation += `**Language**: ${topResult.metadata.language}\n\n`;
    
    // 컨텍스트 기반 설명
    if (topResult.content.length > 100) {
      explanation += `The feature appears to be related to:\n`;
      explanation += `\`\`\`\n${topResult.content.substring(0, 200)}...\n\`\`\`\n\n`;
    }
  }

  // 코드 예제
  if (options.includeCodeExamples) {
    explanation += `## 💻 Code Examples\n\n`;
    
    let exampleCount = 0;
    for (const [filePath, results] of fileGroups) {
      if (exampleCount >= (options.depth === 'comprehensive' ? 5 : 3)) break;
      
      const bestResult = results[0];
      explanation += `### Example ${exampleCount + 1}: \`${filePath}\`\n\n`;
      explanation += `**Relevance**: ${(bestResult.score * 100).toFixed(1)}%\n\n`;
      
      const language = bestResult.metadata.language || '';
      explanation += `\`\`\`${language}\n`;
      explanation += bestResult.content.length > 500 
        ? bestResult.content.substring(0, 500) + '\n// ... (truncated)'
        : bestResult.content;
      explanation += `\n\`\`\`\n\n`;
      
      exampleCount++;
    }
  }

  // 관련 파일들
  if (options.depth === 'comprehensive') {
    explanation += `## 📁 Related Files\n\n`;
    
    Array.from(fileGroups.keys()).forEach((filePath, index) => {
      const results = fileGroups.get(filePath)!;
      const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
      
      explanation += `${index + 1}. **\`${filePath}\`**\n`;
      explanation += `   - Language: ${results[0].metadata.language}\n`;
      explanation += `   - Relevance: ${(avgScore * 100).toFixed(1)}%\n`;
      explanation += `   - Segments: ${results.length}\n\n`;
    });
  }

  // 추천 사항
  explanation += `## 💡 Recommendations\n\n`;
  
  if (sortedResults[0]?.score < 0.5) {
    explanation += `⚠️ **Low relevance score detected**\n`;
    explanation += `The search results have low relevance. Consider:\n`;
    explanation += `• Using more specific keywords\n`;
    explanation += `• Checking feature name spelling\n`;
    explanation += `• Trying alternative search terms\n\n`;
  }

  explanation += `🔍 **For more information:**\n`;
  explanation += `• Review the complete files mentioned above\n`;
  explanation += `• Look for related functions or classes\n`;
  explanation += `• Check documentation or comments in the code\n`;

  // 포맷에 따른 반환
  if (options.format === 'json') {
    const jsonData = {
      featureId,
      overview: {
        filesFound: fileGroups.size,
        codeSegments: sortedResults.length,
        primaryLanguages: Array.from(languageStats.keys()),
        relevanceScore: sortedResults[0]?.score || 0
      },
      files: Array.from(fileGroups.keys()),
      examples: options.includeCodeExamples ? Array.from(fileGroups.values()).flat().map(r => ({
        filePath: r.metadata.filePath,
        language: r.metadata.language,
        content: r.content.substring(0, 200),
        score: r.score
      })) : [],
      timestamp: new Date().toISOString()
    };
    
    return createStructuredResponse(
      `Feature Analysis: ${featureId}`,
      jsonData
    );
  }

  return createTextResponse(explanation);
}

/**
 * TODO: AI 통합으로 더 나은 설명 생성
 * 실제 구현에서는 AI 서비스를 사용하여 더 자연스러운 설명을 생성할 수 있습니다.
 */

// 실제 AI 통합 예시 (주석 처리)
/*
async function generateAIExplanation(
  featureId: string,
  codeContext: string,
  options: any
): Promise<string> {
  const aiService = new OpenAIService();
  
  const prompt = `
    Explain the following feature in a codebase:
    
    Feature: ${featureId}
    
    Code context:
    ${codeContext}
    
    Please provide a ${options.depth} explanation including:
    - What this feature does
    - How it works
    - Where it's used
    - Any important dependencies or relationships
    
    Format the response in ${options.format}.
  `;
  
  const response = await aiService.generateText(prompt);
  return response;
}
*/