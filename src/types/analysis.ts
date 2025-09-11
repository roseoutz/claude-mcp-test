// 코드 분석 관련 타입 정의

export interface CodebaseAnalysisResult {
  filesAnalyzed: number;
  featuresExtracted: number;
  componentsIdentified: number;
  branch: string;
  statistics: {
    totalFiles: number;
    totalLines: number;
    testFiles: number;
    configFiles: number;
    supportedLanguages: string[];
  };
  identifiedComponents: Array<{
    name: string;
    description: string;
    path: string;
    type: 'service' | 'component' | 'utility' | 'config';
  }>;
  analysisTime: string;
}

export interface BranchDiffResult {
  sourceBranch: string;
  targetBranch: string;
  diffResult: {
    changedFiles: Array<{
      path: string;
      status: 'added' | 'modified' | 'deleted' | 'renamed';
      linesAdded: number;
      linesDeleted: number;
    }>;
    summary: {
      totalFiles: number;
      totalLinesAdded: number;
      totalLinesDeleted: number;
    };
  };
  getSummary(): string;
  getTotalChangedFiles(): number;
  getTotalAddedLines(): number;
  getTotalDeletedLines(): number;
}

export interface FeatureExplanation {
  featureId: string;
  explanation: string;
  codeExamples: Array<{
    filePath: string;
    language: string;
    code: string;
  }>;
}

export interface ImpactAnalysisResult {
  riskAssessment: {
    overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    riskFactors: string[];
  };
  directImpact: {
    affectedFiles: string[];
    affectedComponents: string[];
    estimatedChanges: number;
    complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  indirectImpact: {
    affectedFiles: string[];
    affectedComponents: string[];
    dependencyDepth: number;
    cascadeRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  recommendations: string[];
}

export interface FileAnalysis {
  path: string;
  language: string;
  lines: number;
  complexity: number;
  dependencies: string[];
  exports: string[];
  functions: Array<{
    name: string;
    lineStart: number;
    lineEnd: number;
    parameters: string[];
  }>;
}