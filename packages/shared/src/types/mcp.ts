export interface ToolInput<T = any> {
  name: string;
  arguments: T;
}

export interface ToolOutput<T = any> {
  content: T[];
  isError?: boolean;
  metadata?: Record<string, any>;
}

export interface ToolContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: any;
  mimeType?: string;
}

// Tool specific inputs
export interface LearnCodebaseInput {
  repoPath: string;
  branch?: string;
  includeTests?: boolean;
  maxFileSize?: number;
  filePatterns?: string[];
  excludePatterns?: string[];
}

export interface AnalyzeDiffInput {
  repoPath: string;
  baseBranch: string;
  targetBranch: string;
  includeStats?: boolean;
  contextLines?: number;
}

export interface ExplainFeatureInput {
  featureId: string;
  includeCodeExamples?: boolean;
  depth?: 'basic' | 'detailed' | 'comprehensive';
  format?: 'markdown' | 'plain' | 'json';
}

export interface AnalyzeImpactInput {
  changeDescription: string;
  affectedFiles: string[];
  analysisDepth?: 'basic' | 'deep' | 'comprehensive';
  includeTests?: boolean;
  includeDependencies?: boolean;
}

export interface SearchCodeInput {
  query: string;
  repoPath?: string;
  searchType?: 'literal' | 'regex' | 'semantic';
  fileTypes?: string[];
  maxResults?: number;
}

// MCP Protocol types
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: MCPProtocolError;
}

export interface MCPProtocolError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}