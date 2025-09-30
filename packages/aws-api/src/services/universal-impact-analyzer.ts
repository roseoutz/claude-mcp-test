/**
 * 범용 영향도 분석 서비스
 * Java/Kotlin Spring Boot 서버를 위한 메타데이터 강화 임베딩 분석
 * 특정 도메인에 종속되지 않은 범용적 구현
 */

import OpenAI from 'openai';

export interface UniversalCodeMetadata {
  // 기본 구조 정보
  fileName: string;
  filePath: string;
  language: 'java' | 'kotlin' | 'python' | 'typescript' | 'javascript' | 'unknown';
  className?: string;
  packageName?: string;
  moduleName?: string;  // Python/TypeScript modules

  // 코드 구조 분석
  structure: {
    isInterface: boolean;
    isAbstract: boolean;
    isImplementation: boolean;
    isController: boolean;  // Spring/Express/FastAPI controller
    isService: boolean;      // Business logic layer
    isRepository: boolean;   // Data access layer
    isConfiguration: boolean;
    isEntity: boolean;       // DB Entity/Model
    isDto: boolean;          // DTO/Schema/Type
    isTest: boolean;         // Test file
    isUtility: boolean;      // Utility/Helper
  };

  // Framework 특성
  frameworkFeatures: {
    // Spring Boot (Java/Kotlin)
    springAnnotations?: string[];
    // Python frameworks
    pythonDecorators?: string[];
    // TypeScript/JavaScript
    tsDecorators?: string[];
    nodeExports?: string[];
  };

  restEndpoints: string[];
  injectedDependencies: string[];

  // 메서드 분석
  methods: {
    name: string;
    returnType?: string;
    parameters?: string[];
    annotations?: string[];
  }[];

  // 복잡도 메트릭
  metrics: {
    lineCount: number;
    methodCount: number;
    cyclomaticComplexity: number;
    dependencyCount: number;
  };

  // 의미적 특성 (임베딩 기반)
  semanticFeatures?: {
    architecturalImportance: number;  // 0-1
    codeComplexity: number;  // 0-1
    integrationLevel: number;  // 0-1 (얼마나 많은 컴포넌트와 연결되어 있는지)
  };
}

export interface ImpactAnalysisRequest {
  query: string;
  codebasePath?: string;
  maxResults?: number;
  filters?: {
    languages?: string[];
    layers?: string[];
    minSimilarity?: number;
  };
}

export interface ImpactAnalysisResult {
  file: string;
  similarity: number;
  metadata: UniversalCodeMetadata;
  impactLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning?: string;
}

export class UniversalImpactAnalyzer {
  private openai: OpenAI;
  private embeddingCache: Map<string, number[]> = new Map();

  constructor(apiKey?: string) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY || 'test-key'
    });
  }

  /**
   * 코드 파일에서 범용 메타데이터 추출
   */
  extractMetadata(filePath: string, content: string): UniversalCodeMetadata {
    const language = this.detectLanguage(filePath, content);

    const metadata: UniversalCodeMetadata = {
      fileName: filePath.split('/').pop() || '',
      filePath,
      language,
      className: this.extractClassName(content, language),
      packageName: this.extractPackageName(content, language),
      moduleName: this.extractModuleName(filePath, content, language),

      structure: {
        isInterface: this.isInterface(content, language),
        isAbstract: this.isAbstractClass(content, language),
        isImplementation: this.isImplementation(filePath, content, language),
        isController: this.isController(content, language),
        isService: this.isService(filePath, content, language),
        isRepository: this.isRepository(filePath, content, language),
        isConfiguration: this.isConfiguration(content, language),
        isEntity: this.isEntity(content, language),
        isDto: this.isDataTransferObject(filePath, content, language),
        isTest: this.isTestFile(filePath, content),
        isUtility: this.isUtilityFile(filePath, content),
      },

      frameworkFeatures: {
        springAnnotations: language === 'java' || language === 'kotlin' ?
          this.extractSpringAnnotations(content) : undefined,
        pythonDecorators: language === 'python' ?
          this.extractPythonDecorators(content) : undefined,
        tsDecorators: language === 'typescript' ?
          this.extractTypeScriptDecorators(content) : undefined,
        nodeExports: (language === 'typescript' || language === 'javascript') ?
          this.extractNodeExports(content) : undefined,
      },

      restEndpoints: this.extractRestEndpoints(content, language),
      injectedDependencies: this.extractInjectedDependencies(content, language),

      methods: this.extractMethodInfo(content, language),

      metrics: {
        lineCount: content.split('\n').length,
        methodCount: this.countMethods(content, language),
        cyclomaticComplexity: this.calculateCyclomaticComplexity(content),
        dependencyCount: this.countDependencies(content),
      },

      semanticFeatures: {
        architecturalImportance: this.calculateArchitecturalImportance(filePath, content),
        codeComplexity: this.calculateNormalizedComplexity(content),
        integrationLevel: this.calculateIntegrationLevel(content),
      }
    };

    return metadata;
  }

  /**
   * 의미적으로 강화된 텍스트 생성
   */
  createEnhancedEmbeddingText(code: string, metadata: UniversalCodeMetadata): string {
    return `
## File Context
Language: ${metadata.language}
Package: ${metadata.packageName || 'default'}
Class: ${metadata.className || 'Anonymous'}

## Architectural Role
${this.describeArchitecturalRole(metadata)}

## Code Characteristics
- Lines of Code: ${metadata.metrics.lineCount}
- Method Count: ${metadata.metrics.methodCount}
- Cyclomatic Complexity: ${metadata.metrics.cyclomaticComplexity}
- Dependencies: ${metadata.metrics.dependencyCount}
- Integration Level: ${(metadata.semanticFeatures?.integrationLevel ?? 0 * 100).toFixed(1)}%

## Framework Features
${metadata.frameworkFeatures?.springAnnotations?.length ?
  `Spring Annotations: ${metadata.frameworkFeatures.springAnnotations.join(', ')}` :
  metadata.frameworkFeatures?.pythonDecorators?.length ?
  `Python Decorators: ${metadata.frameworkFeatures.pythonDecorators.join(', ')}` :
  metadata.frameworkFeatures?.tsDecorators?.length ?
  `TypeScript Decorators: ${metadata.frameworkFeatures.tsDecorators.join(', ')}` :
  'No framework-specific features'}
${metadata.restEndpoints.length > 0 ?
  `\nREST Endpoints:\n${metadata.restEndpoints.map(e => `  - ${e}`).join('\n')}` :
  ''}

## Method Signatures
${metadata.methods.slice(0, 10).map(m =>
  `- ${m.name}(${m.parameters?.join(', ') || ''}): ${m.returnType || 'void'}`
).join('\n')}

## Code Summary
${code.substring(0, 2000)}
`;
  }

  /**
   * 영향도 분석 수행
   */
  async analyzeImpact(
    request: ImpactAnalysisRequest,
    codebase: Array<{content: string, path: string}>
  ): Promise<ImpactAnalysisResult[]> {
    // 1. 쿼리 임베딩 생성
    const queryEmbedding = await this.generateEmbedding(request.query);

    // 2. 각 파일 분석
    const results: ImpactAnalysisResult[] = [];

    for (const file of codebase) {
      const metadata = this.extractMetadata(file.path, file.content);

      // 필터링 적용
      if (request.filters) {
        if (request.filters.languages &&
            !request.filters.languages.includes(metadata.language)) {
          continue;
        }
      }

      // 강화된 텍스트로 임베딩 생성
      const enhancedText = this.createEnhancedEmbeddingText(file.content, metadata);
      const fileEmbedding = await this.generateEmbedding(enhancedText);

      // 유사도 계산
      const similarity = this.cosineSimilarity(queryEmbedding, fileEmbedding);

      // 의미적 가중치 적용
      const adjustedSimilarity = this.applySemanticWeights(similarity, metadata);

      if (!request.filters?.minSimilarity || adjustedSimilarity >= request.filters.minSimilarity) {
        results.push({
          file: file.path,
          similarity: adjustedSimilarity,
          metadata,
          impactLevel: this.determineImpactLevel(adjustedSimilarity, metadata),
        });
      }
    }

    // 정렬 및 제한
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, request.maxResults || 15);
  }

  // === 유틸리티 메서드 ===

  private detectLanguage(filePath: string, content: string): 'java' | 'kotlin' | 'python' | 'typescript' | 'javascript' | 'unknown' {
    // 파일 확장자 기반
    if (filePath.endsWith('.java')) return 'java';
    if (filePath.endsWith('.kt') || filePath.endsWith('.kts')) return 'kotlin';
    if (filePath.endsWith('.py')) return 'python';
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) return 'typescript';
    if (filePath.endsWith('.js') || filePath.endsWith('.jsx') || filePath.endsWith('.mjs')) return 'javascript';

    // 내용 기반 감지
    if (content.includes('public class') || content.includes('import java.')) return 'java';
    if (content.includes('fun ') || content.includes('val ') || content.includes('var ')) return 'kotlin';
    if (content.includes('def ') || content.includes('import ') || content.includes('from ')) return 'python';
    if (content.includes('interface ') || content.includes(': string') || content.includes(': number')) return 'typescript';
    if (content.includes('const ') || content.includes('let ') || content.includes('function ')) return 'javascript';

    return 'unknown';
  }

  private extractClassName(content: string, language: string): string | undefined {
    if (language === 'java') {
      const match = content.match(/(?:public\s+)?(?:class|interface|enum)\s+(\w+)/);
      return match?.[1];
    }
    if (language === 'kotlin') {
      const match = content.match(/(?:class|interface|object|enum\s+class)\s+(\w+)/);
      return match?.[1];
    }
    if (language === 'python') {
      const match = content.match(/class\s+(\w+)/);
      return match?.[1];
    }
    if (language === 'typescript' || language === 'javascript') {
      const match = content.match(/(?:export\s+)?(?:class|interface)\s+(\w+)/);
      return match?.[1];
    }
    return undefined;
  }

  private extractPackageName(content: string, language: string): string | undefined {
    if (language === 'java' || language === 'kotlin') {
      const match = content.match(/package\s+([^;\s]+)/);
      return match?.[1];
    }
    return undefined;
  }

  private extractModuleName(filePath: string, content: string, language: string): string | undefined {
    if (language === 'python') {
      // Python module is usually the file name without .py
      return filePath.split('/').pop()?.replace('.py', '');
    }
    if (language === 'typescript' || language === 'javascript') {
      // Extract module name from path
      const parts = filePath.split('/');
      return parts[parts.length - 2]; // Parent directory as module
    }
    return undefined;
  }

  private isInterface(content: string, language: string): boolean {
    if (language === 'java' || language === 'kotlin') return content.includes('interface ');
    if (language === 'typescript') return content.includes('interface ') || content.includes('type ');
    if (language === 'python') return content.includes('Protocol') || content.includes('ABC');
    return false;
  }

  private isAbstractClass(content: string, language: string): boolean {
    if (language === 'java' || language === 'kotlin') return content.includes('abstract class');
    if (language === 'python') return content.includes('ABC') || content.includes('@abstractmethod');
    if (language === 'typescript') return content.includes('abstract class');
    return false;
  }

  private isImplementation(filePath: string, content: string, language: string): boolean {
    const path = filePath.toLowerCase();

    if (language === 'java' || language === 'kotlin') {
      return path.includes('impl/') ||
             path.includes('impl.') ||
             content.includes('implements ') ||
             content.includes(': '); // Kotlin inheritance
    }

    if (language === 'python') {
      return path.includes('impl') ||
             content.includes('(') && content.includes('):'); // Class inheritance
    }

    if (language === 'typescript' || language === 'javascript') {
      return path.includes('impl') ||
             content.includes('implements ') ||
             content.includes('extends ');
    }

    return false;
  }

  private isController(content: string, language: string): boolean {
    if (language === 'java' || language === 'kotlin') {
      return content.includes('@Controller') || content.includes('@RestController');
    }
    if (language === 'python') {
      return content.includes('@app.route') ||  // Flask
             content.includes('@router.') ||     // FastAPI
             content.includes('APIRouter');       // FastAPI
    }
    if (language === 'typescript' || language === 'javascript') {
      return content.includes('@Controller') ||  // NestJS
             content.includes('express.Router') || // Express
             content.includes('app.get') ||
             content.includes('router.get');
    }
    return false;
  }

  private isService(filePath: string, content: string, language: string): boolean {
    const path = filePath.toLowerCase();

    if (language === 'java' || language === 'kotlin') {
      return content.includes('@Service') || path.includes('service');
    }
    if (language === 'python') {
      return path.includes('service') || path.includes('business');
    }
    if (language === 'typescript' || language === 'javascript') {
      return content.includes('@Injectable') || // NestJS
             path.includes('service') ||
             path.includes('provider');
    }
    return false;
  }

  private isRepository(filePath: string, content: string, language: string): boolean {
    const path = filePath.toLowerCase();

    if (language === 'java' || language === 'kotlin') {
      return content.includes('@Repository') || path.includes('repository');
    }
    if (language === 'python') {
      return path.includes('repository') ||
             path.includes('dao') ||
             content.includes('Base.metadata'); // SQLAlchemy
    }
    if (language === 'typescript' || language === 'javascript') {
      return path.includes('repository') ||
             path.includes('model') ||
             content.includes('mongoose.') ||  // Mongoose
             content.includes('prisma.');      // Prisma
    }
    return false;
  }

  private isConfiguration(content: string, language: string): boolean {
    if (language === 'java' || language === 'kotlin') {
      return content.includes('@Configuration') || content.includes('@ConfigurationProperties');
    }
    if (language === 'python') {
      return content.includes('settings') || content.includes('config') || content.includes('Config');
    }
    if (language === 'typescript' || language === 'javascript') {
      return content.includes('@Module') || // NestJS
             content.includes('config.') ||
             content.includes('Config');
    }
    return false;
  }

  private isEntity(content: string, language: string): boolean {
    if (language === 'java' || language === 'kotlin') {
      return content.includes('@Entity') || content.includes('@Table');
    }
    if (language === 'python') {
      return content.includes('models.Model') || // Django
             content.includes('Base.metadata') || // SQLAlchemy
             content.includes('@dataclass');
    }
    if (language === 'typescript' || language === 'javascript') {
      return content.includes('@Entity') || // TypeORM
             content.includes('mongoose.Schema') || // Mongoose
             content.includes('model('); // Sequelize
    }
    return false;
  }

  private isDataTransferObject(filePath: string, content: string, language: string): boolean {
    const path = filePath.toLowerCase();

    if (language === 'java' || language === 'kotlin') {
      return path.includes('dto') ||
             path.includes('request') ||
             path.includes('response') ||
             content.includes('@Data') ||
             content.includes('data class');
    }

    if (language === 'python') {
      return path.includes('dto') ||
             path.includes('schema') ||
             content.includes('BaseModel') || // Pydantic
             content.includes('@dataclass');
    }

    if (language === 'typescript' || language === 'javascript') {
      return path.includes('dto') ||
             path.includes('interface') ||
             path.includes('type') ||
             content.includes('interface ') ||
             content.includes('type ');
    }

    return false;
  }

  private isTestFile(filePath: string, content: string): boolean {
    const path = filePath.toLowerCase();
    return path.includes('test') ||
           path.includes('spec') ||
           path.includes('__test__') ||
           content.includes('@Test') ||
           content.includes('describe(') ||
           content.includes('it(') ||
           content.includes('test(') ||
           content.includes('unittest');
  }

  private isUtilityFile(filePath: string, content: string): boolean {
    const path = filePath.toLowerCase();
    return path.includes('util') ||
           path.includes('helper') ||
           path.includes('common') ||
           path.includes('shared');
  }

  private extractSpringAnnotations(content: string): string[] {
    const annotations: string[] = [];
    const springAnnotations = [
      '@RestController', '@Controller', '@Service', '@Repository',
      '@Component', '@Configuration', '@Bean', '@Autowired',
      '@Value', '@RequestMapping', '@GetMapping', '@PostMapping',
      '@PutMapping', '@DeleteMapping', '@PathVariable', '@RequestBody',
      '@ResponseBody', '@Transactional', '@Entity', '@Table'
    ];

    springAnnotations.forEach(ann => {
      if (content.includes(ann)) {
        annotations.push(ann);
      }
    });

    return annotations;
  }

  private extractPythonDecorators(content: string): string[] {
    const decorators: string[] = [];
    const decoratorRegex = /@(\w+)/g;
    let match;

    while ((match = decoratorRegex.exec(content)) !== null) {
      decorators.push(`@${match[1]}`);
    }

    return decorators;
  }

  private extractTypeScriptDecorators(content: string): string[] {
    const decorators: string[] = [];
    const tsDecorators = [
      '@Injectable', '@Controller', '@Module', '@Get', '@Post',
      '@Put', '@Delete', '@Patch', '@Body', '@Param', '@Query',
      '@UseGuards', '@UseInterceptors', '@ApiTags', '@ApiOperation'
    ];

    tsDecorators.forEach(dec => {
      if (content.includes(dec)) {
        decorators.push(dec);
      }
    });

    return decorators;
  }

  private extractNodeExports(content: string): string[] {
    const exports: string[] = [];

    // export default
    if (content.includes('export default')) {
      exports.push('default');
    }

    // named exports
    const namedExportRegex = /export\s+(?:const|let|var|function|class|interface|type)\s+(\w+)/g;
    let match;

    while ((match = namedExportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    return exports;
  }

  private extractRestEndpoints(content: string, language: string): string[] {
    const endpoints: string[] = [];

    if (language === 'java' || language === 'kotlin') {
      // Spring Boot mappings
      const mappingRegex = /@(Request|Get|Post|Put|Delete|Patch)Mapping\s*\(\s*["\']([^"']+)["']/g;
      let match;

      while ((match = mappingRegex.exec(content)) !== null) {
        endpoints.push(`${match[1].toUpperCase()} ${match[2]}`);
      }
    }

    if (language === 'python') {
      // Flask routes
      const flaskRegex = /@app\.route\s*\(\s*["\']([^"']+)["']/g;
      let match;
      while ((match = flaskRegex.exec(content)) !== null) {
        endpoints.push(`ROUTE ${match[1]}`);
      }

      // FastAPI routes
      const fastApiRegex = /@(router|app)\.(get|post|put|delete|patch)\s*\(\s*["\']([^"']+)["']/g;
      while ((match = fastApiRegex.exec(content)) !== null) {
        endpoints.push(`${match[2].toUpperCase()} ${match[3]}`);
      }
    }

    if (language === 'typescript' || language === 'javascript') {
      // Express routes
      const expressRegex = /(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*["\']([^"']+)["']/g;
      let match;
      while ((match = expressRegex.exec(content)) !== null) {
        endpoints.push(`${match[1].toUpperCase()} ${match[2]}`);
      }

      // NestJS decorators
      const nestRegex = /@(Get|Post|Put|Delete|Patch)\s*\(\s*["\']([^"']+)["']/g;
      while ((match = nestRegex.exec(content)) !== null) {
        endpoints.push(`${match[1].toUpperCase()} ${match[2]}`);
      }
    }

    return endpoints;
  }

  private extractInjectedDependencies(content: string, language: string): string[] {
    const dependencies: string[] = [];

    if (language === 'java' || language === 'kotlin') {
      // @Autowired, constructor injection, field injection
      const injectionRegex = /@Autowired\s+(?:private\s+)?(\w+)|(?:private\s+)?final\s+(\w+)\s+\w+;|constructor\([^)]*(\w+Service|\w+Repository|\w+Client)[^)]*\)/g;
      let match;

      while ((match = injectionRegex.exec(content)) !== null) {
        const dep = match[1] || match[2] || match[3];
        if (dep && !dependencies.includes(dep)) {
          dependencies.push(dep);
        }
      }
    }

    if (language === 'python') {
      // Python dependency injection patterns
      const importRegex = /from\s+[\w.]+\s+import\s+(\w+Service|\w+Repository|\w+Client)/g;
      let match;

      while ((match = importRegex.exec(content)) !== null) {
        if (!dependencies.includes(match[1])) {
          dependencies.push(match[1]);
        }
      }
    }

    if (language === 'typescript' || language === 'javascript') {
      // Constructor injection in TypeScript/NestJS
      const constructorRegex = /constructor\([^)]*(?:private|public|protected)?\s*(\w+Service|\w+Repository|\w+Provider)[^)]*\)/g;
      let match;

      while ((match = constructorRegex.exec(content)) !== null) {
        if (!dependencies.includes(match[1])) {
          dependencies.push(match[1]);
        }
      }

      // Import statements
      const importRegex = /import\s+.*\s+from\s+['"]\.\/(services|repositories|providers)\/(\w+)['"]/g;
      while ((match = importRegex.exec(content)) !== null) {
        if (!dependencies.includes(match[2])) {
          dependencies.push(match[2]);
        }
      }
    }

    return dependencies;
  }

  private extractMethodInfo(content: string, language: string): UniversalCodeMetadata['methods'] {
    const methods: UniversalCodeMetadata['methods'] = [];

    if (language === 'java') {
      const methodRegex = /(?:public|private|protected)\s+(?:static\s+)?(?:final\s+)?(\w+(?:<[\w\s,?]+>)?)\s+(\w+)\s*\(([^)]*)\)/g;
      let match;

      while ((match = methodRegex.exec(content)) !== null) {
        if (!['if', 'for', 'while', 'switch'].includes(match[2])) {
          methods.push({
            name: match[2],
            returnType: match[1],
            parameters: match[3] ? match[3].split(',').map(p => p.trim()) : []
          });
        }
      }
    } else if (language === 'kotlin') {
      const methodRegex = /fun\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?/g;
      let match;

      while ((match = methodRegex.exec(content)) !== null) {
        methods.push({
          name: match[1],
          returnType: match[3] || 'Unit',
          parameters: match[2] ? match[2].split(',').map(p => p.trim()) : []
        });
      }
    } else if (language === 'python') {
      const methodRegex = /def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*(\w+))?/g;
      let match;

      while ((match = methodRegex.exec(content)) !== null) {
        methods.push({
          name: match[1],
          returnType: match[3] || 'Any',
          parameters: match[2] ? match[2].split(',').map(p => p.trim()).filter(p => p !== 'self') : []
        });
      }

      // Async methods
      const asyncMethodRegex = /async\s+def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*(\w+))?/g;
      while ((match = asyncMethodRegex.exec(content)) !== null) {
        methods.push({
          name: `async ${match[1]}`,
          returnType: match[3] || 'Awaitable',
          parameters: match[2] ? match[2].split(',').map(p => p.trim()).filter(p => p !== 'self') : []
        });
      }
    } else if (language === 'typescript' || language === 'javascript') {
      // TypeScript/JavaScript methods
      const methodRegex = /(?:async\s+)?(?:public|private|protected)?\s*(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?/g;
      let match;

      while ((match = methodRegex.exec(content)) !== null) {
        if (!['if', 'for', 'while', 'switch', 'catch'].includes(match[1])) {
          methods.push({
            name: match[1],
            returnType: match[3] || 'any',
            parameters: match[2] ? match[2].split(',').map(p => p.trim()) : []
          });
        }
      }

      // Arrow functions
      const arrowRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*(\w+))?\s*=>/g;
      while ((match = arrowRegex.exec(content)) !== null) {
        methods.push({
          name: match[1],
          returnType: match[2] || 'any',
          parameters: []
        });
      }
    }

    return methods.slice(0, 20); // Limit to 20 methods
  }

  private countMethods(content: string, language: 'java' | 'kotlin' | 'python' | 'typescript' | 'javascript' | 'unknown'): number {
    if (language === 'java') {
      const matches = content.match(/(?:public|private|protected)\s+(?:static\s+)?(?:final\s+)?\w+\s+\w+\s*\(/g);
      return matches?.length || 0;
    }
    if (language === 'kotlin') {
      const matches = content.match(/fun\s+\w+\s*\(/g);
      return matches?.length || 0;
    }
    if (language === 'python') {
      const matches = content.match(/def\s+\w+\s*\(/g);
      return matches?.length || 0;
    }
    if (language === 'typescript' || language === 'javascript') {
      const functionMatches = content.match(/function\s+\w+\s*\(/g) || [];
      const arrowMatches = content.match(/(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*\w+)?\s*=>/g) || [];
      const methodMatches = content.match(/\w+\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/g) || [];
      return functionMatches.length + arrowMatches.length + methodMatches.length;
    }
    return 0;
  }

  private calculateCyclomaticComplexity(content: string): number {
    const decisionPoints = [
      /if\s*\(/g,
      /else\s+if\s*\(/g,
      /for\s*\(/g,
      /while\s*\(/g,
      /case\s+/g,
      /catch\s*\(/g,
      /\?\s*:/g,  // ternary operator
      /&&/g,
      /\|\|/g
    ];

    let complexity = 1; // Base complexity

    decisionPoints.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });

    return complexity;
  }

  private countDependencies(content: string): number {
    const imports = content.match(/import\s+[^;]+;/g);
    return imports?.length || 0;
  }

  private hasAnnotation(content: string, ...annotations: string[]): boolean {
    return annotations.some(annotation => content.includes(annotation));
  }

  private calculateArchitecturalImportance(filePath: string, content: string): number {
    let score = 0.3; // Base score

    // Controller layer - high importance for API changes
    if (this.hasAnnotation(content, '@RestController', '@Controller')) {
      score = Math.max(score, 0.8);
    }

    // Service layer - core business logic
    if (this.hasAnnotation(content, '@Service') || filePath.includes('service')) {
      score = Math.max(score, 0.7);
    }

    // Repository layer - data access
    if (this.hasAnnotation(content, '@Repository') || filePath.includes('repository')) {
      score = Math.max(score, 0.6);
    }

    // Configuration - system behavior
    if (this.hasAnnotation(content, '@Configuration')) {
      score = Math.max(score, 0.6);
    }

    // Implementation classes typically more important than interfaces
    // Determine language from file extension
    const language = this.detectLanguage(filePath, content);
    if (this.isImplementation(filePath, content, language)) {
      score *= 1.2;
    }

    return Math.min(score, 1.0);
  }

  private calculateNormalizedComplexity(content: string): number {
    const complexity = this.calculateCyclomaticComplexity(content);
    const lines = content.split('\n').length;

    // Normalize by lines of code
    const normalizedComplexity = complexity / Math.max(lines, 1) * 100;

    // Convert to 0-1 scale
    if (normalizedComplexity < 5) return 0.2;
    if (normalizedComplexity < 10) return 0.4;
    if (normalizedComplexity < 15) return 0.6;
    if (normalizedComplexity < 20) return 0.8;
    return 1.0;
  }

  private calculateIntegrationLevel(content: string): number {
    // Detect language from content patterns
    const language = this.detectLanguageFromContent(content);
    const dependencies = this.extractInjectedDependencies(content, language);
    const endpoints = this.extractRestEndpoints(content, language);

    const integrationScore = (dependencies.length * 0.1) + (endpoints.length * 0.15);

    return Math.min(integrationScore, 1.0);
  }

  private detectLanguageFromContent(content: string): 'java' | 'kotlin' | 'python' | 'typescript' | 'javascript' | 'unknown' {
    if (content.includes('package ') && content.includes('import ')) return 'java';
    if (content.includes('fun ') && content.includes('val ')) return 'kotlin';
    if (content.includes('def ') && content.includes('import ')) return 'python';
    if (content.includes('interface ') || content.includes(': Promise<')) return 'typescript';
    if (content.includes('const ') || content.includes('function ')) return 'javascript';
    return 'unknown';
  }

  private describeArchitecturalRole(metadata: UniversalCodeMetadata): string {
    const roles: string[] = [];

    if (metadata.structure.isController) {
      roles.push('REST API Controller handling HTTP requests');
    }
    if (metadata.structure.isService) {
      roles.push('Service layer implementing business logic');
    }
    if (metadata.structure.isRepository) {
      roles.push('Data access layer managing persistence');
    }
    if (metadata.structure.isConfiguration) {
      roles.push('Configuration component managing application settings');
    }
    if (metadata.structure.isEntity) {
      roles.push('JPA Entity representing database table');
    }
    if (metadata.structure.isDto) {
      roles.push('Data Transfer Object for API communication');
    }
    if (metadata.structure.isInterface) {
      roles.push('Interface defining contract');
    }
    if (metadata.structure.isAbstract) {
      roles.push('Abstract class providing base implementation');
    }

    return roles.length > 0 ? roles.join('\n') : 'General application component';
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const cacheKey = text.substring(0, 100); // Simple cache key

    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: text.substring(0, 8000),
      });

      const embedding = response.data[0].embedding;
      this.embeddingCache.set(cacheKey, embedding);

      return embedding;
    } catch (error) {
      console.warn('Embedding generation failed:', error);
      // Return random embedding for testing
      return Array(3072).fill(0).map(() => Math.random());
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  private applySemanticWeights(
    baseSimilarity: number,
    metadata: UniversalCodeMetadata
  ): number {
    let similarity = baseSimilarity;

    // Apply architectural importance weight
    if (metadata.semanticFeatures) {
      similarity *= (1 + metadata.semanticFeatures.architecturalImportance * 0.2);

      // High integration components are more likely to be affected
      similarity *= (1 + metadata.semanticFeatures.integrationLevel * 0.15);
    }

    // Implementation classes weighted higher than interfaces
    if (metadata.structure.isImplementation) {
      similarity *= 1.15;
    }

    return Math.min(similarity, 1.0);
  }

  private determineImpactLevel(
    similarity: number,
    metadata: UniversalCodeMetadata
  ): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    // Critical: High similarity + high architectural importance
    if (similarity > 0.8 && metadata.semanticFeatures?.architecturalImportance! > 0.7) {
      return 'CRITICAL';
    }

    // High: High similarity or important component
    if (similarity > 0.7 || metadata.semanticFeatures?.architecturalImportance! > 0.8) {
      return 'HIGH';
    }

    // Medium: Moderate similarity
    if (similarity > 0.5) {
      return 'MEDIUM';
    }

    // Low: Everything else
    return 'LOW';
  }
}

export default UniversalImpactAnalyzer;