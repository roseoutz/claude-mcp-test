import { z } from 'zod';

export const envSchema = z.object({
  // 서버 설정
  NODE_ENV: z.string().toLowerCase().pipe(z.enum(['development', 'production', 'test'])).default('development'),
  LOG_LEVEL: z.string().toLowerCase().pipe(z.enum(['debug', 'info', 'warn', 'error'])).default('info'),
  
  // MCP 설정
  MCP_SERVER_NAME: z.string().default('code-ai-mcp'),
  MCP_SERVER_VERSION: z.string().default('1.0.0'),
  
  // AI 설정
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4'),
  OPENAI_MAX_TOKENS: z.coerce.number().default(2000),
  OPENAI_TEMPERATURE: z.coerce.number().default(0.7),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-3-opus-20240229'),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().default(4000),
  
  // Git 설정
  GITHUB_TOKEN: z.string().optional(),
  GITLAB_TOKEN: z.string().optional(),
  BITBUCKET_TOKEN: z.string().optional(),
  DEFAULT_BRANCH: z.string().default('main'),
  GIT_TIMEOUT: z.coerce.number().default(30000), // 30초
  GIT_MAX_DEPTH: z.coerce.number().default(50),
  
  // 보안 설정
  MAX_FILE_SIZE: z.coerce.number().default(1048576), // 1MB
  MAX_FILE_SIZE_MB: z.coerce.number().default(1),
  ALLOWED_FILE_EXTENSIONS: z.string().default('.ts,.js,.py,.java,.go,.rs,.cpp,.c,.cs,.rb,.php,.swift,.kt,.scala,.hs,.clj,.ex,.dart,.lua,.r,.jl,.sh,.sql,.html,.css,.scss,.yaml,.yml,.json,.xml,.md,.mdx'),
  EXCLUDED_PATHS: z.string().default('node_modules,.git,dist,build,coverage,.next,.cache,vendor,target,bin,obj'),
  ENABLE_AUDIT_LOG: z.coerce.boolean().default(false),
  
  // 캐시 설정
  CACHE_ENABLED: z.coerce.boolean().default(true),
  CACHE_TYPE: z.string().toLowerCase().pipe(z.enum(['memory', 'redis', 'file'])).default('memory'),
  CACHE_TTL: z.coerce.number().default(3600), // 1시간
  CACHE_MAX_SIZE: z.coerce.number().default(1000),
  CACHE_NAMESPACE: z.string().default('mcp'),
  
  // Redis 설정 (캐시가 Redis인 경우)
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  
  // 벡터 DB 설정
  VECTOR_STORE_PROVIDER: z.string().toLowerCase().pipe(z.enum(['elasticsearch'])).default('elasticsearch'),
  VECTOR_STORE_URL: z.string().optional(),
  VECTOR_STORE_API_KEY: z.string().optional(),
  VECTOR_STORE_COLLECTION: z.string().default('codebase'),
  VECTOR_DIMENSION: z.coerce.number().default(1536),
  VECTOR_SIMILARITY: z.string().toLowerCase().pipe(z.enum(['cosine', 'euclidean', 'dot'])).default('cosine'),

  // Elasticsearch 설정
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),
  ELASTICSEARCH_INDEX: z.string().default('codebase-index'),
  ELASTICSEARCH_AUTH: z.coerce.boolean().default(false),
  ELASTICSEARCH_USERNAME: z.string().optional(),
  ELASTICSEARCH_PASSWORD: z.string().optional(),
  
  // 데이터베이스 설정
  DATABASE_TYPE: z.string().toLowerCase().pipe(z.enum(['postgres', 'mysql', 'sqlite', 'mongodb'])).default('sqlite'),
  DATABASE_HOST: z.string().optional(),
  DATABASE_PORT: z.coerce.number().optional(),
  DATABASE_NAME: z.string().optional(),
  DATABASE_USER: z.string().optional(),
  DATABASE_PASSWORD: z.string().optional(),
  DATABASE_CONNECTION_STRING: z.string().optional(),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(10),
  
  // Rate Limiting
  RATE_LIMIT_ENABLED: z.coerce.boolean().default(false),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000), // 1분
  
  // 서버 설정 (HTTP 전송 사용 시)
  SERVER_PORT: z.coerce.number().default(3000),
  SERVER_HOST: z.string().default('localhost'),
  CORS_ENABLED: z.coerce.boolean().default(true),
  CORS_ORIGINS: z.string().default('*'),
  
  // 임베딩 설정
  EMBEDDING_PROVIDER: z.string().toLowerCase().pipe(z.enum(['openai', 'cohere', 'local'])).default('openai'),
  EMBEDDING_MODEL: z.string().default('text-embedding-ada-002'),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1536),
});

export type EnvConfig = z.infer<typeof envSchema>;