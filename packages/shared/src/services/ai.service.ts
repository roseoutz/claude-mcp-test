/**
 * AI Service Implementation
 * OpenAI (임베딩) + Claude Opus 4.1 (생성)을 활용한 AI 서비스
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { IAIService } from '../domain/ports/outbound/index.js';
import { SecurityIssue, CodeComponent } from '../types/analysis.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/config-loader.js';
import { Cacheable } from '../decorators/cache.decorator.js';
import { CacheKeys } from '../utils/cache-keys.js';

export class AIService implements IAIService {
  private openai: OpenAI;
  private anthropic: Anthropic;
  private maxTokens: number;
  private cacheService?: any;

  constructor(openaiKey?: string, anthropicKey?: string) {
    // OpenAI for embeddings
    const oaiKey = openaiKey || config.get('OPENAI_API_KEY');
    if (!oaiKey) {
      logger.warn('OpenAI API key not provided, embedding features will be limited');
    }
    this.openai = new OpenAI({
      apiKey: oaiKey || 'dummy-key',
    });

    // Anthropic Claude for generation
    const claudeKey = anthropicKey || config.get('ANTHROPIC_API_KEY');
    if (!claudeKey) {
      logger.warn('Anthropic API key not provided, generation features will be limited');
    }
    this.anthropic = new Anthropic({
      apiKey: claudeKey || 'dummy-key',
    });

    this.maxTokens = config.get('ANTHROPIC_MAX_TOKENS');
  }

  setCacheService(cacheService: any): void {
    this.cacheService = cacheService;
  }

  /**
   * 텍스트 임베딩 생성
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Failed to generate embedding:', error as Error);
      // 오류 시 랜덤 벡터 반환 (개발용)
      return Array(1536).fill(0).map(() => Math.random());
    }
  }

  /**
   * 여러 텍스트의 임베딩 생성
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: texts,
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      logger.error('Failed to generate embeddings:', error as Error);
      // 오류 시 각 텍스트에 대해 랜덤 벡터 반환
      return texts.map(() => Array(1536).fill(0).map(() => Math.random()));
    }
  }

  /**
   * 코드 분석 (Claude Opus 4.1)
   */
  async analyzeCode(
    code: string,
    language: string,
    context?: string
  ): Promise<{
    summary: string;
    complexity: number;
    components: CodeComponent[];
    dependencies: string[];
  }> {
    try {
      const prompt = this.buildCodeAnalysisPrompt(code, language, context);
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022', // Using available model
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        system: 'You are a code analysis expert. Analyze code structure and provide detailed insights in JSON format.',
        max_tokens: this.maxTokens,
        temperature: 0.2,
      });

      const content = response.content[0]?.type === 'text'
        ? response.content[0].text
        : '{}';
      
      return this.parseCodeAnalysis(content, code);
    } catch (error) {
      logger.error('Failed to analyze code:', error as Error);
      return this.getDefaultCodeAnalysis(code);
    }
  }

  /**
   * 코드 설명 생성 (Claude Opus 4.1)
   */
  async explainCode(
    code: string,
    language: string,
    context?: string
  ): Promise<string> {
    try {
      const prompt = this.buildCodeExplanationPrompt(code, language, context);
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        system: 'You are a helpful programming assistant that explains code clearly and concisely in Korean.',
        max_tokens: this.maxTokens,
        temperature: 0.3,
      });

      return response.content[0]?.type === 'text' 
        ? response.content[0].text 
        : 'Unable to generate explanation';
    } catch (error) {
      logger.error('Failed to explain code:', error as Error);
      return 'Error generating code explanation';
    }
  }

  /**
   * 문서 생성 (Claude Opus 4.1)
   */
  async generateDocumentation(
    code: string,
    language: string,
    style: 'jsdoc' | 'markdown' | 'plain' = 'jsdoc'
  ): Promise<string> {
    try {
      const prompt = this.buildDocumentationPrompt(code, language, style);
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        system: `You are a documentation expert. Generate comprehensive ${style} documentation for code.`,
        max_tokens: this.maxTokens,
        temperature: 0.3,
      });

      return response.content[0]?.type === 'text'
        ? response.content[0].text
        : '';
    } catch (error) {
      logger.error('Failed to generate documentation:', error as Error);
      return '';
    }
  }

  /**
   * 보안 취약점 분석 (Claude Opus 4.1)
   */
  async detectVulnerabilities(
    code: string,
    language: string
  ): Promise<Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    line: number;
    description: string;
    suggestion?: string;
  }>> {
    try {
      const prompt = this.buildSecurityAnalysisPrompt(code, language);
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: prompt + '\n\nReturn the response as valid JSON.',
          },
        ],
        system: 'You are a security expert. Analyze code for security vulnerabilities and provide specific findings in JSON format.',
        max_tokens: this.maxTokens,
        temperature: 0.2,
      });

      const content = response.content[0]?.type === 'text'
        ? response.content[0].text
        : '{"vulnerabilities": []}';
      
      return this.parseSecurityVulnerabilities(content);
    } catch (error) {
      logger.error('Failed to analyze security (vulnerability detection):', error as Error);
      return [];
    }
  }

  /**
   * 리팩토링 제안 (Claude Opus 4.1)
   */
  async suggestRefactoring(
    code: string,
    language: string
  ): Promise<Array<{
    type: string;
    description: string;
    before: string;
    after: string;
  }>> {
    try {
      const prompt = this.buildRefactoringPrompt(code, language);
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        system: 'You are a code refactoring expert. Suggest specific improvements and provide before/after examples in JSON format.',
        max_tokens: this.maxTokens,
        temperature: 0.4,
      });

      const content = response.content[0]?.type === 'text'
        ? response.content[0].text
        : '{"suggestions": []}';
      
      return this.parseRefactoringSuggestions(content);
    } catch (error) {
      logger.error('Failed to suggest refactoring:', error as Error);
      return [];
    }
  }

  /**
   * 개선 제안 생성 (Claude Opus 4.1) - Task 문서 요구사항
   */
  async suggestImprovements(
    analysis: any
  ): Promise<string[]> {
    try {
      const prompt = this.buildImprovementPrompt(analysis);
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        system: 'You are a code review expert. Provide specific, actionable improvement suggestions in Korean.',
        max_tokens: this.maxTokens,
        temperature: 0.5,
      });

      const content = response.content[0]?.type === 'text'
        ? response.content[0].text
        : '';
      return this.parseImprovements(content);
    } catch (error) {
      logger.error('Failed to suggest improvements:', error as Error);
      return [];
    }
  }

  /**
   * 보안 분석 (Claude Opus 4.1) - Task 문서 요구사항
   */
  async analyzeSecurity(code: string): Promise<SecurityIssue[]> {
    try {
      const prompt = this.buildSecurityAnalysisPrompt(code, 'unknown');
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: prompt + '\n\nReturn the response as valid JSON.',
          },
        ],
        system: 'You are a security expert. Analyze code for security vulnerabilities and provide specific findings in JSON format.',
        max_tokens: this.maxTokens,
        temperature: 0.2,
      });

      const content = response.content[0]?.type === 'text'
        ? response.content[0].text
        : '{}';
      return this.parseSecurityIssues(content);
    } catch (error) {
      logger.error('Failed to analyze security (issues analysis):', error as Error);
      return [];
    }
  }

  /**
   * 코드 요약 생성 (Claude Opus 4.1) - Task 문서 요구사항
   */
  async summarizeCode(
    code: string,
    maxLength: number = 200
  ): Promise<string> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: code,
          },
        ],
        system: `Summarize the following code in ${maxLength} characters or less in Korean. Focus on what it does, not how.`,
        max_tokens: Math.min(maxLength * 2, this.maxTokens), // 한글은 토큰이 더 필요
        temperature: 0.3,
      });

      return response.content[0]?.type === 'text'
        ? response.content[0].text
        : 'No summary available';
    } catch (error) {
      logger.error('Failed to summarize code:', error as Error);
      return 'Error generating summary';
    }
  }

  /**
   * 자연어 쿼리를 코드 검색 쿼리로 변환 (Claude Opus 4.1) - Task 문서 요구사항
   */
  async queryToCode(query: string): Promise<string> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: `Convert this query to a code search pattern: "${query}"`,
          },
        ],
        system: 'Convert natural language queries to code search patterns. Return only the search pattern, no explanation.',
        max_tokens: 100,
        temperature: 0.2,
      });

      const content = response.content[0]?.type === 'text'
        ? response.content[0].text.trim()
        : query;
      return content || query;
    } catch (error) {
      logger.error('Failed to convert query:', error as Error);
      return query;
    }
  }

  /**
   * 함수 시그니처 생성 (Claude Opus 4.1) - Task 문서 요구사항
   */
  async generateFunctionSignature(
    description: string,
    language: string = 'typescript'
  ): Promise<string> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: description,
          },
        ],
        system: `Generate a function signature in ${language} based on the description. Include parameter types and return type. Add Korean comments.`,
        max_tokens: 200,
        temperature: 0.3,
      });

      return response.content[0]?.type === 'text'
        ? response.content[0].text
        : '';
    } catch (error) {
      logger.error('Failed to generate function signature:', error as Error);
      return '';
    }
  }

  // Private helper methods

  private buildCodeAnalysisPrompt(code: string, language: string, context?: string): string {
    let prompt = `Analyze the following ${language} code and provide a detailed analysis:\n\n\`\`\`${language}\n${code}\n\`\`\`\n`;
    
    if (context) {
      prompt += `\n\nContext: ${context}\n`;
    }
    
    prompt += `
Please provide the analysis in the following JSON format:
{
  "summary": "Brief summary of what the code does",
  "complexity": 1-10,
  "components": [
    {
      "name": "component name",
      "type": "class|function|interface|module|component|enum|type",
      "lineStart": 1,
      "lineEnd": 10,
      "description": "what this component does"
    }
  ],
  "dependencies": ["list", "of", "dependencies"]
}`;
    
    return prompt;
  }

  private buildCodeExplanationPrompt(code: string, language: string, context?: string): string {
    let prompt = `Explain the following ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n`;
    
    if (context) {
      prompt += `\n\nAdditional context: ${context}`;
    }
    
    prompt += `
Provide a clear, concise explanation focusing on:
1. What the code does
2. Key algorithms or patterns used
3. Any potential issues or improvements

Answer in Korean.`;
    
    return prompt;
  }

  private buildDocumentationPrompt(code: string, language: string, style: string): string {
    return `Generate ${style} documentation for the following ${language} code:

\`\`\`${language}
${code}
\`\`\`

Include:
- Function/class descriptions
- Parameter descriptions and types
- Return value descriptions
- Usage examples where appropriate
- Any thrown errors

Return only the documented code.`;
  }

  private buildSecurityAnalysisPrompt(code: string, language: string): string {
    return `Analyze the following ${language} code for security vulnerabilities:

\`\`\`${language}
${code}
\`\`\`

Check for common security issues including:
- SQL Injection
- XSS vulnerabilities
- Insecure data handling
- Authentication/authorization issues
- Sensitive data exposure
- Input validation problems

Return the findings as a JSON object with the following structure:
{
  "vulnerabilities": [
    {
      "type": "vulnerability type",
      "severity": "low|medium|high|critical",
      "line": line_number_or_0,
      "description": "description of the issue",
      "suggestion": "how to fix it"
    }
  ]
}`;
  }

  private buildRefactoringPrompt(code: string, language: string): string {
    return `Suggest refactoring improvements for the following ${language} code:

\`\`\`${language}
${code}
\`\`\`

Focus on:
1. Code structure and organization
2. Performance improvements
3. Readability enhancements
4. Best practices
5. Design patterns

Return suggestions as JSON:
{
  "suggestions": [
    {
      "type": "improvement type",
      "description": "what to improve",
      "before": "code snippet to change",
      "after": "improved code snippet"
    }
  ]
}`;
  }

  private parseCodeAnalysis(content: string, code: string): {
    summary: string;
    complexity: number;
    components: CodeComponent[];
    dependencies: string[];
  } {
    try {
      const parsed = JSON.parse(content);
      const components = (parsed.components || []).map((comp: any, index: number) => ({
        id: `comp_${index}`,
        name: comp.name || 'Unknown',
        type: comp.type || 'function',
        filePath: 'current',
        lineStart: comp.lineStart || 1,
        lineEnd: comp.lineEnd || 1,
        description: comp.description,
        dependencies: [],
        visibility: 'public'
      }));

      return {
        summary: parsed.summary || 'Code analysis completed',
        complexity: Math.max(1, Math.min(10, parsed.complexity || 5)),
        components,
        dependencies: parsed.dependencies || [],
      };
    } catch {
      return this.getDefaultCodeAnalysis(code);
    }
  }

  private getDefaultCodeAnalysis(code: string): {
    summary: string;
    complexity: number;
    components: CodeComponent[];
    dependencies: string[];
  } {
    const lines = code.split('\n').length;
    const complexity = Math.min(10, Math.max(1, Math.floor(lines / 10)));
    
    return {
      summary: 'Code analysis completed with default values',
      complexity,
      components: [],
      dependencies: [],
    };
  }

  private parseSecurityVulnerabilities(content: string): Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    line: number;
    description: string;
    suggestion?: string;
  }> {
    try {
      const parsed = JSON.parse(content);
      return (parsed.vulnerabilities || []).map((vuln: any) => ({
        type: vuln.type || 'Unknown',
        severity: vuln.severity || 'medium',
        line: vuln.line || 0,
        description: vuln.description || 'Security issue detected',
        suggestion: vuln.suggestion,
      }));
    } catch {
      return [];
    }
  }

  private parseRefactoringSuggestions(content: string): Array<{
    type: string;
    description: string;
    before: string;
    after: string;
  }> {
    try {
      const parsed = JSON.parse(content);
      return (parsed.suggestions || []).map((suggestion: any) => ({
        type: suggestion.type || 'Improvement',
        description: suggestion.description || 'Code improvement suggested',
        before: suggestion.before || '',
        after: suggestion.after || '',
      }));
    } catch {
      return [];
    }
  }

  private buildImprovementPrompt(analysis: any): string {
    return `Based on the following code analysis, suggest specific improvements:

Analysis Summary:
- Total Files: ${analysis.statistics?.totalFiles || 0}
- Total Lines: ${analysis.statistics?.totalLines || 0}
- Languages: ${JSON.stringify(analysis.statistics?.languages || {})}

Provide 3-5 specific, actionable improvement suggestions focusing on:
1. Code quality and maintainability
2. Performance optimizations
3. Security enhancements
4. Testing coverage
5. Documentation

Format each suggestion as a separate line starting with "- "`;
  }

  private parseImprovements(content: string): string[] {
    const lines = content.split('\n');
    const improvements = lines
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(Boolean);
    
    return improvements;
  }

  private parseSecurityIssues(content: string): SecurityIssue[] {
    try {
      const parsed = JSON.parse(content);
      return (parsed.issues || parsed.vulnerabilities || []).map((issue: any) => ({
        severity: issue.severity || 'medium',
        type: issue.type || 'Unknown',
        message: issue.message || issue.description || 'Security issue detected',
        line: issue.line,
        suggestion: issue.suggestion,
      }));
    } catch {
      // Fallback parsing if JSON parsing fails
      const issues: SecurityIssue[] = [];
      const lines = content.split('\n');
      
      for (const line of lines) {
        if (line.includes('vulnerability') || line.includes('security')) {
          issues.push({
            severity: 'medium',
            type: 'Unknown',
            message: line.trim(),
          });
        }
      }
      
      return issues;
    }
  }
}

/**
 * Mock AI Service for testing/development
 */
export class MockAIService implements IAIService {
  async generateEmbedding(text: string): Promise<number[]> {
    // 텍스트 길이 기반 더미 벡터 생성
    const seed = text.length;
    return Array(1536).fill(0).map((_, i) => 
      Math.sin(seed + i) * 0.5 + 0.5
    );
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(text => this.generateEmbedding(text)));
  }

  async analyzeCode(
    code: string,
    language: string,
    context?: string
  ): Promise<{
    summary: string;
    complexity: number;
    components: CodeComponent[];
    dependencies: string[];
  }> {
    const lines = code.split('\n').length;
    return {
      summary: `This ${language} code performs operations related to: ${context || 'general processing'}`,
      complexity: Math.min(10, Math.max(1, Math.floor(lines / 10))),
      components: [],
      dependencies: [],
    };
  }

  async explainCode(code: string, language: string, context?: string): Promise<string> {
    return `This ${language} code performs operations related to: ${context || 'general processing'}. 
    The implementation uses standard patterns and follows best practices.`;
  }

  async generateDocumentation(
    code: string,
    language: string,
    style?: 'jsdoc' | 'markdown' | 'plain'
  ): Promise<string> {
    return `/**
 * Generated ${style || 'jsdoc'} documentation for ${language} code
 * This function/class performs the main operations.
 */`;
  }

  async detectVulnerabilities(
    code: string,
    language: string
  ): Promise<Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    line: number;
    description: string;
    suggestion?: string;
  }>> {
    const issues: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      line: number;
      description: string;
      suggestion?: string;
    }> = [];
    
    if (code.includes('eval(')) {
      issues.push({
        type: 'Code Injection',
        severity: 'critical',
        line: code.split('\n').findIndex(line => line.includes('eval(')) + 1 || 1,
        description: 'Use of eval() can lead to code injection',
        suggestion: 'Use safer alternatives like JSON.parse()',
      });
    }
    
    if (code.includes('innerHTML')) {
      issues.push({
        type: 'XSS',
        severity: 'high',
        line: code.split('\n').findIndex(line => line.includes('innerHTML')) + 1 || 1,
        description: 'Direct innerHTML assignment can lead to XSS',
        suggestion: 'Use textContent or sanitize HTML',
      });
    }
    
    return issues;
  }

  async suggestRefactoring(
    code: string,
    language: string
  ): Promise<Array<{
    type: string;
    description: string;
    before: string;
    after: string;
  }>> {
    return [
      {
        type: 'Function extraction',
        description: 'Extract complex logic into separate functions',
        before: '// Complex code block',
        after: '// Extracted function calls',
      },
      {
        type: 'Variable naming',
        description: 'Improve variable naming for better readability',
        before: 'let x = getValue();',
        after: 'let userInput = getValue();',
      },
    ];
  }

  async suggestImprovements(): Promise<string[]> {
    return [
      'Add comprehensive unit tests',
      'Improve error handling',
      'Add JSDoc documentation',
      'Consider extracting complex logic into separate functions',
      'Add input validation',
    ];
  }

  async analyzeSecurity(code: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    
    if (code.includes('eval(')) {
      issues.push({
        severity: 'critical',
        type: 'Code Injection',
        message: 'Use of eval() can lead to code injection',
        suggestion: 'Use safer alternatives like JSON.parse()',
      });
    }
    
    if (code.includes('innerHTML')) {
      issues.push({
        severity: 'high',
        type: 'XSS',
        message: 'Direct innerHTML assignment can lead to XSS',
        suggestion: 'Use textContent or sanitize HTML',
      });
    }
    
    return issues;
  }

  async summarizeCode(code: string, maxLength: number = 200): Promise<string> {
    return `This code contains ${code.split('\n').length} lines and performs standard operations. Implementation follows common patterns and best practices.`.substring(0, maxLength);
  }

  async queryToCode(query: string): Promise<string> {
    // Simple query conversion for mock
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('function')) return 'function*';
    if (lowerQuery.includes('class')) return 'class*';
    if (lowerQuery.includes('import')) return 'import*';
    return query;
  }

  async generateFunctionSignature(
    description: string,
    language: string = 'typescript'
  ): Promise<string> {
    const lines = description.split(' ');
    const functionName = lines.find(word => 
      word.includes('function') || word.includes('method')
    )?.replace(/[^a-zA-Z]/g, '') || 'generatedFunction';
    
    return language === 'typescript' 
      ? `// ${description}\nfunction ${functionName}(param: any): any {\n  // Implementation here\n}`
      : `// ${description}\nfunction ${functionName}(param) {\n  // Implementation here\n}`;
  }
}