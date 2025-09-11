/**
 * Domain Entities
 * 비즈니스 로직의 핵심 개념을 표현하는 엔티티
 */

import type { 
  CodeComponent, 
  FileAnalysis, 
  CodebaseAnalysis,
  ImpactAnalysis 
} from '../../types/analysis.js';
import type { Repository, CommitInfo } from '../../types/git.js';

/**
 * 코드베이스 세션 엔티티
 */
export class CodebaseSession {
  private _id: string;
  private _repository: Repository;
  private _analysis?: CodebaseAnalysis;
  private _startedAt: Date;
  private _endedAt?: Date;
  private _metadata: Map<string, any>;

  constructor(
    id: string,
    repository: Repository,
    metadata?: Record<string, any>
  ) {
    this._id = id;
    this._repository = repository;
    this._startedAt = new Date();
    this._metadata = new Map(Object.entries(metadata || {}));
  }

  get id(): string {
    return this._id;
  }

  get repository(): Repository {
    return this._repository;
  }

  get analysis(): CodebaseAnalysis | undefined {
    return this._analysis;
  }

  get isActive(): boolean {
    return !this._endedAt;
  }

  get duration(): number {
    const end = this._endedAt || new Date();
    return end.getTime() - this._startedAt.getTime();
  }

  setAnalysis(analysis: CodebaseAnalysis): void {
    this._analysis = analysis;
  }

  addMetadata(key: string, value: any): void {
    this._metadata.set(key, value);
  }

  getMetadata(key: string): any {
    return this._metadata.get(key);
  }

  end(): void {
    if (this._endedAt) {
      throw new Error('Session already ended');
    }
    this._endedAt = new Date();
  }

  toJSON() {
    return {
      id: this._id,
      repository: this._repository,
      analysis: this._analysis,
      startedAt: this._startedAt,
      endedAt: this._endedAt,
      metadata: Object.fromEntries(this._metadata),
    };
  }
}

/**
 * 코드 검색 결과 엔티티
 */
export class SearchResult {
  constructor(
    public readonly filePath: string,
    public readonly lineNumber: number,
    public readonly snippet: string,
    public readonly relevance: number,
    public readonly context?: {
      before: string[];
      after: string[];
    }
  ) {}

  get isHighlyRelevant(): boolean {
    return this.relevance > 0.8;
  }

  get isModeratelyRelevant(): boolean {
    return this.relevance > 0.5 && this.relevance <= 0.8;
  }

  formatSnippet(maxLength: number = 200): string {
    if (this.snippet.length <= maxLength) {
      return this.snippet;
    }
    return this.snippet.substring(0, maxLength - 3) + '...';
  }
}

/**
 * 기능 설명 엔티티
 */
export class FeatureExplanation {
  private _examples: Array<{
    filePath: string;
    snippet: string;
    description: string;
  }> = [];

  constructor(
    public readonly featureId: string,
    public readonly explanation: string,
    public readonly createdAt: Date = new Date()
  ) {}

  addExample(
    filePath: string,
    snippet: string,
    description: string
  ): void {
    this._examples.push({ filePath, snippet, description });
  }

  get examples() {
    return [...this._examples];
  }

  get hasExamples(): boolean {
    return this._examples.length > 0;
  }

  toMarkdown(): string {
    let markdown = `## ${this.featureId}\n\n`;
    markdown += `${this.explanation}\n\n`;
    
    if (this.hasExamples) {
      markdown += '### Code Examples\n\n';
      this._examples.forEach((example, index) => {
        markdown += `#### Example ${index + 1}: ${example.filePath}\n\n`;
        markdown += `${example.description}\n\n`;
        markdown += '```\n' + example.snippet + '\n```\n\n';
      });
    }
    
    return markdown;
  }
}

/**
 * 브랜치 비교 엔티티
 */
export class BranchComparison {
  constructor(
    public readonly baseBranch: string,
    public readonly targetBranch: string,
    public readonly commits: CommitInfo[],
    public readonly filesChanged: number,
    public readonly additions: number,
    public readonly deletions: number
  ) {}

  get totalChanges(): number {
    return this.additions + this.deletions;
  }

  get changeRatio(): number {
    if (this.totalChanges === 0) return 0;
    return this.additions / this.totalChanges;
  }

  get isLargeChange(): boolean {
    return this.totalChanges > 500 || this.filesChanged > 20;
  }

  get isMergeCandidate(): boolean {
    return !this.isLargeChange && this.commits.length < 10;
  }

  getStatsSummary(): string {
    return `${this.commits.length} commits, ${this.filesChanged} files changed, +${this.additions} -${this.deletions}`;
  }
}

/**
 * 영향도 분석 결과 엔티티
 */
export class ImpactAssessment {
  private _risks: Array<{
    level: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    mitigation?: string;
  }> = [];

  constructor(
    public readonly analysis: ImpactAnalysis,
    public readonly timestamp: Date = new Date()
  ) {}

  addRisk(
    level: 'low' | 'medium' | 'high' | 'critical',
    description: string,
    mitigation?: string
  ): void {
    this._risks.push({ level, description, mitigation });
  }

  get risks() {
    return [...this._risks];
  }

  get overallRiskLevel(): 'low' | 'medium' | 'high' | 'critical' {
    if (this._risks.some(r => r.level === 'critical')) return 'critical';
    if (this._risks.some(r => r.level === 'high')) return 'high';
    if (this._risks.some(r => r.level === 'medium')) return 'medium';
    return 'low';
  }

  get hasCriticalRisks(): boolean {
    return this._risks.some(r => r.level === 'critical');
  }

  get requiresReview(): boolean {
    return this.overallRiskLevel !== 'low';
  }

  generateReport(): string {
    let report = '# Impact Assessment Report\n\n';
    report += `Generated: ${this.timestamp.toISOString()}\n\n`;
    
    report += '## Summary\n';
    report += `- Direct Impact: ${this.analysis.directImpact.length} files\n`;
    report += `- Indirect Impact: ${this.analysis.indirectImpact.length} files\n`;
    report += `- Overall Risk Level: ${this.overallRiskLevel}\n\n`;
    
    if (this._risks.length > 0) {
      report += '## Risks\n';
      this._risks.forEach(risk => {
        report += `- **${risk.level.toUpperCase()}**: ${risk.description}\n`;
        if (risk.mitigation) {
          report += `  - Mitigation: ${risk.mitigation}\n`;
        }
      });
    }
    
    return report;
  }
}

/**
 * 채팅 메시지 엔티티
 */
export class ChatMessage {
  constructor(
    public readonly id: string,
    public readonly sessionId: string,
    public readonly role: 'user' | 'assistant' | 'system',
    public readonly content: string,
    public readonly timestamp: Date = new Date(),
    public readonly references: Array<{
      filePath: string;
      lineNumber: number;
      snippet: string;
    }> = []
  ) {}

  get hasReferences(): boolean {
    return this.references.length > 0;
  }

  get isUserMessage(): boolean {
    return this.role === 'user';
  }

  get isAssistantMessage(): boolean {
    return this.role === 'assistant';
  }

  formatForDisplay(): string {
    let formatted = `[${this.role}]: ${this.content}`;
    
    if (this.hasReferences) {
      formatted += '\n\nReferences:';
      this.references.forEach(ref => {
        formatted += `\n- ${ref.filePath}:${ref.lineNumber}`;
      });
    }
    
    return formatted;
  }
}

/**
 * 코드 컴포넌트 그래프 엔티티
 */
export class ComponentGraph {
  private _nodes: Map<string, CodeComponent> = new Map();
  private _edges: Map<string, Set<string>> = new Map();

  addComponent(component: CodeComponent): void {
    this._nodes.set(component.id, component);
    if (!this._edges.has(component.id)) {
      this._edges.set(component.id, new Set());
    }
  }

  addDependency(fromId: string, toId: string): void {
    if (!this._edges.has(fromId)) {
      this._edges.set(fromId, new Set());
    }
    this._edges.get(fromId)!.add(toId);
  }

  getComponent(id: string): CodeComponent | undefined {
    return this._nodes.get(id);
  }

  getDependencies(id: string): string[] {
    return Array.from(this._edges.get(id) || []);
  }

  getDependents(id: string): string[] {
    const dependents: string[] = [];
    for (const [nodeId, dependencies] of this._edges) {
      if (dependencies.has(id)) {
        dependents.push(nodeId);
      }
    }
    return dependents;
  }

  get components(): CodeComponent[] {
    return Array.from(this._nodes.values());
  }

  get size(): number {
    return this._nodes.size;
  }

  findCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const dependencies = this._edges.get(nodeId) || new Set();
      for (const depId of dependencies) {
        if (!visited.has(depId)) {
          dfs(depId);
        } else if (recursionStack.has(depId)) {
          const cycleStart = path.indexOf(depId);
          cycles.push(path.slice(cycleStart));
        }
      }

      path.pop();
      recursionStack.delete(nodeId);
    };

    for (const nodeId of this._nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }
}