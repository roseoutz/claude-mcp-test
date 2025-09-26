# Elasticsearch 하이브리드 서치 설정 가이드

이 문서는 ChromaDB에서 Elasticsearch 하이브리드 서치로 전환하는 과정을 설명합니다.

## 📊 변경사항 요약

### 🔄 전환 완료된 구성요소

1. **Docker 인프라**
   - ChromaDB → Elasticsearch 8.11.3
   - 포트: 8000 → 9200/9300
   - 메모리: 4GB 할당

2. **백엔드 서비스**
   - `ElasticsearchVectorStore` 새로 구현
   - 하이브리드 검색 (kNN + BM25) 지원
   - Reciprocal Rank Fusion (RRF) 적용

3. **설정 파일**
   - 환경변수 업데이트 (`.env.example`)
   - TypeScript 타입 정의 확장
   - 빌드 검증 완료

## 🚀 실행 방법

### 1. Elasticsearch 컨테이너 시작

```bash
# Elasticsearch만 실행
docker-compose up elasticsearch -d

# 모든 서비스 실행
docker-compose up -d
```

### 2. 환경변수 설정

`.env` 파일에 다음 설정 추가:

```bash
# Vector Store Configuration
VECTOR_STORE_PROVIDER=elasticsearch
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=codebase-index
ELASTICSEARCH_AUTH=false

# Legacy ChromaDB (사용 안함)
# VECTOR_STORE_PROVIDER=chromadb
# VECTOR_STORE_URL=http://localhost:8000
```

### 3. 서비스 초기화 및 사용

```typescript
import { ElasticsearchVectorStore } from '@code-ai/shared';

// 1. 벡터 스토어 초기화
const vectorStore = new ElasticsearchVectorStore('codebase-index');
await vectorStore.initialize('codebase-index');

// 2. 문서 추가 (키워드 검색용)
await vectorStore.addDocument(
  'doc1',
  'function authenticate(user) { return validateCredentials(user); }',
  {
    language: 'javascript',
    filePath: 'src/auth.js',
    type: 'function'
  }
);

// 3. 임베딩과 함께 문서 추가 (하이브리드 검색용)
const embedding = await aiService.generateEmbedding(code);
await vectorStore.addDocumentWithEmbedding(
  'doc2',
  'async function loginUser(credentials) { return await auth.login(credentials); }',
  embedding,
  { language: 'typescript', filePath: 'src/login.ts' }
);

// 4. 키워드 검색
const keywordResults = await vectorStore.search('authentication function', 10);

// 5. 하이브리드 검색 (벡터 + 키워드)
const queryEmbedding = await aiService.generateEmbedding('user authentication');
const hybridResults = await vectorStore.hybridSearch(
  'authentication function',
  queryEmbedding,
  10
);
```

## 🔍 하이브리드 검색 동작 원리

### 1. Dense Vector Search (kNN)
```typescript
// 의미적 유사성 검색
const vectorResults = await performVectorSearch(queryEmbedding, limit);
```

### 2. Sparse Vector Search (BM25)
```typescript
// 키워드 매칭 검색
const keywordResults = await performKeywordSearch(query, limit);
```

### 3. Reciprocal Rank Fusion
```typescript
// 두 검색 결과를 RRF로 결합
const hybridResults = applyReciprocalRankFusion(
  keywordResults,
  vectorResults,
  { k: 60 }
);
```

## 📋 주요 기능

### ✅ 구현된 기능

- ✅ **하이브리드 검색**: 벡터 + 키워드 검색 결합
- ✅ **코드 특화 분석기**: 프로그래밍 언어별 토큰화
- ✅ **메타데이터 필터링**: 파일 타입, 언어별 검색
- ✅ **실시간 인덱싱**: 문서 변경사항 즉시 반영
- ✅ **확장성**: 대용량 코드베이스 지원
- ✅ **배치 작업**: 대량 문서 일괄 처리

### 🚀 성능 특징

| 기능 | ChromaDB (이전) | Elasticsearch (현재) |
|------|-----------------|---------------------|
| **검색 방식** | 벡터 검색만 | 하이브리드 (벡터 + 키워드) |
| **인덱싱** | 외부 의존성 | 실시간 인덱싱 |
| **확장성** | 제한적 | 무제한 확장 |
| **메타데이터** | 기본 필터링 | 고급 쿼리 지원 |
| **성능** | 벡터 특화 | 멀티 모달 최적화 |

## 🔧 개발자 가이드

### 팩토리 패턴 사용

```typescript
import { VectorStoreFactory } from '@code-ai/shared';

// 설정에 따른 자동 생성
const vectorStore = VectorStoreFactory.createFromConfig();

// Elasticsearch 강제 생성
const esStore = VectorStoreFactory.createElasticsearchStore('my-index');
```

### 검색 결과 타입

```typescript
interface HybridSearchResult {
  id: string;
  score: number;
  content: string;
  metadata: Record<string, any>;
  searchType: 'vector' | 'keyword' | 'hybrid';
  explanation?: {
    vectorScore?: number;
    keywordScore?: number;
    finalScore: number;
  };
}
```

### 인덱스 관리

```typescript
// 인덱스 상태 조회
const info = await vectorStore.getIndexInfo();
console.log({
  health: info.health,        // green, yellow, red
  documentsCount: info.documentsCount,
  storeSize: info.storeSize
});

// 모든 문서 삭제
await vectorStore.clear();

// 문서 수 확인
const count = await vectorStore.count();
```

## 🐛 문제 해결

### Elasticsearch 연결 실패
```bash
# 컨테이너 상태 확인
docker-compose ps elasticsearch

# 로그 확인
docker-compose logs elasticsearch

# 헬스체크
curl -f http://localhost:9200/_cluster/health
```

### 메모리 부족 오류
```yaml
# docker-compose.yml에서 메모리 증설
elasticsearch:
  mem_limit: 8g  # 4g → 8g로 증설
  environment:
    - ES_JAVA_OPTS=-Xms4g -Xmx4g
```

### 검색 결과 없음
```typescript
// 인덱스 문서 수 확인
const count = await vectorStore.count();

// 문서가 있는지 확인
if (count === 0) {
  console.log('No documents in index');
}
```

## 📈 마이그레이션 체크리스트

- ✅ Docker Compose 설정 업데이트
- ✅ 환경변수 `VECTOR_STORE_PROVIDER=elasticsearch` 설정
- ✅ 기존 ChromaDB 의존성 제거 (선택사항)
- ✅ 코드에서 `ElasticsearchVectorStore` 사용
- ✅ 하이브리드 검색 활용
- ✅ 성능 모니터링 설정

## 🎯 다음 단계

1. **성능 튜닝**: 인덱스 샤드 수, 레플리카 수 최적화
2. **보안 설정**: Elasticsearch 보안 활성화 (프로덕션)
3. **모니터링**: Kibana 연동으로 검색 분석
4. **백업**: 인덱스 스냅샷 자동화

---

## 📞 지원

문제가 발생하면:
1. Elasticsearch 로그 확인: `docker-compose logs elasticsearch`
2. 인덱스 상태 점검: `curl http://localhost:9200/_cat/indices`
3. 애플리케이션 로그에서 상세 오류 확인

Elasticsearch 하이브리드 서치로 더욱 강력하고 정확한 코드 검색을 경험해보세요! 🚀