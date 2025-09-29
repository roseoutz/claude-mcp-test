# 🤖 AI 기반 코드 분석

> AI를 활용한 코드 분석, 설명 생성, 그리고 메타데이터 추출

## 🎯 개요

지능형 코드 검색 시스템의 AI 분석 기능은 다음과 같은 작업을 수행합니다:

- **📝 설명 생성**: 모든 클래스와 함수에 대한 자연어 설명
- **🏷️ 키워드 추출**: 검색에 활용되는 키워드 자동 생성
- **📊 도메인 분류**: 코드를 기능별 도메인으로 자동 분류
- **🔍 목적 분석**: 코드의 목적과 역할 파악

## 🚀 기본 분석 프로세스

### 1. 코드베이스 분석 시작

```typescript
import {
  IntelligentCodeAnalyzerService,
  AIService,
  ElasticsearchVectorStore
} from '@code-ai/shared/services';

const aiService = new AIService();
const vectorStore = new ElasticsearchVectorStore('my-project');
const analyzer = new IntelligentCodeAnalyzerService(aiService, vectorStore);

await analyzer.initialize();

// AI 기반 분석 시작
const result = await analyzer.analyzeCodebase({
  repositoryPath: '/path/to/your/project',
  generateDescriptions: true,  // 🤖 AI 설명 생성 활성화
  maxFiles: 100,

  // 진행 상황 모니터링
  onProgress: (progress) => {
    console.log(`${progress.phase}: ${progress.percentage.toFixed(1)}%`);

    if (progress.phase === 'ai_analysis') {
      console.log(`AI 분석 중: ${progress.processed}/${progress.total} 파일`);
    }
  }
});
```

### 2. 분석 단계별 설명

```
📂 파일 수집 → 🔍 코드 파싱 → 🤖 AI 분석 → 💾 인덱싱
     ↓              ↓             ↓           ↓
   파일 탐색      AST 생성    설명/키워드    벡터 저장
                              도메인 분류
```

## 🧠 AI 분석 상세 기능

### 설명 생성 (Description Generation)

AI가 각 코드 요소에 대해 생성하는 설명입니다.

#### 클래스 설명 예시
```typescript
// 입력 코드
class UserAuthService {
  async login(username: string, password: string) {
    // 로그인 로직
  }

  async register(userData: RegisterData) {
    // 회원가입 로직
  }
}

// AI 생성 설명
{
  name: "UserAuthService",
  description: "사용자 인증과 계정 관리를 담당하는 서비스 클래스입니다",
  purpose: "로그인, 회원가입, 토큰 관리 등 사용자 인증 관련 기능을 제공합니다",
  keywords: ["user", "authentication", "login", "register", "사용자", "인증", "로그인"]
}
```

#### 함수 설명 예시
```typescript
// 입력 코드
async function validatePayment(paymentData: PaymentRequest): Promise<boolean> {
  // 결제 검증 로직
}

// AI 생성 설명
{
  name: "validatePayment",
  description: "결제 정보를 검증하고 유효성을 확인하는 비동기 함수입니다",
  purpose: "결제 데이터의 형식, 금액, 카드 정보 등을 검증하여 안전한 거래를 보장합니다",
  keywords: ["payment", "validation", "verify", "결제", "검증", "유효성"]
}
```

### 도메인 분류 (Domain Classification)

AI가 코드를 기능별 도메인으로 자동 분류합니다.

#### 지원되는 도메인
```typescript
const SUPPORTED_DOMAINS = [
  'authentication',  // 인증, 로그인
  'user',           // 사용자 관리
  'payment',        // 결제, 거래
  'database',       // 데이터베이스
  'api',            // API, 엔드포인트
  'ui',             // UI, 화면
  'test',           // 테스트
  'utils',          // 유틸리티
  'config',         // 설정
  'security',       // 보안
  'notification',   // 알림
  'file',           // 파일 처리
  'email',          // 이메일
  'logging',        // 로깅
  'cache'           // 캐싱
];
```

#### 도메인 분류 예시
```typescript
// PaymentService → 'payment' 도메인
// UserRepository → 'user' + 'database' 도메인
// AuthController → 'authentication' + 'api' 도메인
// EmailUtil → 'email' + 'utils' 도메인
```

### 키워드 매핑 (Keyword Mapping)

한국어와 영어 키워드를 자동으로 매핑하여 다국어 검색을 지원합니다.

#### 키워드 매핑 예시
```typescript
const keywordMapping = {
  "사용자": ["user", "member", "customer"],
  "인증": ["auth", "authentication", "login"],
  "결제": ["payment", "billing", "transaction"],
  "데이터베이스": ["database", "db", "storage"],
  "설정": ["config", "configuration", "settings"]
};

// AI가 "사용자 인증 서비스" 분석 시:
// → ["user", "authentication", "service", "사용자", "인증", "서비스"]
```

## ⚙️ AI 분석 설정

### AI 모델 설정

```typescript
// OpenAI 설정
const aiService = new AIService({
  provider: 'openai',
  model: 'gpt-4-turbo',
  temperature: 0.1,  // 일관된 결과를 위해 낮은 값
  maxTokens: 1000
});

// Anthropic Claude 설정 (선택사항)
const claudeService = new AIService({
  provider: 'anthropic',
  model: 'claude-3-sonnet',
  temperature: 0.1
});
```

### 분석 옵션

```typescript
const analysisOptions = {
  generateDescriptions: true,     // 설명 생성
  extractKeywords: true,          // 키워드 추출
  classifyDomain: true,           // 도메인 분류
  analyzePurpose: true,           // 목적 분석

  // AI 프롬프트 설정
  descriptionLanguage: 'korean',  // 설명 언어
  includeContext: true,           // 컨텍스트 포함
  maxDescriptionLength: 200,      // 설명 최대 길이

  // 배치 처리 설정
  batchSize: 10,                  // 동시 처리 개수
  rateLimitDelay: 1000           // API 호출 간격 (ms)
};
```

## 🎨 커스텀 프롬프트

### 프롬프트 커스터마이징

분석 품질을 높이기 위해 프롬프트를 커스터마이징할 수 있습니다.

```yaml
# src/prompts/code-analysis-prompts.yaml
analysis_prompts:
  class_analysis:
    template: |
      다음 TypeScript 클래스를 분석하고 JSON 형태로 응답해주세요:

      클래스명: {name}
      파일경로: {filePath}

      코드:
      ```typescript
      {codeContent}
      ```

      다음 형식으로 응답해주세요:
      {{
        "name": "클래스명",
        "description": "한국어로 클래스의 역할과 목적을 간단히 설명",
        "purpose": "클래스가 제공하는 주요 기능들을 구체적으로 설명",
        "keywords": ["관련", "키워드", "배열"],
        "domain": "주요 도메인 (authentication, user, payment 등)",
        "confidence": 0.95
      }}

  function_analysis:
    template: |
      다음 TypeScript 함수를 분석해주세요:

      함수명: {name}
      매개변수: {parameters}
      반환타입: {returnType}

      코드:
      ```typescript
      {codeContent}
      ```

      JSON 형식으로 응답:
      {{
        "name": "함수명",
        "description": "함수의 기능을 한국어로 설명",
        "purpose": "함수의 구체적인 목적과 사용 용도",
        "keywords": ["함수", "관련", "키워드"],
        "domain": "해당 도메인",
        "confidence": 0.90
      }}
```

### 프롬프트 테스트

```typescript
import { PromptManagerService } from '@code-ai/shared/services';

const promptManager = new PromptManagerService();

// 특정 코드에 대한 프롬프트 생성
const prompt = promptManager.generateAnalysisPrompt({
  type: 'class',
  name: 'UserService',
  codeContent: 'class UserService { ... }',
  filePath: '/src/services/user.service.ts'
});

console.log('생성된 프롬프트:', prompt);

// AI에 직접 전송하여 테스트
const response = await aiService.chat([{
  role: 'user',
  content: prompt
}]);

console.log('AI 응답:', response);
```

## 📊 분석 품질 관리

### 신뢰도 점수

AI가 생성한 각 메타데이터에는 신뢰도 점수가 포함됩니다.

```typescript
interface AnalysisResult {
  confidence: number;  // 0.0 - 1.0
  metadata: {
    name: string;
    description?: string;
    // ... 기타 메타데이터
  };
}

// 높은 신뢰도 결과만 필터링
const highQualityResults = results.filter(r =>
  r.metadata.semanticMetadata?.confidence! > 0.8
);
```

### 분석 품질 검증

```typescript
async function validateAnalysisQuality(results: AnalysisResult[]) {
  const qualityMetrics = {
    averageConfidence: 0,
    descriptionCoverage: 0,    // 설명이 있는 비율
    keywordDensity: 0,         // 평균 키워드 개수
    domainClassification: 0    // 도메인이 분류된 비율
  };

  // 메트릭 계산
  const total = results.length;
  let confidenceSum = 0;
  let withDescription = 0;
  let totalKeywords = 0;
  let withDomain = 0;

  results.forEach(result => {
    const meta = result.metadata.semanticMetadata;
    if (meta) {
      confidenceSum += meta.confidence || 0;
      if (meta.description) withDescription++;
      if (meta.keywords) totalKeywords += meta.keywords.length;
      if (meta.domain) withDomain++;
    }
  });

  qualityMetrics.averageConfidence = confidenceSum / total;
  qualityMetrics.descriptionCoverage = withDescription / total;
  qualityMetrics.keywordDensity = totalKeywords / total;
  qualityMetrics.domainClassification = withDomain / total;

  return qualityMetrics;
}

// 사용 예시
const qualityReport = await validateAnalysisQuality(analysisResults);
console.log('분석 품질 리포트:', qualityReport);
```

## 🚀 성능 최적화

### 배치 처리

```typescript
// 효율적인 배치 처리
const batchAnalyzer = new BatchAnalysisService(aiService, {
  batchSize: 5,           // 동시 처리 개수
  delayBetweenBatches: 1000,  // 배치 간 대기시간
  retryCount: 3           // 실패 시 재시도
});

const results = await batchAnalyzer.analyzeFiles(filesToAnalyze);
```

### 캐싱

```typescript
// 분석 결과 캐싱
const cachedAnalyzer = new CachedAnalysisService(aiService, {
  cacheDir: './cache/ai-analysis',
  ttl: 86400000,  // 24시간 캐시
  strategy: 'content-hash'  // 파일 내용 해시 기반 캐싱
});

// 동일한 파일은 캐시에서 로드
const cachedResult = await cachedAnalyzer.analyzeFile(filePath);
```

### 점진적 분석

```typescript
// 큰 프로젝트를 위한 점진적 분석
const incrementalAnalyzer = new IncrementalAnalysisService(analyzer, {
  chunkSize: 50,          // 한 번에 50개 파일씩
  saveInterval: 10,       // 10개마다 중간 저장
  resumeOnFailure: true   // 실패 시 중단점부터 재개
});

await incrementalAnalyzer.analyzeCodebase({
  repositoryPath: '/large/project',
  generateDescriptions: true,

  onChunkComplete: (chunk, progress) => {
    console.log(`청크 ${chunk} 완료: ${progress.percentage}%`);
  }
});
```

## 🔍 고급 분석 기능

### 관계 분석

```typescript
// 코드 간 관계 분석
const relationshipAnalyzer = new CodeRelationshipAnalyzer(aiService);

const relationships = await relationshipAnalyzer.analyzeRelationships({
  targetClass: 'UserService',
  analysisDepth: 2,  // 2단계까지 분석
  includeTypes: ['extends', 'implements', 'imports', 'calls']
});

// 결과 예시
// {
//   extends: ['BaseService'],
//   implements: ['IUserService'],
//   imports: ['UserModel', 'DatabaseService'],
//   calls: ['validateUser', 'saveUser'],
//   calledBy: ['UserController', 'AuthService']
// }
```

### 패턴 분석

```typescript
// 디자인 패턴 감지
const patternAnalyzer = new PatternAnalysisService(aiService);

const patterns = await patternAnalyzer.detectPatterns(codeElement);

// 결과 예시
// {
//   patterns: ['Factory Pattern', 'Observer Pattern'],
//   confidence: 0.85,
//   explanation: "이 클래스는 팩토리 패턴을 사용하여 객체를 생성하고..."
// }
```

## 🐛 문제 해결

### 일반적인 문제들

#### 1. API 요청 한도 초과
```typescript
// 요청 속도 제한
const rateLimitedService = new AIService({
  rateLimit: {
    requests: 50,     // 분당 50개 요청
    window: 60000     // 1분 윈도우
  }
});
```

#### 2. 분석 품질이 낮은 경우
```typescript
// 더 구체적인 프롬프트 사용
const improvedPrompt = `
  다음 코드를 분석할 때 특히 다음 사항들을 고려해주세요:
  1. 함수의 구체적인 비즈니스 로직
  2. 사용되는 디자인 패턴
  3. 에러 처리 방식
  4. 성능 고려사항

  코드: {codeContent}
`;
```

#### 3. 메모리 사용량 과다
```typescript
// 스트리밍 처리
const streamingAnalyzer = new StreamingAnalysisService(aiService);

await streamingAnalyzer.analyzeCodebase({
  repositoryPath: '/path/to/project',
  streamResults: true,  // 결과를 스트림으로 처리
  memoryLimit: '2GB'
});
```

---

AI 기반 코드 분석을 통해 더 정확하고 의미 있는 코드 검색 경험을 만들어보세요! 🤖✨