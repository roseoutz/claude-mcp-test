# MCP Codebase Analyzer - 모델 선택 가이드 (최종 구성)

## 📋 목차
1. [임베딩 모델 선택](#임베딩-모델-선택)
2. [분석 모델 선택](#분석-모델-선택)
3. [Spring AI 설정](#spring-ai-설정)
4. [비용 최적화 전략](#비용-최적화-전략)
5. [성능 벤치마크](#성능-벤치마크)

## 🎯 임베딩 모델 선택

### OpenAI 임베딩 모델

#### 1. text-embedding-3-large (추천)
```yaml
# application.yml 설정
spring:
  ai:
    openai:
      embedding:
        model: text-embedding-3-large
        dimensions: 3072  # 256-3072 사이 조정 가능
```

**특징:**
- 최고 수준의 임베딩 품질
- 코드 구조와 의미 이해 우수
- 다국어 지원 (한국어 주석 포함)
- 차원 축소 지원으로 유연한 성능 조정

**사용 사례:**
- 프로덕션 환경
- 정확도가 중요한 경우
- 대규모 코드베이스 분석

#### 2. text-embedding-3-small
```yaml
spring:
  ai:
    openai:
      embedding:
        model: text-embedding-3-small
        dimensions: 1536
```

**특징:**
- 비용 효율적 (large 대비 6.5배 저렴)
- 빠른 처리 속도
- 충분한 성능 제공

**사용 사례:**
- 개발/테스트 환경
- 비용 민감한 프로젝트
- 실시간 처리가 중요한 경우

### 오픈소스 대안

#### Ollama + nomic-embed-text
```yaml
spring:
  ai:
    ollama:
      base-url: http://localhost:11434
      embedding:
        model: nomic-embed-text
```

```bash
# Ollama 설치 및 모델 다운로드
ollama pull nomic-embed-text
```

**특징:**
- 완전 무료, 로컬 실행
- 데이터 프라이버시 보장
- 768차원 임베딩

**사용 사례:**
- 보안이 중요한 환경
- 오프라인 환경
- 예산 제약이 있는 프로젝트

## 🧠 분석 모델 선택

### 최종 선택: Claude Sonnet 4 ⭐

**Claude Sonnet 4를 선택한 이유:**
- 최신 모델 (2025년 5월 출시)
- 뛰어난 코드 이해력과 균형잡힌 성능
- 초대형 컨텍스트 처리 (200K 토큰, 1M 베타)
- 비전 기능으로 다이어그램/스크린샷 분석 가능
- 빠른 응답 속도와 높은 정확도
- 최대 64K 토큰 출력 지원
- 한국어 포함 다국어 지원 우수

### 주요 작업별 Claude Sonnet 4 활용

| 작업 | 강점 | 설정 |
|------|------|------|
| **코드 구조 분석** | 정확한 의존성 파악, 디자인 패턴 인식 | temperature: 0.1 |
| **복잡한 아키텍처 이해** | 시스템 전체 구조 파악, 계층 분석 | temperature: 0.2 |
| **메타데이터 추출** | 구조화된 JSON 출력, 일관성 | temperature: 0.0 |
| **자연어 쿼리 처리** | 맥락 이해, 정확한 답변 | temperature: 0.3 |
| **코드 리뷰/개선 제안** | 깊은 이해 기반 제안 | temperature: 0.5 |

### Claude Sonnet 4 구현
```kotlin
@Configuration
class AnthropicConfig {
    @Value("\${anthropic.api-key}")
    private lateinit var apiKey: String
    
    @Bean
    fun anthropicClient(): AnthropicClient {
        return AnthropicClient.builder()
            .apiKey(apiKey)
            .build()
    }
    
    @Bean
    fun claudeAnalysisService(): ClaudeAnalysisService {
        return ClaudeAnalysisService(
            client = anthropicClient(),
            model = "claude-sonnet-4-20250514",  // 최신 Sonnet 4
            maxTokens = 8192,  // 증가된 출력 토큰
            temperature = 0.1
        )
    }
}
```

**Claude Opus 서비스 구현:**
```kotlin
@Service
class ClaudeAnalysisService(
    private val client: AnthropicClient,
    private val model: String,
    private val maxTokens: Int,
    private val temperature: Double
) {
    suspend fun analyzeCode(
        code: String,
        analysisType: AnalysisType
    ): AnalysisResult {
        val prompt = buildPrompt(code, analysisType)
        
        val response = client.messages.create {
            model(this@ClaudeAnalysisService.model)
            maxTokens(this@ClaudeAnalysisService.maxTokens)
            temperature(getTemperatureForType(analysisType))
            messages {
                message {
                    role = "user"
                    content = prompt
                }
            }
        }
        
        return parseResponse(response)
    }
    
    private fun getTemperatureForType(type: AnalysisType): Double {
        return when (type) {
            AnalysisType.METADATA_EXTRACTION -> 0.0
            AnalysisType.STRUCTURE_ANALYSIS -> 0.1
            AnalysisType.ARCHITECTURE_UNDERSTANDING -> 0.2
            AnalysisType.NATURAL_QUERY -> 0.3
            AnalysisType.CODE_REVIEW -> 0.5
        }
    }
}
```

## ⚙️ 모델 통합 설정

### application.yml 전체 설정
```yaml
spring:
  ai:
    # OpenAI - 임베딩 전용
    openai:
      api-key: ${OPENAI_API_KEY}
      base-url: https://api.openai.com
      
      # 임베딩 설정 (OpenAI text-embedding-3-large)
      embedding:
        model: ${OPENAI_EMBEDDING_MODEL:text-embedding-3-large}
        dimensions: ${OPENAI_EMBEDDING_DIMENSIONS:1536}

# Anthropic Claude - 분석 전용
anthropic:
  api-key: ${ANTHROPIC_API_KEY}
  model: ${ANTHROPIC_MODEL:claude-sonnet-4-20250514}  # Sonnet 4 최신
  max-tokens: ${ANTHROPIC_MAX_TOKENS:8192}
  temperature: ${ANTHROPIC_TEMPERATURE:0.1}
  # 대용량 컨텍스트를 위한 설정 (선택사항)
  context-window: 200000  # 200K 토큰
  # beta-features:
  #   extended-context: 1000000  # 1M 토큰 베타
          
    # 재시도 정책
    retry:
      max-attempts: 3
      backoff:
        initial-interval: 1000
        multiplier: 2.0
        max-interval: 10000
        
    # 벡터 스토어 설정
    vectorstore:
      chroma:
        collection-name: codebase-embeddings
        distance-metric: cosine
```

### 통합 모델 설정
```kotlin
@Configuration
class ModelIntegrationConfig {
    
    // OpenAI 임베딩 모델
    @Bean
    fun embeddingModel(
        @Value("\${openai.api-key}") apiKey: String,
        @Value("\${openai.embedding.model}") model: String,
        @Value("\${openai.embedding.dimensions}") dimensions: Int
    ): EmbeddingModel {
        val openAiApi = OpenAiApi(apiKey)
        return OpenAiEmbeddingModel(
            openAiApi,
            OpenAiEmbeddingOptions.builder()
                .withModel(model)
                .withDimensions(dimensions)
                .build()
        )
    }
    
    // Claude 분석 서비스
    @Bean
    fun analysisService(
        @Value("\${anthropic.api-key}") apiKey: String,
        @Value("\${anthropic.model}") model: String,
        @Value("\${anthropic.max-tokens}") maxTokens: Int,
        @Value("\${anthropic.temperature}") temperature: Double
    ): AnalysisService {
        return ClaudeAnalysisService(
            apiKey = apiKey,
            model = model,
            maxTokens = maxTokens,
            defaultTemperature = temperature
        )
    }
    
    // 통합 파이프라인
    @Bean
    fun codeAnalysisPipeline(
        embeddingModel: EmbeddingModel,
        analysisService: AnalysisService,
        vectorStore: VectorStore
    ): CodeAnalysisPipeline {
        return CodeAnalysisPipeline(
            embeddingModel = embeddingModel,  // OpenAI
            analysisService = analysisService, // Claude
            vectorStore = vectorStore         // ChromaDB
        )
    }
}
```

## 💰 비용 최적화 전략

### 1. 캐싱 전략
```kotlin
@Service
class CachedEmbeddingService(
    private val embeddingModel: EmbeddingModel,
    private val redisTemplate: RedisTemplate<String, List<Float>>
) {
    fun getEmbedding(text: String): List<Float> {
        val cacheKey = "embedding:${text.hashCode()}"
        
        // Redis 캐시 확인
        return redisTemplate.opsForValue().get(cacheKey)
            ?: embeddingModel.embed(text).also {
                // 30일간 캐싱
                redisTemplate.opsForValue().set(
                    cacheKey, 
                    it, 
                    30, 
                    TimeUnit.DAYS
                )
            }
    }
}
```

### 2. 배치 처리
```kotlin
@Service
class BatchEmbeddingService(
    private val embeddingModel: EmbeddingModel
) {
    fun embedBatch(texts: List<String>): List<List<Float>> {
        // 100개씩 배치 처리
        return texts.chunked(100)
            .flatMap { batch ->
                embeddingModel.embed(batch)
            }
    }
}
```

### 3. 차원 축소
```yaml
# 개발 환경 - 낮은 차원
spring:
  profiles: dev
  ai:
    openai:
      embedding:
        dimensions: 512  # 비용 절감

# 프로덕션 - 높은 차원
spring:
  profiles: prod
  ai:
    openai:
      embedding:
        dimensions: 1536  # 최적 성능
```

### 4. 스마트 모델 선택
```kotlin
@Service
class SmartModelSelector {
    
    fun selectModel(query: QueryContext): String {
        return when {
            query.isSimple() -> "gpt-3.5-turbo"
            query.requiresCodeAnalysis() -> "gpt-4o-mini"
            query.isComplex() -> "gpt-4o"
            else -> "gpt-4o-mini"
        }
    }
    
    fun estimateCost(tokens: Int, model: String): BigDecimal {
        val rates = mapOf(
            "gpt-3.5-turbo" to 0.0005,
            "gpt-4o-mini" to 0.00015,
            "gpt-4o" to 0.005
        )
        return BigDecimal(tokens * (rates[model] ?: 0.001) / 1000)
    }
}
```

## 📊 성능 벤치마크

### 임베딩 모델 비교

| 모델 | 차원 | 속도 (req/s) | 정확도 | 비용 ($/1M tokens) |
|------|------|---------------|---------|-------------------|
| text-embedding-3-large | 3072 | 100 | 95% | $0.13 |
| text-embedding-3-large | 1536 | 100 | 93% | $0.13 |
| text-embedding-3-small | 1536 | 150 | 88% | $0.02 |
| nomic-embed-text | 768 | 500+ | 82% | $0 (로컬) |

### 분석 모델 비교

| 모델 | 응답 시간 | 코드 이해도 | 비용 ($/1K tokens) |
|------|-----------|-------------|-------------------|
| GPT-4o | 1-2초 | 98% | Input: $5, Output: $15 |
| GPT-4o-mini | 0.5-1초 | 92% | Input: $0.15, Output: $0.6 |
| GPT-3.5-turbo | 0.3-0.5초 | 85% | Input: $0.5, Output: $1.5 |

### 실제 사용 예시 비용 (OpenAI + Claude)

**시나리오: 10,000개 파일 코드베이스 분석**

1. **임베딩 생성 (OpenAI)**
   - 평균 파일당 500 토큰
   - 총 5M 토큰
   - text-embedding-3-large: $0.65

2. **메타데이터 추출 (Claude Sonnet 4)**
   - 파일당 평균 200 입력 + 100 출력 토큰
   - Claude Sonnet 4: $0.60 + $1.50 = $2.10
   - (입력: $3/1M tokens, 출력: $15/1M tokens)

3. **월간 쿼리 처리 (1000 쿼리)**
   - 쿼리당 평균 500 입력 + 200 출력 토큰
   - Claude Sonnet 4: $1.50 + $3.00 = $4.50/1000쿼리
   - 월간: ~$5

**총 예상 비용:**
- 초기 설정: ~$3 (임베딩 $0.65 + 초기 분석 $2.10)
- 월간 운영: ~$5-10 (쿼리 처리)

**비용 최적화 팁:**
- 임베딩은 한 번만 생성하고 캐싱
- Claude 응답도 Redis에 캐싱
- 반복 쿼리는 캐시에서 처리

## 🔄 마이그레이션 전략

### 단계별 접근
1. **Phase 1**: GPT-3.5-turbo로 시작
2. **Phase 2**: 성능 요구사항 파악 후 GPT-4o-mini 도입
3. **Phase 3**: 특정 고급 기능에만 GPT-4o 적용

### 모니터링 지표
```kotlin
@Component
class ModelMetricsCollector {
    
    @EventListener
    fun onModelUsage(event: ModelUsageEvent) {
        // 메트릭 수집
        metrics.record(
            model = event.model,
            tokens = event.tokens,
            latency = event.latency,
            cost = event.estimatedCost
        )
    }
    
    fun getOptimizationSuggestions(): List<Suggestion> {
        // 사용 패턴 분석 후 최적화 제안
        return analyzer.analyze(metrics)
    }
}
```

## 📝 최종 구성 및 권장사항

### 선택된 구성 ⭐
- **임베딩**: OpenAI text-embedding-3-large (1536 차원)
  - 최고의 코드 임베딩 품질
  - Spring AI 네이티브 지원
- **분석**: Claude Sonnet 4 (claude-sonnet-4-20250514)
  - 최신 모델로 뛰어난 성능
  - 200K 토큰 컨텍스트 (1M 베타)
  - 비전 기능으로 다이어그램 분석 가능
  - 빠른 응답과 정확한 메타데이터 추출
- **벡터 DB**: ChromaDB
- **캐싱**: Redis
- **메타데이터**: PostgreSQL

### 구현 아키텍처
```
코드 입력 → OpenAI Embedding → ChromaDB 저장
    ↓
자연어 쿼리 → OpenAI Embedding → 유사도 검색
    ↓
검색 결과 → Claude Opus 분석 → 응답 생성
```

### 개발 환경 대안
- **임베딩**: text-embedding-3-small (비용 절감)
- **분석**: Claude 3.5 Haiku (빠른 응답, 저비용)
- **로컬 대안**: Ollama + Mixtral (완전 무료)

### 모델 업그레이드 경로
1. **현재**: Claude Sonnet 4 (균형적 성능)
2. **고급 요구사항**: Claude Opus 4 (출시 예정, 최고 성능)
3. **비용 최적화**: Claude Haiku 4 (출시 예정, 초고속)

이 구성으로 비용 효율적이면서도 높은 성능의 코드베이스 분석 시스템을 구축할 수 있습니다.