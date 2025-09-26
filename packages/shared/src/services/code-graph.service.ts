/**
 * Code Graph Analysis Service
 * 코드 간 관계를 그래프로 분석하여 메타데이터 생성
 *
 * @description
 * AST(Abstract Syntax Tree) 분석을 통해 클래스, 함수, 모듈 간의
 * 의존성, 상속, 호출 관계를 그래프 구조로 추출하고,
 * 이를 Elasticsearch 메타데이터로 저장하여 관계 기반 검색을 지원합니다.
 *
 * @graph_types
 * 1. Dependency Graph: import/require 관계
 * 2. Inheritance Graph: extends/implements 관계
 * 3. Call Graph: 함수/메서드 호출 관계
 * 4. Data Flow Graph: 변수/데이터 흐름 관계
 * 5. Composition Graph: 클래스 멤버/프로퍼티 관계
 *
 * @search_improvements
 * - 관련 클래스들을 함께 검색
 * - 의존성 체인을 따라 영향도 분석
 * - 아키텍처 패턴 기반 검색 (MVC, Observer 등)
 * - 호출 경로 추적으로 버그 원인 분석
 */

import * as ts from 'typescript';
import * as acorn from 'acorn';
import { logger } from '../utils/logger.js';

export interface CodeNode {
  id: string;
  name: string;
  type: 'class' | 'function' | 'interface' | 'module' | 'variable' | 'enum';
  filePath: string;
  lineStart: number;
  lineEnd: number;
  signature?: string;
  visibility: 'public' | 'private' | 'protected' | 'internal';
  isAbstract?: boolean;
  isStatic?: boolean;
  namespace?: string;
}

export interface CodeRelation {
  source: string; // Node ID
  target: string; // Node ID
  type: RelationType;
  weight?: number; // 관계 강도 (호출 빈도 등)
  metadata?: Record<string, any>;
}

export type RelationType =
  | 'extends'           // 클래스 상속
  | 'implements'        // 인터페이스 구현
  | 'imports'           // 모듈 임포트
  | 'calls'             // 함수/메서드 호출
  | 'uses'              // 변수/타입 사용
  | 'contains'          // 멤버/프로퍼티 포함
  | 'aggregates'        // 집합 관계
  | 'composes'          // 구성 관계
  | 'associates'        // 연관 관계
  | 'depends_on'        // 일반적 의존성
  | 'overrides'         // 메서드 오버라이드
  | 'decorates'         // 데코레이터 패턴
  | 'observes'          // 옵저버 패턴
  | 'throws'            // 예외 발생
  | 'catches';          // 예외 처리

export interface CodeGraph {
  nodes: Map<string, CodeNode>;
  relations: CodeRelation[];
  metrics: {
    totalNodes: number;
    totalRelations: number;
    avgDegree: number; // 평균 연결도
    maxDepth: number;  // 최대 의존성 깊이
    cycleCount: number; // 순환 의존성 개수
  };
}

export interface GraphMetadata {
  // 노드 정보
  nodeId: string;
  nodeType: string;
  signature: string;

  // 직접 관계 (1단계)
  directRelations: {
    incoming: Array<{ source: string; type: string; weight?: number }>;
    outgoing: Array<{ target: string; type: string; weight?: number }>;
  };

  // 간접 관계 (2-3단계)
  indirectRelations: {
    dependencies: string[];     // 의존하는 모든 노드
    dependents: string[];       // 이 노드에 의존하는 모든 노드
    siblings: string[];         // 같은 부모/네임스페이스의 노드들
    patterns: string[];         // 발견된 디자인 패턴
  };

  // 그래프 메트릭
  centrality: {
    degree: number;       // 연결된 노드 수
    betweenness: number;  // 중개 중심성 (다른 노드들 사이의 최단 경로상 위치)
    closeness: number;    // 근접 중심성 (다른 모든 노드까지의 거리)
    pagerank: number;     // PageRank 점수 (중요도)
  };

  // 클러스터 정보
  cluster: {
    id: string;           // 속한 클러스터 ID
    cohesion: number;     // 클러스터 응집도
    coupling: number;     // 외부 결합도
    role: 'core' | 'peripheral' | 'connector'; // 클러스터 내 역할
  };
}

/**
 * Code Graph Analysis Service
 * AST 분석을 통한 코드 관계 그래프 구축
 */
export class CodeGraphService {
  private graph: CodeGraph;
  private nodeIdCounter = 0;

  constructor() {
    this.graph = {
      nodes: new Map(),
      relations: [],
      metrics: {
        totalNodes: 0,
        totalRelations: 0,
        avgDegree: 0,
        maxDepth: 0,
        cycleCount: 0
      }
    };
  }

  /**
   * 파일들을 분석하여 코드 그래프 구축
   */
  async buildGraph(files: Array<{ path: string; content: string; language: string }>): Promise<CodeGraph> {
    logger.info(`Building code graph for ${files.length} files`);

    // 1. 각 파일에서 노드 추출
    for (const file of files) {
      await this.extractNodesFromFile(file);
    }

    // 2. 각 파일에서 관계 추출
    for (const file of files) {
      await this.extractRelationsFromFile(file);
    }

    // 3. 그래프 메트릭 계산
    this.calculateMetrics();

    logger.info(`Code graph built: ${this.graph.nodes.size} nodes, ${this.graph.relations.length} relations`);
    return this.graph;
  }

  /**
   * 파일에서 코드 노드 추출
   */
  private async extractNodesFromFile(file: { path: string; content: string; language: string }): Promise<void> {
    try {
      switch (file.language.toLowerCase()) {
        case 'typescript':
        case 'javascript':
          await this.extractTypeScriptNodes(file);
          break;
        case 'python':
          await this.extractPythonNodes(file);
          break;
        case 'java':
          await this.extractJavaNodes(file);
          break;
        default:
          logger.warn(`Unsupported language: ${file.language}`);
      }
    } catch (error) {
      logger.error(`Failed to extract nodes from ${file.path}:`, error as Error);
    }
  }

  /**
   * TypeScript/JavaScript AST 분석
   */
  private async extractTypeScriptNodes(file: { path: string; content: string }): Promise<void> {
    const sourceFile = ts.createSourceFile(
      file.path,
      file.content,
      ts.ScriptTarget.Latest,
      true
    );

    const extractNode = (node: ts.Node) => {
      const sourceFile = node.getSourceFile();
      const lineStart = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      const lineEnd = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;

      if (ts.isClassDeclaration(node) && node.name) {
        this.addNode({
          id: this.generateNodeId(),
          name: node.name.text,
          type: 'class',
          filePath: file.path,
          lineStart,
          lineEnd,
          signature: this.getClassSignature(node),
          visibility: this.getVisibility(node.modifiers),
          isAbstract: this.hasModifier(node.modifiers, ts.SyntaxKind.AbstractKeyword)
        });
      } else if (ts.isFunctionDeclaration(node) && node.name) {
        this.addNode({
          id: this.generateNodeId(),
          name: node.name.text,
          type: 'function',
          filePath: file.path,
          lineStart,
          lineEnd,
          signature: this.getFunctionSignature(node),
          visibility: this.getVisibility(node.modifiers),
          isStatic: this.hasModifier(node.modifiers, ts.SyntaxKind.StaticKeyword)
        });
      } else if (ts.isInterfaceDeclaration(node)) {
        this.addNode({
          id: this.generateNodeId(),
          name: node.name.text,
          type: 'interface',
          filePath: file.path,
          lineStart,
          lineEnd,
          signature: this.getInterfaceSignature(node),
          visibility: 'public'
        });
      } else if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
        this.addNode({
          id: this.generateNodeId(),
          name: node.name.text,
          type: 'function',
          filePath: file.path,
          lineStart,
          lineEnd,
          signature: this.getMethodSignature(node),
          visibility: this.getVisibility(node.modifiers),
          isStatic: this.hasModifier(node.modifiers, ts.SyntaxKind.StaticKeyword)
        });
      }

      ts.forEachChild(node, extractNode);
    };

    extractNode(sourceFile);
  }

  /**
   * Python AST 분석 (간단한 구현)
   */
  private async extractPythonNodes(file: { path: string; content: string }): Promise<void> {
    // Python AST 분석은 별도 라이브러리 필요
    // 여기서는 정규식 기반 간단 구현
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 클래스 정의 찾기
      const classMatch = line.match(/^class\s+(\w+)(?:\(([^)]*)\))?:/);
      if (classMatch) {
        this.addNode({
          id: this.generateNodeId(),
          name: classMatch[1],
          type: 'class',
          filePath: file.path,
          lineStart: i + 1,
          lineEnd: i + 1,
          signature: line,
          visibility: line.startsWith('_') ? 'private' : 'public'
        });
      }

      // 함수 정의 찾기
      const funcMatch = line.match(/^def\s+(\w+)\s*\([^)]*\):/);
      if (funcMatch) {
        this.addNode({
          id: this.generateNodeId(),
          name: funcMatch[1],
          type: 'function',
          filePath: file.path,
          lineStart: i + 1,
          lineEnd: i + 1,
          signature: line,
          visibility: line.startsWith('_') ? 'private' : 'public'
        });
      }
    }
  }

  /**
   * Java AST 분석 (간단한 구현)
   */
  private async extractJavaNodes(file: { path: string; content: string }): Promise<void> {
    // Java 파서 구현은 복잡하므로 정규식 기반 간단 구현
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 클래스 정의
      const classMatch = line.match(/(?:public|private|protected)?\s*(?:abstract|final)?\s*class\s+(\w+)/);
      if (classMatch) {
        this.addNode({
          id: this.generateNodeId(),
          name: classMatch[1],
          type: 'class',
          filePath: file.path,
          lineStart: i + 1,
          lineEnd: i + 1,
          signature: line,
          visibility: this.extractJavaVisibility(line),
          isAbstract: line.includes('abstract')
        });
      }

      // 메서드 정의
      const methodMatch = line.match(/(?:public|private|protected)\s+(?:static\s+)?(?:\w+\s+)*(\w+)\s*\([^)]*\)/);
      if (methodMatch && !line.includes('class')) {
        this.addNode({
          id: this.generateNodeId(),
          name: methodMatch[1],
          type: 'function',
          filePath: file.path,
          lineStart: i + 1,
          lineEnd: i + 1,
          signature: line,
          visibility: this.extractJavaVisibility(line),
          isStatic: line.includes('static')
        });
      }
    }
  }

  /**
   * 파일에서 관계 추출
   */
  private async extractRelationsFromFile(file: { path: string; content: string; language: string }): Promise<void> {
    try {
      switch (file.language.toLowerCase()) {
        case 'typescript':
        case 'javascript':
          await this.extractTypeScriptRelations(file);
          break;
        case 'python':
          await this.extractPythonRelations(file);
          break;
        case 'java':
          await this.extractJavaRelations(file);
          break;
      }
    } catch (error) {
      logger.error(`Failed to extract relations from ${file.path}:`, error as Error);
    }
  }

  /**
   * TypeScript/JavaScript 관계 추출
   */
  private async extractTypeScriptRelations(file: { path: string; content: string }): Promise<void> {
    const sourceFile = ts.createSourceFile(
      file.path,
      file.content,
      ts.ScriptTarget.Latest,
      true
    );

    const extractRelations = (node: ts.Node) => {
      // 상속 관계 (extends)
      if (ts.isClassDeclaration(node) && node.heritageClauses) {
        for (const heritageClause of node.heritageClauses) {
          if (heritageClause.token === ts.SyntaxKind.ExtendsKeyword) {
            for (const type of heritageClause.types) {
              if (ts.isIdentifier(type.expression)) {
                const sourceNode = this.findNodeByName(node.name?.text || '', file.path);
                const targetNode = this.findNodeByName(type.expression.text, file.path);
                if (sourceNode && targetNode) {
                  this.addRelation({
                    source: sourceNode.id,
                    target: targetNode.id,
                    type: 'extends',
                    weight: 1
                  });
                }
              }
            }
          }
        }
      }

      // 구현 관계 (implements)
      if (ts.isClassDeclaration(node) && node.heritageClauses) {
        for (const heritageClause of node.heritageClauses) {
          if (heritageClause.token === ts.SyntaxKind.ImplementsKeyword) {
            for (const type of heritageClause.types) {
              if (ts.isIdentifier(type.expression)) {
                const sourceNode = this.findNodeByName(node.name?.text || '', file.path);
                const targetNode = this.findNodeByName(type.expression.text, file.path);
                if (sourceNode && targetNode) {
                  this.addRelation({
                    source: sourceNode.id,
                    target: targetNode.id,
                    type: 'implements',
                    weight: 1
                  });
                }
              }
            }
          }
        }
      }

      // 함수 호출 관계
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        // 호출하는 함수와 호출되는 함수 간의 관계 설정
        // 복잡한 구현이 필요하므로 여기서는 기본 구조만 제시
      }

      // import 관계
      if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        // import 관계 추출
        const importPath = node.moduleSpecifier.text;
        // 모듈 의존성 관계 설정
      }

      ts.forEachChild(node, extractRelations);
    };

    extractRelations(sourceFile);
  }

  /**
   * Python 관계 추출
   */
  private async extractPythonRelations(file: { path: string; content: string }): Promise<void> {
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 상속 관계
      const classInheritMatch = line.match(/^class\s+(\w+)\s*\(([^)]+)\):/);
      if (classInheritMatch) {
        const className = classInheritMatch[1];
        const baseClasses = classInheritMatch[2].split(',').map(s => s.trim());

        for (const baseClass of baseClasses) {
          const sourceNode = this.findNodeByName(className, file.path);
          const targetNode = this.findNodeByName(baseClass, file.path);
          if (sourceNode && targetNode) {
            this.addRelation({
              source: sourceNode.id,
              target: targetNode.id,
              type: 'extends',
              weight: 1
            });
          }
        }
      }

      // import 관계
      const importMatch = line.match(/^(?:from\s+(\S+)\s+)?import\s+([^#]+)/);
      if (importMatch) {
        // import 관계 처리
      }
    }
  }

  /**
   * Java 관계 추출
   */
  private async extractJavaRelations(file: { path: string; content: string }): Promise<void> {
    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 상속 관계
      const extendsMatch = line.match(/class\s+(\w+)\s+extends\s+(\w+)/);
      if (extendsMatch) {
        const sourceNode = this.findNodeByName(extendsMatch[1], file.path);
        const targetNode = this.findNodeByName(extendsMatch[2], file.path);
        if (sourceNode && targetNode) {
          this.addRelation({
            source: sourceNode.id,
            target: targetNode.id,
            type: 'extends',
            weight: 1
          });
        }
      }

      // 구현 관계
      const implementsMatch = line.match(/class\s+(\w+)(?:\s+extends\s+\w+)?\s+implements\s+([^{]+)/);
      if (implementsMatch) {
        const className = implementsMatch[1];
        const interfaces = implementsMatch[2].split(',').map(s => s.trim());

        for (const interfaceName of interfaces) {
          const sourceNode = this.findNodeByName(className, file.path);
          const targetNode = this.findNodeByName(interfaceName, file.path);
          if (sourceNode && targetNode) {
            this.addRelation({
              source: sourceNode.id,
              target: targetNode.id,
              type: 'implements',
              weight: 1
            });
          }
        }
      }
    }
  }

  /**
   * 그래프 메타데이터 생성
   */
  generateGraphMetadata(nodeId: string): GraphMetadata | null {
    const node = this.graph.nodes.get(nodeId);
    if (!node) return null;

    const incomingRelations = this.graph.relations.filter(r => r.target === nodeId);
    const outgoingRelations = this.graph.relations.filter(r => r.source === nodeId);

    // 간접 관계 계산 (BFS로 2-3단계 관계 추출)
    const dependencies = this.findDependencies(nodeId, 3);
    const dependents = this.findDependents(nodeId, 3);
    const siblings = this.findSiblings(nodeId);

    // 중심성 계산
    const centrality = this.calculateCentrality(nodeId);

    // 클러스터 분석
    const cluster = this.analyzeCluster(nodeId);

    return {
      nodeId,
      nodeType: node.type,
      signature: node.signature || `${node.type} ${node.name}`,

      directRelations: {
        incoming: incomingRelations.map(r => ({
          source: r.source,
          type: r.type,
          weight: r.weight
        })),
        outgoing: outgoingRelations.map(r => ({
          target: r.target,
          type: r.type,
          weight: r.weight
        }))
      },

      indirectRelations: {
        dependencies,
        dependents,
        siblings,
        patterns: this.detectPatterns(nodeId)
      },

      centrality,
      cluster
    };
  }

  // Helper methods
  private generateNodeId(): string {
    return `node_${++this.nodeIdCounter}`;
  }

  private addNode(node: CodeNode): void {
    this.graph.nodes.set(node.id, node);
  }

  private addRelation(relation: CodeRelation): void {
    this.graph.relations.push(relation);
  }

  private findNodeByName(name: string, filePath?: string): CodeNode | undefined {
    for (const node of this.graph.nodes.values()) {
      if (node.name === name && (!filePath || node.filePath === filePath)) {
        return node;
      }
    }
    return undefined;
  }

  private getVisibility(modifiers?: ts.NodeArray<ts.ModifierLike>): 'public' | 'private' | 'protected' | 'internal' {
    if (!modifiers) return 'public';

    for (const modifier of modifiers) {
      if (modifier.kind === ts.SyntaxKind.PrivateKeyword) return 'private';
      if (modifier.kind === ts.SyntaxKind.ProtectedKeyword) return 'protected';
    }
    return 'public';
  }

  private hasModifier(modifiers: ts.NodeArray<ts.ModifierLike> | undefined, kind: ts.SyntaxKind): boolean {
    return modifiers?.some(m => m.kind === kind) ?? false;
  }

  private getClassSignature(node: ts.ClassDeclaration): string {
    return `class ${node.name?.text || 'Anonymous'}`;
  }

  private getFunctionSignature(node: ts.FunctionDeclaration): string {
    return `function ${node.name?.text || 'anonymous'}()`;
  }

  private getInterfaceSignature(node: ts.InterfaceDeclaration): string {
    return `interface ${node.name.text}`;
  }

  private getMethodSignature(node: ts.MethodDeclaration): string {
    return `method ${ts.isIdentifier(node.name) ? node.name.text : 'unknown'}()`;
  }

  private extractJavaVisibility(line: string): 'public' | 'private' | 'protected' | 'internal' {
    if (line.includes('private')) return 'private';
    if (line.includes('protected')) return 'protected';
    if (line.includes('public')) return 'public';
    return 'internal';
  }

  private calculateMetrics(): void {
    this.graph.metrics = {
      totalNodes: this.graph.nodes.size,
      totalRelations: this.graph.relations.length,
      avgDegree: this.graph.relations.length * 2 / this.graph.nodes.size,
      maxDepth: this.calculateMaxDepth(),
      cycleCount: this.detectCycles().length
    };
  }

  private calculateMaxDepth(): number {
    // DFS를 통한 최대 의존성 깊이 계산
    return 0; // 구현 필요
  }

  private detectCycles(): string[][] {
    // 순환 의존성 탐지
    return []; // 구현 필요
  }

  private findDependencies(nodeId: string, maxDepth: number): string[] {
    // BFS로 의존성 노드들 찾기
    return []; // 구현 필요
  }

  private findDependents(nodeId: string, maxDepth: number): string[] {
    // BFS로 종속 노드들 찾기
    return []; // 구현 필요
  }

  private findSiblings(nodeId: string): string[] {
    // 같은 네임스페이스/모듈의 형제 노드들
    return []; // 구현 필요
  }

  private calculateCentrality(nodeId: string) {
    // 그래프 중심성 메트릭 계산
    return {
      degree: 0,
      betweenness: 0,
      closeness: 0,
      pagerank: 0
    }; // 구현 필요
  }

  private analyzeCluster(nodeId: string) {
    // 클러스터 분석
    return {
      id: 'cluster_1',
      cohesion: 0,
      coupling: 0,
      role: 'core' as const
    }; // 구현 필요
  }

  private detectPatterns(nodeId: string): string[] {
    // 디자인 패턴 탐지
    return []; // 구현 필요
  }
}