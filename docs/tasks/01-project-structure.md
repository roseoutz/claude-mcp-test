# Task 01: 프로젝트 기본 구조 설정

## 목표
TypeScript/Node.js 기반의 MCP 서버 프로젝트 구조 생성

## 작업 내용

### 1. 프로젝트 구조 생성
```
src/
├── server.ts              # MCP 서버 메인 엔트리포인트
├── types/                 # TypeScript 타입 정의
│   ├── mcp.ts            # MCP 프로토콜 타입
│   ├── git.ts            # Git 관련 타입
│   └── analysis.ts       # 코드 분석 타입
├── tools/                 # MCP 도구 구현
│   ├── learn-codebase.ts
│   ├── analyze-diff.ts
│   ├── explain-feature.ts
│   └── analyze-impact.ts
├── services/              # 비즈니스 로직
│   ├── git.service.ts    # Git 작업 서비스
│   ├── analysis.service.ts # 코드 분석 서비스
│   ├── ai.service.ts     # AI 통합 서비스
│   └── auth.service.ts   # 인증 서비스
├── utils/                 # 유틸리티 함수
│   ├── file-utils.ts     # 파일 작업
│   ├── logger.ts         # 로깅
│   └── error-handler.ts  # 에러 처리
└── config/                # 설정 관리
    ├── mcp-config.ts     # MCP 설정
    ├── security.ts       # 보안 설정
    └── app-config.ts     # 앱 설정
```

### 2. 테스트 구조 생성
```
src/__tests__/
├── tools/                 # 도구 테스트
├── services/              # 서비스 테스트
├── utils/                 # 유틸리티 테스트
└── integration/           # 통합 테스트
```

### 3. 설정 파일 생성
- `package.json`: 프로젝트 메타데이터 및 스크립트
- `tsconfig.json`: TypeScript 컴파일러 설정
- `.eslintrc.json`: ESLint 설정
- `.prettierrc`: Prettier 설정
- `.env.example`: 환경 변수 템플릿

### 4. Docker 설정
- `docker-compose.yml`: 인프라 서비스 정의
  - ChromaDB (벡터 DB)
  - Redis (캐싱)
  - PostgreSQL (메타데이터)
  - MinIO (S3 호환 스토리지)

## 체크리스트
- [ ] 소스 디렉토리 구조 생성
- [ ] TypeScript 설정 완료
- [ ] ESLint/Prettier 설정
- [ ] 테스트 프레임워크 설정 (Vitest)
- [ ] Docker Compose 설정
- [ ] README.md 작성

## 필요 의존성
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "simple-git": "^3.20.0",
    "glob": "^10.3.10",
    "openai": "^4.28.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.17",
    "typescript": "^5.3.3",
    "vitest": "^1.2.2",
    "eslint": "^8.56.0",
    "tsx": "^4.7.1"
  }
}
```

## 스크립트 설정
```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/server.ts",
    "start": "node dist/server.js",
    "test": "vitest",
    "lint": "eslint src/**/*.ts",
    "clean": "rm -rf dist"
  }
}
```

## 커밋 메시지
```
feat: TypeScript/Node.js 기반 MCP 서버 프로젝트 구조 설정

- TypeScript 프로젝트 구조 생성
- MCP SDK 통합
- 테스트 환경 설정 (Vitest)
- Docker 인프라 구성
```

## 예상 소요 시간
30분

## 의존성
- Node.js 18.0.0+
- TypeScript 5.3.3+

## 검증 방법
- `npm install` 정상 실행
- `npm run build` 빌드 성공
- `npm test` 테스트 실행 확인
- `npm run dev` 개발 서버 시작