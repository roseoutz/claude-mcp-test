# MCP Codebase Analyzer - 전체 개발 문서

## 목차
1. [프로젝트 개요](#1-프로젝트-개요)
2. [시스템 아키텍처](#2-시스템-아키텍처)
3. [개발 환경 설정](#3-개발-환경-설정)
4. [API 명세](#4-api-명세)
5. [데이터 모델](#5-데이터-모델)
6. [핵심 구현 코드](#6-핵심-구현-코드)
7. [배포 가이드](#7-배포-가이드)
8. [테스트 가이드](#8-테스트-가이드)

---

## 1. 프로젝트 개요

### 1.1 목적
Claude Code에서 코드베이스를 이해하고 분석할 수 있도록 MCP(Model Context Protocol) 서버를 구축합니다.

### 1.2 주요 기능
- **코드베이스 학습**: develop 브랜치를 기준으로 전체 코드베이스 인덱싱
- **브랜치 차이 분석**: 피처 브랜치와 develop 브랜치 간 차이점 분석
- **기능 설명**: 특정 비즈니스 기능에 대한 상세 설명 제공
- **영향도 분석**: 코드 변경 시 영향 범위 및 리스크 평가

### 1.3 기술 스택
- **Language**: Kotlin 2.0.21
- **Framework**: Spring Boot 3.5.5, Spring AI 1.0.1
- **JVM**: Java 21 with Virtual Threads (Project Loom)
- **Native**: GraalVM Native Image with AOT compilation
- **Vector DB**: ChromaDB
- **Cache**: Redis
- **Build Tool**: Gradle (Kotlin DSL)
- **Container**: Docker
- **Protocol**: JSON-RPC 2.0 over STDIO
- **Concurrency**: Virtual Threads for high-throughput I/O operations

---

## 2. 시스템 아키텍처

### 2.1 아키텍처 다이어그램

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Claude Code   │ <-----> │    MCP Server    │ <-----> │ External Services│
│                 │  STDIO  │                  │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
            ┌───────▼────────┐ ┌────▼─────┐ ┌───────▼────────┐
            │ Code Analyzer  │ │ AI Service│ │ Impact Analyzer│
            └────────────────┘ └───────────┘ └────────────────┘
                    │                │                │
            ┌───────▼────────────────▼────────────────▼───────┐
            │            Data Layer (Vector DB, Cache)         │
            └──────────────────────────────────────────────────┘
```

### 2.2 주요 컴포넌트

| 컴포넌트 | 책임 | 기술 |
|---------|------|------|
| MCP Server | JSON-RPC 통신 처리 | Kotlin, Spring Boot |
| Code Analyzer | 코드 분석 및 인덱싱 | JGit, Parser |
| AI Service | LLM 기반 코드 이해 | Spring AI, OpenAI |
| Vector Store | 코드 임베딩 저장/검색 | ChromaDB |
| Cache Layer | 빈번한 쿼리 캐싱 | Redis |

---

## 3. 개발 환경 설정

### 3.1 사전 요구사항

```bash
# 필수 도구 설치 확인
java -version  # JDK 24 (Virtual Threads 지원)
docker --version
git --version

# GraalVM 설치 확인 (Native Image 빌드용)
gu --version  # GraalVM updater
native-image --version

# ChromaDB 실행
docker run -d -p 8000:8000 --name chromadb chromadb/chroma

# Redis 실행
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

### 3.2 프로젝트 생성

```bash
# Spring Initializr를 사용한 프로젝트 생성
curl https://start.spring.io/starter.zip \
  -d dependencies=web,data-redis,native \
  -d type=gradle-project-kotlin \
  -d language=kotlin \
  -d bootVersion=3.5.5 \
  -d javaVersion=21 \
  -d baseDir=mcp-codebase-analyzer \
  -d groupId=com.yourcompany \
  -d artifactId=mcp-codebase-analyzer \
  -o mcp-codebase-analyzer.zip

unzip mcp-codebase-analyzer.zip
cd mcp-codebase-analyzer
```

### 3.3 build.gradle.kts

```kotlin
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    id("org.springframework.boot") version "3.5.5"
    id("io.spring.dependency-management") version "1.1.7"
    kotlin("jvm") version "2.0.21"
    kotlin("plugin.spring") version "2.0.21"
    id("org.graalvm.buildtools.native") version "0.10.3"
}

group = "com.yourcompany"
version = "1.0.0"
java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(24)
    }
}

repositories {
    mavenCentral()
    maven { url = uri("https://repo.spring.io/milestone") }
    maven { url = uri("https://repo.spring.io/snapshot") }
}

extra["springAiVersion"] = "1.0.1"

dependencies {
    // Spring Boot
    implementation("org.springframework.boot:spring-boot-starter")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-redis")
    
    // Spring AI with BOM
    implementation(platform("org.springframework.ai:spring-ai-bom:${property("springAiVersion")}"))
    implementation("org.springframework.ai:spring-ai-openai-spring-boot-starter")
    implementation("org.springframework.ai:spring-ai-chroma-store-spring-boot-starter")
    
    // Kotlin
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    
    // Git
    implementation("org.eclipse.jgit:org.eclipse.jgit:6.7.0.202309050840-r")
    
    // Code Parsing
    implementation("com.github.javaparser:javaparser-core:3.25.5")
    implementation("org.jetbrains.kotlin:kotlin-compiler-embeddable:2.0.21")
    
    // JSON-RPC
    implementation("com.github.briandilley.jsonrpc4j:jsonrpc4j:1.6")
    
    // ChromaDB Client
    implementation("io.github.amikos-tech:chromadb-java-client:0.1.0")
    
    // Logging
    implementation("io.github.microutils:kotlin-logging-jvm:3.0.5")
    
    // Testing
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test")
    testImplementation("io.mockk:mockk:1.13.8")
}

tasks.withType<KotlinCompile> {
    kotlinOptions {
        freeCompilerArgs = listOf("-Xjsr305=strict")
        jvmTarget = "21"
    }
}

// Virtual Threads 활성화
tasks.withType<JavaExec> {
    jvmArgs("--enable-preview")
}

tasks.withType<Test> {
    jvmArgs("--enable-preview")
}

// AOT 및 Native Image 설정
graalvmNative {
    binaries {
        named("main") {
            imageName.set("mcp-codebase-analyzer")
            buildArgs.add("--enable-preview")
            buildArgs.add("-H:+ReportExceptionStackTraces")
        }
    }
}

// Spring Boot AOT 처리
tasks.withType<org.springframework.boot.gradle.tasks.aot.ProcessAot> {
    args("--enable-preview")
}
```

### 3.4 application.yml

```yaml
spring:
  application:
    name: mcp-codebase-analyzer
  
  ai:
    openai:
      api-key: ${OPENAI_API_KEY}
      chat:
        model: gpt-4
        temperature: 0.3
      embedding:
        model: text-embedding-3-small
  
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}

mcp:
  server:
    mode: ${MCP_MODE:stdio}
    
  vectordb:
    type: chroma
    url: ${CHROMA_URL:http://localhost:8000}
    collection:
      name: codebase
    
  git:
    workspace: ${GIT_WORKSPACE:/tmp/mcp-workspace}
    
  analysis:
    languages:
      - kotlin
      - java
      - typescript
      - javascript
      - python
    max-file-size: 1048576  # 1MB
    exclude-patterns:
      - "**/node_modules/**"
      - "**/build/**"
      - "**/target/**"
      - "**/.git/**"
```

### 3.5 Docker 설정

```dockerfile
# Dockerfile
FROM openjdk:24-jdk-slim as builder
WORKDIR /app
COPY gradlew .
COPY gradle gradle
COPY build.gradle.kts settings.gradle.kts ./
RUN ./gradlew dependencies --no-daemon
COPY src src
RUN ./gradlew bootJar --no-daemon

FROM openjdk:24-jdk-slim
WORKDIR /app
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/build/libs/*.jar app.jar
# Virtual Threads 활성화 (Java 24에서는 기본 활성화)
ENTRYPOINT ["java", "-Dspring.threads.virtual.enabled=true", "-jar", "/app/app.jar"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  mcp-server:
    build: .
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - MCP_MODE=stdio
      - SPRING_PROFILES_ACTIVE=docker
    stdin_open: true
    tty: true
    volumes:
      - ./workspace:/workspace
      - ~/.gitconfig:/root/.gitconfig:ro
      - ~/.ssh:/root/.ssh:ro
    depends_on:
      - chromadb
      - redis
      
  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - chroma-data:/chroma/chroma
      
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
      
volumes:
  chroma-data:
  redis-data:
```

---

## 4. API 명세

### 4.1 JSON-RPC 2.0 Protocol

모든 통신은 JSON-RPC 2.0 프로토콜을 따릅니다.

#### 요청 형식
```json
{
  "jsonrpc": "2.0",
  "method": "method_name",
  "params": { "param1": "value1" },
  "id": 1
}
```

#### 응답 형식
```json
{
  "jsonrpc": "2.0",
  "result": { "data": "response_data" },
  "id": 1
}
```

### 4.2 API 엔드포인트

#### tools/list - 도구 목록 조회
```json
// Request
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}

// Response
{
  "jsonrpc": "2.0",
  "result": {
    "tools": [
      {
        "name": "learn_codebase",
        "description": "코드베이스를 학습하고 인덱싱합니다",
        "inputSchema": { /* ... */ }
      },
      {
        "name": "analyze_branch_diff",
        "description": "브랜치 간 차이점을 분석합니다",
        "inputSchema": { /* ... */ }
      },
      {
        "name": "explain_feature",
        "description": "특정 기능에 대해 설명합니다",
        "inputSchema": { /* ... */ }
      },
      {
        "name": "analyze_impact",
        "description": "변경사항의 영향도를 분석합니다",
        "inputSchema": { /* ... */ }
      }
    ]
  },
  "id": 1
}
```

#### learn_codebase - 코드베이스 학습
```json
// Request
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "learn_codebase",
    "arguments": {
      "repoPath": "/workspace/my-project",
      "branch": "develop"
    }
  },
  "id": 2
}

// Response
{
  "jsonrpc": "2.0",
  "result": {
    "status": "success",
    "data": {
      "filesAnalyzed": 156,
      "featuresExtracted": 23,
      "indexedAt": "2025-01-15T10:30:00Z",
      "branch": "develop",
      "statistics": {
        "totalLines": 45320,
        "languages": {
          "kotlin": 89,
          "java": 34,
          "typescript": 23
        }
      }
    }
  },
  "id": 2
}
```

#### explain_feature - 기능 설명
```json
// Request
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "explain_feature",
    "arguments": {
      "featureName": "예약금 결제 프로세스",
      "detail": "detailed"
    }
  },
  "id": 3
}

// Response
{
  "jsonrpc": "2.0",
  "result": {
    "status": "success",
    "data": {
      "feature": "예약금 결제 프로세스",
      "description": "사용자가 예약 시 예약금을 결제하는 전체 프로세스",
      "process": {
        "steps": [
          {
            "step": 1,
            "description": "예약 정보 확인",
            "components": ["ReservationController", "ReservationService"],
            "files": [
              "src/main/kotlin/controller/ReservationController.kt",
              "src/main/kotlin/service/ReservationService.kt"
            ]
          },
          {
            "step": 2,
            "description": "예약금 계산",
            "components": ["PaymentService", "FeeCalculator"]
          }
        ]
      },
      "dataFlow": {
        "input": {
          "reservationId": "String",
          "amount": "BigDecimal"
        },
        "output": {
          "paymentId": "String",
          "status": "PaymentStatus"
        }
      }
    }
  },
  "id": 3
}
```

#### analyze_impact - 영향도 분석
```json
// Request
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "analyze_impact",
    "arguments": {
      "feature": "예약금",
      "changeDescription": "수수료율을 3%에서 2.5%로 변경",
      "scope": "full"
    }
  },
  "id": 4
}

// Response
{
  "jsonrpc": "2.0",
  "result": {
    "status": "success",
    "data": {
      "feature": "예약금",
      "changeDescription": "수수료율을 3%에서 2.5%로 변경",
      "changeScope": {
        "files": [
          "src/main/kotlin/service/PaymentService.kt",
          "src/main/kotlin/util/FeeCalculator.kt"
        ],
        "estimatedLOC": 45
      },
      "directImpact": {
        "components": [
          {
            "name": "PaymentService",
            "type": "SERVICE",
            "severity": "HIGH"
          }
        ]
      },
      "riskAssessment": {
        "level": "MEDIUM",
        "factors": ["금전 관련 로직 변경"]
      },
      "recommendations": [
        {
          "priority": "HIGH",
          "action": "수수료 계산 로직 단위 테스트 업데이트"
        }
      ],
      "estimatedEffort": {
        "total": "6-8 hours"
      }
    }
  },
  "id": 4
}
```

### 4.3 에러 코드

| 코드 | 의미 | 설명 |
|------|------|------|
| -32700 | Parse error | JSON 파싱 실패 |
| -32600 | Invalid Request | 잘못된 요청 형식 |
| -32601 | Method not found | 존재하지 않는 메서드 |
| -32602 | Invalid params | 잘못된 파라미터 |
| -32603 | Internal error | 서버 내부 오류 |

---

## 5. 데이터 모델

### 5.1 Core Domain Models

```kotlin
// 코드 파일 모델
data class CodeFile(
    val path: String,
    val content: String,
    val language: Language,
    val size: Long,
    val lastModified: Instant,
    val metadata: FileMetadata
)

// 기능 모델
data class Feature(
    val id: String,
    val name: String,
    val description: String,
    val type: FeatureType,
    val components: List<Component>,
    val dataFlow: DataFlow,
    val businessRules: List<BusinessRule>,
    val relatedFiles: List<String>,
    val tags: Set<String>
)

// 컴포넌트 모델
data class Component(
    val id: String,
    val name: String,
    val type: ComponentType,
    val path: String,
    val responsibilities: List<String>,
    val dependencies: List<ComponentDependency>,
    val isCritical: Boolean = false
)

// 영향도 분석 결과
data class ImpactAnalysisResult(
    val id: String,
    val feature: String,
    val changeDescription: String,
    val timestamp: Instant,
    val changeScope: ChangeScope,
    val directImpact: Impact,
    val indirectImpact: Impact,
    val testImpact: TestImpact,
    val riskAssessment: RiskAssessment,
    val recommendations: List<Recommendation>,
    val estimatedEffort: EffortEstimation
)
```

### 5.2 Enums

```kotlin
enum class Language {
    KOTLIN, JAVA, TYPESCRIPT, JAVASCRIPT, PYTHON, GO, RUST, YAML, JSON, XML, MARKDOWN
}

enum class ComponentType {
    SERVICE, CONTROLLER, REPOSITORY, ENTITY, DTO, UTIL, CONFIG, GATEWAY
}

enum class RiskLevel {
    CRITICAL, HIGH, MEDIUM, LOW, MINIMAL
}

enum class ImpactSeverity {
    BREAKING, MAJOR, MINOR, PATCH
}
```

---

## 6. 핵심 구현 코드

### 6.1 MCP Server Core

```kotlin
// src/main/kotlin/com/yourcompany/mcp/server/MCPServer.kt
// Virtual Threads를 활용한 고성능 MCP Server
@Component
@ConditionalOnProperty(name = ["mcp.server.mode"], havingValue = "stdio")
class MCPServer(
    private val codebaseAnalyzer: CodebaseAnalyzer,
    private val branchDiffAnalyzer: BranchDiffAnalyzer,
    private val impactAnalyzer: ImpactAnalyzer,
    private val featureExplainer: FeatureExplainer
) : CommandLineRunner {

    private val objectMapper = ObjectMapper().registerModule(KotlinModule.Builder().build())
    private val reader = BufferedReader(InputStreamReader(System.`in`))
    private val writer = PrintWriter(System.out, true)
    
    override fun run(vararg args: String?) {
        logger.info { "Starting MCP Server in STDIO mode" }
        runBlocking {
            startServer()
        }
    }
    
    private suspend fun startServer() = coroutineScope {
        while (true) {
            try {
                val line = withContext(Dispatchers.IO) {
                    reader.readLine()
                } ?: break
                
                if (line.isBlank()) continue
                
                launch {
                    handleRequest(line)
                }
            } catch (e: Exception) {
                logger.error(e) { "Error reading input" }
            }
        }
    }
    
    private suspend fun handleRequest(input: String) {
        try {
            val request = objectMapper.readValue(input, JsonRpcRequest::class.java)
            val response = processRequest(request)
            sendResponse(response)
        } catch (e: Exception) {
            logger.error(e) { "Error processing request: $input" }
            sendError(JsonRpcError(
                code = -32603,
                message = "Internal error",
                data = mapOf("details" to e.message)
            ))
        }
    }
    
    private suspend fun processRequest(request: JsonRpcRequest): JsonRpcResponse {
        return when (request.method) {
            "tools/list" -> handleToolsList(request)
            "tools/call" -> handleToolCall(request)
            else -> JsonRpcResponse(
                id = request.id,
                error = JsonRpcError(
                    code = -32601,
                    message = "Method not found"
                )
            )
        }
    }
}
```

### 6.2 Codebase Analyzer

```kotlin
// src/main/kotlin/com/yourcompany/mcp/analyzer/CodebaseAnalyzer.kt
@Service
class CodebaseAnalyzer(
    private val gitService: GitService,
    private val codeParser: CodeParser,
    private val aiService: CodeUnderstandingService,
    private val vectorStore: VectorStoreRepository
) {
    
    suspend fun analyzeAndIndex(
        repoPath: String,
        branch: String = "develop",
        forceReindex: Boolean = false
    ): CodebaseLearnResult = coroutineScope {
        
        logger.info { "Starting codebase analysis for $repoPath on branch $branch" }
        
        // Git checkout
        gitService.checkout(repoPath, branch)
        
        // Scan files
        val files = scanFiles(repoPath)
        logger.info { "Found ${files.size} files to analyze" }
        
        // Parallel analysis
        val analyzedFiles = files
            .chunked(10)
            .map { chunk ->
                async {
                    chunk.map { file ->
                        analyzeFile(file)
                    }
                }
            }
            .awaitAll()
            .flatten()
        
        // Extract features using AI
        val features = aiService.extractFeatures(analyzedFiles)
        
        // Store in vector DB
        storeInVectorDB(analyzedFiles, features)
        
        // Build dependency graph
        val dependencyGraph = buildDependencyGraph(analyzedFiles)
        
        CodebaseLearnResult(
            filesAnalyzed = analyzedFiles.size,
            featuresExtracted = features.size,
            indexedAt = Instant.now(),
            branch = branch
        )
    }
    
    private suspend fun analyzeFile(file: File): CodeFile {
        return withContext(Dispatchers.IO) {
            val content = file.readText()
            val language = detectLanguage(file)
            val metadata = codeParser.parse(content, language)
            
            CodeFile(
                path = file.path,
                content = content,
                language = language,
                size = file.length(),
                lastModified = Instant.ofEpochMilli(file.lastModified()),
                metadata = metadata
            )
        }
    }
}
```

### 6.3 Spring AI Integration

```kotlin
// src/main/kotlin/com/yourcompany/mcp/ai/CodeUnderstandingService.kt
@Service
class CodeUnderstandingService(
    private val chatClient: ChatClient,
    private val embeddingClient: EmbeddingClient,
    private val vectorStore: VectorStore
) {
    
    suspend fun extractFeatures(files: List<CodeFile>): List<Feature> {
        logger.info { "Extracting features from ${files.size} files" }
        
        val fileGroups = groupFilesByFeature(files)
        val features = mutableListOf<Feature>()
        
        for ((groupName, groupFiles) in fileGroups) {
            val feature = analyzeFeatureGroup(groupName, groupFiles)
            if (feature != null) {
                features.add(feature)
            }
        }
        
        return features
    }
    
    suspend fun generateEmbeddings(texts: List<String>): List<List<Float>> {
        return withContext(Dispatchers.IO) {
            texts.map { text ->
                embeddingClient.embed(text).toList()
            }
        }
    }
    
    suspend fun identifyChangeTargets(
        feature: String,
        changeDescription: String,
        relevantCode: List<SearchResult>
    ): List<Component> {
        val prompt = """
            기능: $feature
            변경 내용: $changeDescription
            
            관련 코드:
            ${relevantCode.joinToString("\n") { it.document.content.take(200) }}
            
            변경이 필요한 컴포넌트를 식별해주세요.
        """.trimIndent()
        
        val response = chatClient.call(Prompt(prompt))
        return parseComponentsFromResponse(response.result.output.content)
    }
}
```

### 6.4 Impact Analyzer

```kotlin
// src/main/kotlin/com/yourcompany/mcp/analyzer/ImpactAnalyzer.kt
@Service
class ImpactAnalyzer(
    private val vectorStore: VectorStoreRepository,
    private val aiService: CodeUnderstandingService,
    private val dependencyService: DependencyService
) {
    
    suspend fun analyzeImpact(
        feature: String,
        changeDescription: String,
        scope: AnalysisScope = AnalysisScope.FULL
    ): ImpactAnalysisResult = coroutineScope {
        
        // Find relevant code using vector search
        val relevantCode = vectorStore.searchByFeature(feature, limit = 20)
        
        // Identify change targets using AI
        val targets = aiService.identifyChangeTargets(feature, changeDescription, relevantCode)
        
        // Analyze dependencies
        val dependencies = async { dependencyService.findDependencies(targets) }
        val dependents = async { dependencyService.findDependents(targets) }
        
        // Calculate impacts
        val directImpact = calculateDirectImpact(targets, dependents.await())
        val indirectImpact = calculateIndirectImpact(directImpact, dependents.await())
        
        // Assess risk
        val risk = assessRisk(directImpact, indirectImpact, changeDescription)
        
        // Generate recommendations
        val recommendations = aiService.generateRecommendations(
            feature, changeDescription, directImpact, indirectImpact, risk
        )
        
        ImpactAnalysisResult(
            id = generateId(),
            feature = feature,
            changeDescription = changeDescription,
            timestamp = Instant.now(),
            changeScope = extractChangeScope(targets),
            directImpact = directImpact,
            indirectImpact = indirectImpact,
            testImpact = analyzeTestImpact(targets),
            riskAssessment = risk,
            recommendations = recommendations,
            estimatedEffort = estimateEffort(directImpact, indirectImpact)
        )
    }
}
```

---

## 7. 배포 가이드

### 7.1 로컬 개발 환경

```bash
# 의존성 서비스 시작
docker-compose up -d chromadb redis

# 애플리케이션 빌드
./gradlew clean build

# 애플리케이션 실행
./gradlew bootRun
```

### 7.2 Docker 배포

```bash
# Docker 이미지 빌드
docker build -t mcp-codebase-analyzer:latest .

# Docker Compose로 전체 스택 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f mcp-server
```

### 7.3 Claude Code 통합

```json
// ~/.config/claude/claude_desktop_config.json
{
  "mcpServers": {
    "codebase-analyzer": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "--env-file", ".env",
        "-v", "${HOME}/.ssh:/root/.ssh:ro",
        "-v", "${HOME}/.gitconfig:/root/.gitconfig:ro",
        "-v", "./workspace:/workspace",
        "mcp-codebase-analyzer:latest"
      ]
    }
  }
}
```

### 7.4 Kubernetes 배포

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-server
  namespace: mcp-system
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mcp-server
  template:
    metadata:
      labels:
        app: mcp-server
    spec:
      containers:
      - name: mcp-server
        image: mcp-codebase-analyzer:latest
        env:
        - name: SPRING_PROFILES_ACTIVE
          value: "k8s"
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: mcp-secrets
              key: openai-api-key
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
```

### 7.5 프로덕션 체크리스트

#### 보안
- [ ] API 키 안전 관리 (Vault, Secret Manager)
- [ ] Redis 패스워드 설정
- [ ] 네트워크 정책 설정
- [ ] TLS/SSL 인증서 적용

#### 모니터링
- [ ] Prometheus 메트릭 설정
- [ ] Grafana 대시보드 구성
- [ ] 로그 수집 (ELK Stack)
- [ ] 알림 설정

#### 성능
- [ ] JVM 힙 사이즈 최적화
- [ ] Redis 메모리 설정
- [ ] ChromaDB 인덱싱 최적화

---

## 8. 테스트 가이드

### 8.1 단위 테스트

```kotlin
// src/test/kotlin/com/yourcompany/mcp/analyzer/CodebaseAnalyzerTest.kt
class CodebaseAnalyzerTest {
    
    @Test
    fun `analyzeAndIndex should process repository successfully`() = runTest {
        // Given
        val repoPath = "/test/repo"
        val branch = "develop"
        
        coEvery { gitService.checkout(repoPath, branch) } just Runs
        coEvery { vectorStore.getIndexStatus(repoPath, branch) } returns null
        
        // When
        val result = analyzer.analyzeAndIndex(repoPath, branch)
        
        // Then
        assertNotNull(result)
        assertEquals(1, result.filesAnalyzed)
        assertEquals(branch, result.branch)
    }
}
```

### 8.2 통합 테스트

```kotlin
// src/test/kotlin/com/yourcompany/mcp/integration/MCPServerIntegrationTest.kt
@SpringBootTest
@ActiveProfiles("test")
@Testcontainers
class MCPServerIntegrationTest {
    
    @Container
    val chromaDB = GenericContainer("chromadb/chroma:latest")
        .withExposedPorts(8000)
    
    @Test
    fun `tools list should return available tools`() {
        val request = JsonRpcRequest(method = "tools/list", id = 1)
        val response = sendRequest(request)
        
        assertNotNull(response.result)
        val tools = response.result as Map<*, *>
        assertTrue(tools.containsKey("tools"))
    }
}
```

### 8.3 E2E 테스트

```kotlin
// src/test/kotlin/com/yourcompany/mcp/e2e/MCPEndToEndTest.kt
@SpringBootTest
class MCPEndToEndTest {
    
    @Test
    fun `complete workflow from code analysis to impact analysis`(@TempDir tempDir: File) {
        // Setup test repository
        setupTestRepository(tempDir)
        
        // Test 1: Learn codebase
        val learnResponse = executeRequest("""
            {
                "jsonrpc": "2.0",
                "method": "tools/call",
                "params": {
                    "name": "learn_codebase",
                    "arguments": {
                        "repoPath": "${tempDir.absolutePath}",
                        "branch": "main"
                    }
                },
                "id": 1
            }
        """.trimIndent())
        
        assertTrue(learnResponse.contains("success"))
    }
}
```

### 8.4 테스트 실행

```bash
# 단위 테스트
./gradlew test

# 통합 테스트
./gradlew integrationTest

# 전체 테스트 with 커버리지
./gradlew test jacocoTestReport

# 테스트 리포트 확인
open build/reports/tests/test/index.html
```

---

## 부록 A: 문제 해결

### ChromaDB 연결 실패
```bash
docker logs chromadb
docker network inspect bridge
docker-compose restart chromadb
```

### 메모리 부족
```bash
# Docker 메모리 증가
docker update --memory="4g" mcp-server

# JVM 옵션 조정
JAVA_OPTS="-Xmx2g -Xms1g" java -jar app.jar
```

### Git 권한 문제
```bash
chmod 600 ~/.ssh/id_rsa
git config --global user.email "mcp@example.com"
git config --global user.name "MCP Bot"
```

---

## 부록 B: 성능 튜닝

### JVM 최적화
```bash
JAVA_OPTS="
  -Xms2g 
  -Xmx4g 
  -XX:+UseG1GC 
  -XX:MaxGCPauseMillis=200 
  -XX:+HeapDumpOnOutOfMemoryError
"
```

### Redis 최적화
```conf
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
```

---

## 부록 C: 참고 자료

- [MCP Protocol Specification](https://modelcontextprotocol.io)
- [Spring AI Documentation](https://spring.io/projects/spring-ai)
- [ChromaDB Documentation](https://docs.trychroma.com)
- [Kotlin Coroutines Guide](https://kotlinlang.org/docs/coroutines-guide.html)

---

## 라이센스

MIT License

Copyright (c) 2025 Your Company

---

## 기여 가이드

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 연락처

- 프로젝트 관리자: your-email@example.com
- 이슈 트래커: https://github.com/yourcompany/mcp-codebase-analyzer/issues
- 문서: https://docs.yourcompany.com/mcp

---

*이 문서는 MCP Codebase Analyzer v1.0.0 기준으로 작성되었습니다.*
*최종 업데이트: 2025년 1월*