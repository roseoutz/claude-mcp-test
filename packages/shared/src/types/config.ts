export interface SecurityConfig {
  maxFileSize: number; // in bytes
  maxFileSizeMB: number; // convenience property in MB
  allowedPaths: string[];
  excludedPaths: string[];
  allowedExtensions: string[];
  enableAuditLog: boolean;
  rateLimiting?: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
  };
  authentication?: {
    required: boolean;
    type: 'token' | 'oauth' | 'basic';
  };
}

export interface MCPServerConfig {
  name: string;
  version: string;
  capabilities: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
    sampling?: boolean;
  };
  transport?: {
    type: 'stdio' | 'http' | 'websocket';
    options?: Record<string, any>;
  };
}

export interface AppConfig {
  env: 'development' | 'production' | 'test';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  port?: number;
  host?: string;
  cors?: {
    enabled: boolean;
    origins: string[];
  };
}

export interface AIConfig {
  openai?: {
    apiKey: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
  anthropic?: {
    apiKey: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
  embedding?: {
    provider: 'openai' | 'cohere' | 'local';
    model: string;
    dimensions: number;
  };
}

export interface CacheConfig {
  enabled: boolean;
  type: 'memory' | 'redis' | 'file';
  ttl: number; // in seconds
  maxSize?: number; // max items
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
}

export interface VectorStoreConfig {
  provider: 'chromadb' | 'pinecone' | 'weaviate' | 'qdrant';
  url?: string;
  apiKey?: string;
  collection?: string;
  dimensions?: number;
  similarity?: 'cosine' | 'euclidean' | 'dot';
}

export interface GitConfig {
  defaultBranch: string;
  githubToken?: string;
  gitlabToken?: string;
  bitbucketToken?: string;
  timeout?: number; // in milliseconds
  maxDepth?: number; // for clone operations
}

export interface DatabaseConfig {
  type: 'postgres' | 'mysql' | 'sqlite' | 'mongodb';
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  connectionString?: string;
  pool?: {
    min: number;
    max: number;
  };
}

export interface FullConfig {
  app: AppConfig;
  mcp: MCPServerConfig;
  security: SecurityConfig;
  ai?: AIConfig;
  cache?: CacheConfig;
  vectorStore?: VectorStoreConfig;
  git?: GitConfig;
  database?: DatabaseConfig;
}