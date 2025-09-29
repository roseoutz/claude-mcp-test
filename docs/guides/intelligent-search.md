# 🧠 지능형 검색 사용법

> 자연어로 코드를 검색하고 AI가 생성한 메타데이터를 활용하는 방법

## 🎯 개요

지능형 코드 검색 시스템은 다음과 같은 특징을 가집니다:

- **🗣️ 자연어 검색**: "사용자 로그인", "결제 처리" 등 일상적인 표현으로 검색
- **🤖 AI 메타데이터**: 모든 코드 요소에 AI가 생성한 설명과 키워드
- **🔍 하이브리드 검색**: 벡터 검색 + 키워드 검색을 최적으로 결합
- **🌍 다국어 지원**: 한국어 ↔ 영어 키워드 자동 매핑

## 🚀 기본 검색

### 간단한 검색

```typescript
const results = await analyzer.searchCode({
  query: '사용자 인증 처리'
});

results.results.forEach(result => {
  const meta = result.metadata.semanticMetadata;
  console.log(`📄 ${meta?.name}`);
  console.log(`💡 ${meta?.description}`);
  console.log(`🏷️ ${meta?.keywords?.join(', ')}`);
  console.log(`📍 ${result.metadata.filePath}`);
  console.log('');
});
```

### 검색 결과 예시

```
🔍 "사용자 인증 처리" 검색 결과:

1. 📄 UserAuthService
   💡 사용자 인증과 로그인을 처리하는 핵심 서비스 클래스입니다
   🏷️ user, authentication, login, service, 사용자, 인증
   📍 /src/services/user-auth.service.ts

2. 📄 authenticateUser
   💡 사용자 자격증명을 검증하고 JWT 토큰을 생성하는 함수입니다
   🏷️ authentication, jwt, token, validation, 인증, 토큰
   📍 /src/utils/auth-helpers.ts
```

## 🔍 고급 검색 옵션

### 검색 모드 설정

```typescript
// 1. 의미적 검색 (벡터 검색)
const semanticResults = await analyzer.searchCode({
  query: '사용자 로그인',
  searchMode: 'semantic'
});

// 2. 키워드 검색 (정확한 매칭)
const keywordResults = await analyzer.searchCode({
  query: 'UserAuthService',
  searchMode: 'keyword'
});

// 3. 하이브리드 검색 (기본값, 가장 효과적)
const hybridResults = await analyzer.searchCode({
  query: '사용자 로그인',
  searchMode: 'hybrid'  // 기본값
});
```

### 도메인별 검색

```typescript
// 인증 도메인만 검색
const authResults = await analyzer.searchCode({
  query: '사용자 처리',
  domains: ['authentication']
});

// 여러 도메인 검색
const multiDomainResults = await analyzer.searchCode({
  query: 'API 처리',
  domains: ['api', 'controller', 'service']
});
```

### 요소 타입별 검색

```typescript
// 클래스만 검색
const classResults = await analyzer.searchCode({
  query: '사용자 서비스',
  elementTypes: ['class']
});

// 함수와 메서드만 검색
const functionResults = await analyzer.searchCode({
  query: '로그인 처리',
  elementTypes: ['function', 'method']
});
```

### 가중치 조정

```typescript
// 의미적 검색에 더 큰 가중치
const semanticBiased = await analyzer.searchCode({
  query: '데이터베이스 연결',
  weights: {
    semantic: 0.7,
    keyword: 0.3
  }
});

// 키워드 검색에 더 큰 가중치
const keywordBiased = await analyzer.searchCode({
  query: 'DatabaseConnection',
  weights: {
    semantic: 0.3,
    keyword: 0.7
  }
});
```

## 🌟 특별 기능

### 도메인 탐색

특정 도메인의 모든 코드를 탐색합니다.

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

기존 코드와 유사한 다른 코드를 찾습니다.

```typescript
// 특정 함수와 비슷한 다른 함수들 찾기
const similar = await analyzer.findSimilarCode('UserAuthService.login', {
  size: 5,
  threshold: 0.8  // 유사도 임계값 (0.0-1.0)
});

console.log('🔗 유사한 코드들:');
similar.forEach(code => {
  const meta = code.metadata.semanticMetadata;
  console.log(`- ${meta?.name}: ${meta?.description}`);
});
```

## 📊 검색 팁과 베스트 프랙티스

### 1. 효과적인 검색어

#### ✅ 좋은 검색어 예시
- "사용자 로그인 처리"
- "결제 검증 로직"
- "데이터베이스 연결 설정"
- "API 에러 핸들링"

#### ❌ 피해야 할 검색어
- "a", "the", "get" (너무 일반적)
- "asdfgh" (무의미한 문자열)
- 너무 긴 문장 (20단어 이상)

### 2. 단계별 검색 전략

```typescript
// 1단계: 넓은 범위로 검색
let results = await analyzer.searchCode({
  query: '사용자 관리',
  size: 20
});

// 2단계: 도메인으로 범위 좁히기
if (results.results.length > 10) {
  results = await analyzer.searchCode({
    query: '사용자 관리',
    domains: ['user', 'authentication'],
    size: 10
  });
}

// 3단계: 요소 타입으로 더 구체화
if (results.results.length > 5) {
  results = await analyzer.searchCode({
    query: '사용자 관리',
    domains: ['user'],
    elementTypes: ['class'],
    size: 5
  });
}
```

### 3. 다국어 활용

```typescript
// 한국어로 검색
const koreanResults = await analyzer.searchCode({
  query: '사용자 인증 시스템'
});

// 영어로 검색 (같은 결과를 얻을 수 있음)
const englishResults = await analyzer.searchCode({
  query: 'user authentication system'
});

// 혼합 사용
const mixedResults = await analyzer.searchCode({
  query: '사용자 authentication service'
});
```

## 🎨 검색 결과 활용

### 검색 결과 구조

```typescript
interface SearchResult {
  metadata: {
    filePath: string;           // 파일 경로
    startLine: number;          // 시작 줄 번호
    endLine: number;            // 끝 줄 번호
    semanticMetadata?: {
      name: string;             // 코드 요소 이름
      elementType: string;      // class, function, method 등
      description?: string;     // AI 생성 설명
      purpose?: string;         // 목적 설명
      keywords?: string[];      // 키워드 배열
      domain?: string;          // 도메인 분류
      confidence?: number;      // AI 신뢰도 (0.0-1.0)
    }
  };
  content: string;              // 실제 코드 내용
  score: number;                // 검색 점수 (0.0-1.0)
}
```

### 결과 필터링 및 정렬

```typescript
const results = await analyzer.searchCode({
  query: '사용자 처리',
  size: 50
});

// 신뢰도 높은 결과만 필터링
const highConfidence = results.results.filter(result =>
  result.metadata.semanticMetadata?.confidence! > 0.8
);

// 점수별 정렬 (이미 정렬되어 있지만 재정렬 예시)
const sortedByScore = results.results.sort((a, b) => b.score - a.score);

// 도메인별 그룹화
const groupedByDomain = results.results.reduce((acc, result) => {
  const domain = result.metadata.semanticMetadata?.domain || 'unknown';
  if (!acc[domain]) acc[domain] = [];
  acc[domain].push(result);
  return acc;
}, {} as Record<string, typeof results.results>);
```

## 🔧 검색 최적화

### 성능 최적화

```typescript
// 1. 적절한 검색 크기 설정
const results = await analyzer.searchCode({
  query: '사용자 처리',
  size: 10  // 너무 큰 값은 성능 저하
});

// 2. 캐시 활용 (동일한 검색어는 캐시됨)
const firstSearch = await analyzer.searchCode({ query: '로그인' });
const secondSearch = await analyzer.searchCode({ query: '로그인' }); // 캐시됨

// 3. 병렬 검색
const [userResults, authResults, paymentResults] = await Promise.all([
  analyzer.searchCode({ query: '사용자', domains: ['user'] }),
  analyzer.searchCode({ query: '인증', domains: ['authentication'] }),
  analyzer.searchCode({ query: '결제', domains: ['payment'] })
]);
```

### 검색 품질 개선

```typescript
// 1. 컨텍스트 제공
const results = await analyzer.searchCode({
  query: '로그인 처리 함수 validation',  // 더 구체적인 검색어
  size: 5
});

// 2. 부정적 키워드 제외 (구현 예정)
// const results = await analyzer.searchCode({
//   query: '사용자 처리',
//   excludeKeywords: ['test', 'mock']  // 테스트 코드 제외
// });

// 3. 파일 패턴 필터링 (구현 예정)
// const results = await analyzer.searchCode({
//   query: '사용자 서비스',
//   includePatterns: ['src/**/*.service.ts']
// });
```

## 🐛 문제 해결

### 일반적인 문제들

#### 1. 검색 결과가 없는 경우
- 검색어가 너무 구체적일 수 있습니다
- 다른 키워드로 시도해보세요
- 도메인 필터를 제거해보세요

```typescript
// 더 일반적인 검색어로 시도
const results = await analyzer.searchCode({
  query: '사용자',  // '사용자 로그인 검증 처리' 대신
  size: 10
});
```

#### 2. 부정확한 결과가 나오는 경우
- 더 구체적인 검색어 사용
- 도메인 필터 적용
- 요소 타입 필터 적용

```typescript
const betterResults = await analyzer.searchCode({
  query: '사용자 인증 서비스',  // 더 구체적
  domains: ['authentication'],   // 도메인 제한
  elementTypes: ['class']        // 클래스만
});
```

#### 3. 성능이 느린 경우
- 검색 결과 크기 줄이기
- 필터 활용하여 범위 제한
- 캐시 활용

```typescript
const fasterSearch = await analyzer.searchCode({
  query: '로그인',
  size: 5,              // 작은 크기
  domains: ['auth']     // 범위 제한
});
```

---

## 🎓 고급 사용 예제

### 코드 리팩토링 지원

```typescript
// 1. 비슷한 패턴의 함수들 찾기
const authFunctions = await analyzer.searchCode({
  query: '인증 검증',
  elementTypes: ['function', 'method']
});

// 2. 각 함수의 유사한 코드들 찾기
for (const func of authFunctions.results.slice(0, 3)) {
  const similar = await analyzer.findSimilarCode(func.metadata.semanticMetadata?.name!);
  console.log(`${func.metadata.semanticMetadata?.name} 와 유사한 코드:`);
  similar.forEach(s => console.log(`  - ${s.metadata.semanticMetadata?.name}`));
}
```

### 도메인별 코드 탐색

```typescript
// 전체 아키텍처 이해를 위한 도메인별 탐색
const domains = ['authentication', 'user', 'payment', 'api', 'database'];

for (const domain of domains) {
  const domainCode = await analyzer.exploreByDomain(domain, { size: 5 });
  console.log(`\n🏷️ ${domain.toUpperCase()} 도메인:`);

  domainCode.forEach(code => {
    console.log(`  📄 ${code.metadata.semanticMetadata?.name}`);
    console.log(`     ${code.metadata.semanticMetadata?.description}`);
  });
}
```

이제 자연어로 코드를 검색하고, AI가 생성한 메타데이터를 활용하여 더 효율적인 개발을 경험해보세요! 🎉