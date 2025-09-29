# ⚡ 5분만에 시작하는 지능형 코드 검색

> 자연어로 "사용자 로그인 처리"라고 검색해서 관련 코드를 찾아보세요!

## 🎯 무엇을 할 수 있나요?

- **🗣️ 자연어 검색**: "결제 처리", "데이터베이스 연결" 같은 일상 표현으로 코드 검색
- **🤖 AI 설명**: 모든 함수와 클래스에 자동 생성된 한국어 설명
- **🔍 스마트 매핑**: 한국어 ↔ 영어 키워드 자동 변환
- **📊 도메인 분류**: authentication, user, payment 등으로 코드 자동 분류

## 🚀 1단계: 환경 설정

### 필수 요구사항
- Node.js 22+
- OpenAI API 키 (필수)
- Docker (선택사항, Elasticsearch용)

### API 키 설정
```bash
# .env 파일에 추가
OPENAI_API_KEY="your-openai-api-key"
```

## 🚀 2단계: 설치

```bash
# 저장소 클론
git clone <your-repo-url>
cd code-ai-mcp-node

# 의존성 설치
npm install

# 빌드
npm run build
```

## 🚀 3단계: 첫 번째 분석

```typescript
import {
  IntelligentCodeAnalyzerService,
  AIService,
  ElasticsearchVectorStore
} from '@code-ai/shared/services';

async function main() {
  // 1. 서비스 초기화
  const aiService = new AIService();
  const vectorStore = new ElasticsearchVectorStore('my-project');
  const analyzer = new IntelligentCodeAnalyzerService(aiService, vectorStore);

  await analyzer.initialize();

  // 2. 프로젝트 분석 (최초 1회, 5-10분 소요)
  console.log('📂 코드베이스 분석 시작...');

  const result = await analyzer.analyzeCodebase({
    repositoryPath: '/path/to/your/project',
    includePatterns: ['**/*.{ts,js,tsx,jsx}'],
    excludePatterns: ['node_modules/**', 'dist/**'],
    generateDescriptions: true, // AI 설명 생성
    maxFiles: 100, // 처음엔 100개 파일로 테스트

    // 진행상황 표시
    onProgress: (progress) => {
      console.log(`${progress.phase}: ${progress.percentage.toFixed(1)}%`);
    }
  });

  if (result.success) {
    console.log(`✅ 분석 완료!`);
    console.log(`📊 ${result.summary.elementsAnalyzed}개 코드 요소 분석`);
    console.log(`🤖 ${result.summary.descriptionsGenerated}개 AI 설명 생성`);
  }
}

main().catch(console.error);
```

## 🚀 4단계: 첫 번째 검색

```typescript
// 한국어 자연어 검색
const results = await analyzer.searchCode({
  query: '사용자 로그인 처리',
  size: 5
});

console.log(`🔍 "${results.query}" 검색 결과:`);
results.results.forEach((result, index) => {
  const meta = result.metadata.semanticMetadata;
  console.log(`${index + 1}. 📄 ${meta?.name}`);
  console.log(`   💡 ${meta?.description}`);
  console.log(`   🏷️ ${meta?.keywords?.join(', ')}`);
  console.log(`   📍 ${result.metadata.filePath}`);
  console.log('');
});
```

## 🎉 결과 예시

```
🔍 "사용자 로그인 처리" 검색 결과:

1. 📄 UserAuthService
   💡 사용자 인증과 로그인을 처리하는 핵심 서비스 클래스입니다
   🏷️ user, login, authentication, 사용자, 인증, 로그인
   📍 /src/services/user-auth.service.ts

2. 📄 LoginController
   💡 로그인 요청을 받아 인증을 처리하는 컨트롤러입니다
   🏷️ controller, login, endpoint, 컨트롤러, 로그인
   📍 /src/controllers/login.controller.ts

3. 📄 validateCredentials
   💡 사용자 자격증명을 검증하는 함수입니다
   🏷️ validation, credentials, security, 검증, 보안
   📍 /src/utils/auth-validation.ts
```

## 🔄 고급 검색 사용해보기

### 도메인별 탐색
```typescript
// 인증 관련 모든 코드 찾기
const authCode = await analyzer.exploreByDomain('authentication', {
  size: 10,
  elementTypes: ['class', 'function']
});

console.log('🔐 인증 도메인 코드들:');
authCode.forEach(code => {
  console.log(`- ${code.metadata.semanticMetadata?.name}`);
});
```

### 유사한 코드 찾기
```typescript
// 특정 함수와 비슷한 다른 함수들 찾기
const similar = await analyzer.findSimilarCode('UserAuthService.login', {
  size: 5
});

console.log('🔗 유사한 코드들:');
similar.forEach(code => {
  console.log(`- ${code.metadata.semanticMetadata?.name}`);
});
```

## 📊 Docker로 Elasticsearch 실행 (선택사항)

더 나은 검색 성능을 원한다면:

```bash
# Elasticsearch 실행
docker-compose up elasticsearch -d

# 환경변수 추가
echo "ELASTICSEARCH_URL=http://localhost:9200" >> .env
```

## 🎯 다음 단계

축하합니다! 이제 지능형 코드 검색을 사용할 수 있습니다.

### 더 알아보기:
- 📖 [상세 사용법](./intelligent-search.md) - 모든 검색 옵션과 필터
- 🤖 [AI 분석 가이드](./ai-analysis.md) - AI 설명 최적화 방법
- 🛠️ [개발자 가이드](./developer-guide.md) - 커스터마이징과 확장
- ⚙️ [설정 최적화](../reference/configuration.md) - 성능 튜닝

### 문제가 있나요?
- 🐛 [문제 해결](./troubleshooting.md) - 일반적인 문제와 해결법
- 💬 [커뮤니티](https://github.com/your-repo/discussions) - 질문하고 도움받기

---

**🎉 이제 자연어로 코드를 검색하는 새로운 개발 경험을 시작하세요!**