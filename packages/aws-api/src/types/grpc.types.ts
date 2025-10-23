/**
 * gRPC 서비스 타입 정의
 * Proto 파일에서 생성된 타입들
 */

export interface LearnRequest {
  repository_path: string;
  branch: string;
  file_patterns: string[];
  metadata?: Record<string, string>;
}

export interface LearnResponse {
  success: boolean;
  session_id: string;
  files_processed: number;
  total_size_bytes: number;
  message: string;
}

export interface AnalyzeRequest {
  session_id: string;
  analysis_type: string;
  options?: Record<string, string>;
}

export interface AnalyzeProgress {
  stage: string;
  progress: number;
  current_file?: string;
  message: string;
  final_result?: AnalysisResult;
}

export interface AnalysisResult {
  summary: string;
  findings: Finding[];
  statistics: Record<string, number>;
  result?: unknown; // For backward compatibility
}

export interface Finding {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  file_path: string;
  line_number: number;
  description: string;
  suggestion: string;
}

export interface SearchRequest {
  session_id: string;
  query: string;
  file_types?: string[];
  max_results?: number;
  semantic_search: boolean;
}

export interface SearchResult {
  file_path: string;
  line_number: number;
  code_snippet: string;
  relevance_score: number;
  explanation?: string;
}

export interface ChatMessage {
  session_id: string;
  message: string;
  context_files?: string[];
  metadata?: Record<string, string>;
}

export interface ChatResponse {
  response: string;
  references: CodeReference[];
  is_complete: boolean;
  thinking_process?: string;
}

export interface CodeReference {
  file_path: string;
  start_line: number;
  end_line: number;
  snippet: string;
  relevance: string;
}

export interface DiffRequest {
  session_id: string;
  base_branch: string;
  target_branch: string;
  include_impact_analysis: boolean;
}

export interface DiffResult {
  file_path: string;
  changes: Change[];
  impact_summary?: string;
  affected_components?: string[];
}

export interface Change {
  type: 'added' | 'modified' | 'deleted';
  line_number: number;
  before?: string;
  after?: string;
  explanation?: string;
}

/**
 * Session 데이터 타입
 */
export interface SessionData {
  session_id: string;
  repository_path: string;
  branch: string;
  created_at: Date;
  files_processed: number;
  metadata?: Record<string, unknown>;
}
