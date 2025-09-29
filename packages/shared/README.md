# 📦 Shared Package

지능형 코드 검색 시스템의 핵심 서비스와 타입 정의를 포함한 공유 패키지입니다.

## 📋 포함된 구성 요소

### 🔧 핵심 서비스
- **IntelligentCodeAnalyzerService**: 메인 코드 분석 서비스
- **AIService**: OpenAI/Anthropic API 통합
- **ElasticsearchVectorStore**: Elasticsearch 기반 벡터 저장소
- **KeywordMappingService**: 한국어↔영어 키워드 매핑

### 📝 타입 정의
- **intelligent-search.ts**: 검색 및 분석 관련 모든 타입
- **mcp.types.ts**: MCP 프로토콜 타입
- **git.types.ts**: Git 작업 관련 타입

### 🗂️ 유틸리티
- **logger.ts**: 구조화된 로깅
- **config.ts**: 설정 관리
- **constants.ts**: 공통 상수

## 🚀 사용법

```typescript
import {
  IntelligentCodeAnalyzerService,
  AIService,
  ElasticsearchVectorStore
} from '@code-ai/shared/services';

const analyzer = new IntelligentCodeAnalyzerService(
  new AIService(),
  new ElasticsearchVectorStore('my-project')
);
```

## 📖 전체 문서

자세한 사용법과 가이드는 [프로젝트 문서 허브](../../docs/README.md)를 참고하세요.