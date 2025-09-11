# Code AI MCP - Monorepo Architecture

AI 기반 코드베이스 분석 및 이해를 위한 MCP(Model Context Protocol) 서버 모노레포입니다.

## 🏗 아키텍처

```
code-ai-mcp-monorepo/
├── packages/
│   ├── local-mcp/     # 로컬 MCP 서버 (NestJS v11)
│   ├── aws-api/       # AWS API 서버 (gRPC + REST)
│   └── shared/        # 공통 타입 및 Proto 정의
└── docker/            # 인프라 서비스 설정
```

### 통신 구조

```
로컬 MCP 서버 (NestJS)
    ↓ gRPC + HTTP/2 (스트리밍)
AWS API 서버
    ↓
AWS 인프라 (RDS, S3, ElastiCache)
```

## 🚀 주요 기능

### gRPC 통신 패턴
- **Unary RPC**: 단순 학습 요청
- **Server Streaming**: 분석 진행상황, 검색 결과, Diff 분석
- **Bidirectional Streaming**: 대화형 AI 채팅

### MCP Tools
- `learn-codebase`: Git 리포지토리 학습 및 분석
- `search-code`: 시맨틱 코드 검색
- `analyze-diff`: 브랜치 간 차이 분석
- `chat-with-code`: AI 기반 코드 대화

## 🛠 기술 스택

### Local MCP Server
- **Framework**: NestJS v11
- **Protocol**: MCP (Model Context Protocol)
- **Communication**: gRPC Client, SSE
- **Dependencies**: 
  - `@modelcontextprotocol/sdk`
  - `@grpc/grpc-js`
  - `simple-git`
  - `glob`

### AWS API Server
- **Runtime**: Node.js + Express
- **Protocol**: gRPC Server + REST API
- **AI Integration**: OpenAI API
- **AWS Services**: 
  - S3 (객체 저장)
  - DynamoDB (메타데이터)
  - Lambda/ECS (배포 옵션)

### Shared Package
- **Protocol Buffers**: gRPC 서비스 정의
- **Type Definitions**: Zod 스키마
- **Utilities**: 공통 유틸리티 함수

## 📦 설치 및 실행

### 사전 요구사항
- Node.js >= 22.0.0
- npm >= 10.0.0
- Docker & Docker Compose (선택사항)

### 설치
```bash
# 의존성 설치
npm install

# 모든 패키지 빌드
npm run build
```

### 개발 환경 실행

#### 1. 환경 변수 설정
```bash
# 루트 디렉토리
cp .env.example .env

# 필수 환경 변수
OPENAI_API_KEY=your_openai_api_key
GRPC_SERVER_URL=localhost:50051
```

#### 2. AWS API 서버 실행
```bash
npm run dev:aws
# HTTP: http://localhost:3000
# gRPC: localhost:50051
```

#### 3. 로컬 MCP 서버 실행
```bash
npm run dev:local
# HTTP: http://localhost:3001
```

### Docker 인프라 (선택사항)
```bash
# 인프라 서비스 시작
docker-compose up -d

# 서비스 종료
docker-compose down
```

제공되는 서비스:
- ChromaDB (포트: 8000) - 벡터 데이터베이스
- Redis (포트: 6379) - 캐싱
- PostgreSQL (포트: 5432) - 메타데이터 저장
- MinIO (포트: 9000) - S3 호환 객체 저장소
- Nginx (포트: 80) - 리버스 프록시

## 📝 API 사용 예시

### 1. 코드베이스 학습
```bash
curl -X POST http://localhost:3001/analysis/learn \
  -H "Content-Type: application/json" \
  -d '{
    "repository": "/path/to/repo",
    "branch": "main",
    "patterns": ["**/*.ts", "**/*.js"]
  }'
```

### 2. 코드 검색 (SSE 스트리밍)
```bash
curl -N http://localhost:3001/analysis/search/session123/stream \
  -H "Content-Type: application/json" \
  -d '{
    "query": "authentication logic",
    "semantic": true
  }'
```

### 3. 대화형 채팅
```bash
# 세션 시작
curl -X POST http://localhost:3001/analysis/chat/start \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "chat123"}'

# 메시지 전송
curl -X POST http://localhost:3001/analysis/chat/chat123/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Explain the authentication flow",
    "contextFiles": ["src/auth/auth.service.ts"]
  }'
```

## 🧪 테스트

```bash
# 모든 패키지 테스트
npm test

# 특정 패키지 테스트
npm test -w @code-ai/local-mcp
npm test -w @code-ai/aws-api
```

## 🚢 배포

### AWS 배포 (aws-api)
```bash
cd packages/aws-api
npm run deploy  # AWS CDK 사용
```

### Claude Desktop 연동
```json
{
  "mcpServers": {
    "code-ai": {
      "command": "node",
      "args": ["packages/local-mcp/dist/main.js"],
      "env": {
        "GRPC_SERVER_URL": "your-aws-server:50051"
      }
    }
  }
}
```

## 📁 프로젝트 구조

```
├── packages/
│   ├── local-mcp/          # 로컬 MCP 서버
│   │   ├── src/
│   │   │   ├── main.ts     # NestJS 진입점
│   │   │   ├── app.module.ts
│   │   │   ├── mcp/        # MCP 프로토콜 구현
│   │   │   ├── grpc/       # gRPC 클라이언트
│   │   │   └── analysis/   # 분석 서비스
│   │   └── package.json
│   │
│   ├── aws-api/            # AWS API 서버
│   │   ├── src/
│   │   │   ├── index.ts    # Express 서버
│   │   │   ├── grpc/       # gRPC 서버 구현
│   │   │   └── routes/     # REST API 라우트
│   │   └── package.json
│   │
│   └── shared/             # 공통 패키지
│       ├── src/
│       │   ├── types/      # TypeScript 타입
│       │   └── utils/      # 유틸리티 함수
│       └── proto/          # Protocol Buffers
│           └── analysis.proto
│
├── docker/                 # Docker 설정
├── package.json           # 모노레포 루트
├── tsconfig.base.json     # 공통 TypeScript 설정
└── README.md
```

## 🔧 개발 가이드

### 새로운 MCP Tool 추가
1. `packages/shared/proto/analysis.proto`에 gRPC 서비스 정의
2. `packages/aws-api/src/grpc/grpc.server.ts`에 서버 구현
3. `packages/local-mcp/src/grpc/grpc-client.service.ts`에 클라이언트 메서드 추가
4. `packages/local-mcp/src/mcp/mcp.service.ts`에 MCP 핸들러 추가

### 코드 스타일
```bash
# Lint 실행
npm run lint

# 빌드
npm run build
```

## 📊 성능 특징

| 측면 | 설명 |
|------|------|
| **시작 시간** | ~1초 (NestJS 최적화) |
| **메모리 사용** | ~100MB (기본 상태) |
| **스트리밍** | gRPC HTTP/2 기반 실시간 스트리밍 |
| **확장성** | 모노레포 구조로 독립적 스케일링 가능 |

## 🛣️ 로드맵

- [x] 모노레포 구조 구현
- [x] NestJS v11 마이그레이션
- [x] gRPC + 스트리밍 통신
- [x] MCP 프로토콜 구현
- [ ] AWS Lambda 배포 지원
- [ ] Kubernetes 배포 차트
- [ ] 벡터 DB 통합 (ChromaDB)
- [ ] 웹 대시보드 UI

## 🤝 기여

기여를 환영합니다! PR을 제출하기 전에 다음을 확인해주세요:
- 모든 테스트 통과
- Lint 규칙 준수
- 문서 업데이트

## 📄 라이선스

MIT

## 🙏 감사의 말

- [Anthropic](https://anthropic.com)의 MCP 프로토콜 개발팀
- [NestJS](https://nestjs.com) 커뮤니티
- [gRPC](https://grpc.io) 프로젝트