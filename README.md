# 🧠 지능형 코드 검색 시스템

> AI와 자연어 처리를 활용한 차세대 코드베이스 분석 및 검색 플랫폼

**"사용자 로그인 처리"라고 검색하면 관련 코드를 정확하게 찾아주는 지능형 검색 시스템입니다.**

## ✨ 주요 기능

🗣️ **자연어 검색** - "데이터베이스 연결", "결제 처리" 등 일상적인 표현으로 코드 검색
🤖 **AI 설명 생성** - 모든 클래스와 함수에 대한 자연어 설명 자동 생성
🔍 **하이브리드 검색** - 의미적 검색 + 키워드 검색의 최적 결합
🌍 **다국어 지원** - 한국어 ↔ 영어 키워드 자동 매핑
📊 **도메인 분류** - authentication, user, payment 등으로 코드 자동 분류

## 🚀 빠른 시작

### 1분만에 시작하기
```bash
# 환경 설정
export OPENAI_API_KEY="your-openai-api-key"

# 설치 및 빌드
npm install && npm run build
```

### 첫 번째 검색
```typescript
import { IntelligentCodeAnalyzerService } from '@code-ai/shared/services';

const analyzer = new IntelligentCodeAnalyzerService(aiService, vectorStore);
await analyzer.initialize();

// 코드베이스 분석 (최초 1회)
await analyzer.analyzeCodebase({
  repositoryPath: '/path/to/your/project',
  generateDescriptions: true
});

// 자연어 검색
const results = await analyzer.searchCode({
  query: '사용자 로그인 처리'
});

console.log(`찾은 코드: ${results.results[0].metadata.semanticMetadata?.name}`);
console.log(`설명: ${results.results[0].metadata.semanticMetadata?.description}`);
```

## 📚 완전한 문서

### **👉 [📖 문서 허브로 이동](./docs/README.md)**

| 카테고리 | 링크 | 설명 |
|---------|------|------|
| 🚀 **시작하기** | [빠른 시작](./docs/guides/quick-start.md) | 5분만에 시작하는 가이드 |
| 🔧 **설치** | [설치 가이드](./docs/guides/installation.md) | 상세 설치 및 설정 |
| 🧠 **사용법** | [지능형 검색](./docs/guides/intelligent-search.md) | 자연어 검색 활용법 |
| 🏗️ **아키텍처** | [시스템 구조](./docs/architecture/system-overview.md) | 시스템 설계와 구조 |
| 📖 **API** | [API 레퍼런스](./docs/reference/api-reference.md) | 완전한 API 문서 |
| 💡 **예제** | [사용 예제](./docs/examples/basic-usage.md) | 실제 코드 예제 |

## 🏗️ 시스템 구조

### 모노레포 아키텍처
```
packages/
├── 🧠 shared/           # 지능형 검색 시스템 (핵심)
├── 🔗 local-mcp/        # MCP 서버 (NestJS v11)
├── ☁️ aws-api/          # AWS API 서버 (gRPC + REST)
└── 📊 docs/             # 통합 문서
```

### 검색 플로우
```
사용자 쿼리 "사용자 로그인"
        ↓
    키워드 확장 → ["user", "login", "authentication", "signin"]
        ↓
    하이브리드 검색
    ├─ 벡터 검색 (의미적 유사성)
    ├─ 키워드 검색 (정확한 매칭)
    └─ AI 메타데이터 검색
        ↓
    결과 랭킹 및 반환
```

## 💻 기술 스택

| 계층 | 기술 | 용도 |
|------|------|------|
| **AI** | OpenAI GPT-4, Claude | 코드 분석 및 설명 생성 |
| **검색** | Elasticsearch, Vector DB | 하이브리드 검색 엔진 |
| **백엔드** | NestJS v11, Express | API 서버 및 MCP 서버 |
| **통신** | gRPC, HTTP/2, MCP | 서버간 통신 및 스트리밍 |
| **인프라** | Docker, PostgreSQL, Redis | 데이터 저장 및 캐싱 |

## 📊 성능 지표

- **검색 속도**: 평균 200ms 이하
- **분석 정확도**: 88% 이상
- **다국어 매핑**: 한국어 ↔ 영어 자동 변환
- **메모리 효율성**: 배치 처리 및 캐싱 최적화

## 🎯 사용 사례

### 개발자를 위한
- **🔍 코드 탐색**: "결제 처리 로직이 어디 있지?"
- **📖 코드 이해**: "이 함수가 뭘 하는 거지?"
- **🔄 리팩토링**: "비슷한 함수들 찾아보자"

### 팀을 위한
- **📋 코드 리뷰**: "인증 관련 코드들 전체 점검"
- **📚 온보딩**: "새로운 개발자에게 코드 설명"
- **🎯 표준화**: "일관된 패턴 찾기"

## 🤝 기여하기

### 개발자 커뮤니티
- 🐛 [버그 리포트](https://github.com/your-repo/issues)
- 💡 [기능 제안](https://github.com/your-repo/discussions)
- 📝 [문서 개선](https://github.com/your-repo/pulls)

### 개발에 참여
```bash
# 개발 환경 설정
git clone https://github.com/your-repo/code-ai-mcp-node.git
cd code-ai-mcp-node
npm install
npm run build

# 테스트 실행
npm test

# 개발 서버 실행
npm run dev:local  # MCP 서버
npm run dev:aws    # API 서버
```

## 📜 라이선스

MIT License - 자유롭게 사용하고 기여해주세요!

## 🆘 도움이 필요하세요?

- 📚 **문서**: [완전한 문서 허브](./docs/README.md)
- 🚀 **빠른 시작**: [5분 가이드](./docs/guides/quick-start.md)
- 💬 **커뮤니티**: [토론 포럼](https://github.com/your-repo/discussions)
- 🐛 **문제 해결**: [문제 해결 가이드](./docs/guides/troubleshooting.md)

---

**🎉 자연어로 코드를 검색하는 새로운 개발 경험을 시작하세요!**

> "개발자가 생각하는 방식으로 코드를 찾을 수 있는 세상을 만들고 있습니다." 🚀