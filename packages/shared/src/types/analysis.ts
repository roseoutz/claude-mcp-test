export interface CodeComponent {
  id: string;
  name: string;
  type: 'class' | 'function' | 'interface' | 'module' | 'component' | 'enum' | 'type';
  filePath: string;
  lineStart: number;
  lineEnd: number;
  description?: string;
  dependencies: string[];
  visibility?: 'public' | 'private' | 'protected';
}

export interface FileAnalysis {
  filePath: string;
  language: string;
  components: CodeComponent[];
  imports: string[];
  exports: string[];
  complexity: number;
  linesOfCode: number;
  commentLines: number;
  emptyLines: number;
}

export interface CodebaseAnalysis {
  repository: Repository;
  timestamp: Date;
  files: FileAnalysis[];
  statistics: {
    totalFiles: number;
    totalLines: number;
    languages: Record<string, number>;
    componentCount: Record<string, number>;
    averageComplexity: number;
    testCoverage?: number;
  };
  dependencies?: {
    production: Record<string, string>;
    development: Record<string, string>;
  };
}

export interface ImpactAnalysis {
  change: string;
  affectedFiles: string[];
  directImpact: CodeComponent[];
  indirectImpact: CodeComponent[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  suggestions: string[];
  estimatedEffort?: number; // in hours
  testingRequired: string[];
}

export interface SecurityAnalysis {
  filePath: string;
  issues: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    line: number;
    message: string;
    recommendation: string;
  }>;
  score: number; // 0-100
}

export interface PerformanceAnalysis {
  filePath: string;
  metrics: {
    complexity: number;
    maintainability: number;
    duplications: number;
    coverage?: number;
  };
  suggestions: string[];
}

// Import Repository type from git.ts
import type { Repository } from './git.js';