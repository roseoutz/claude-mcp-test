# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 참고하는 가이드입니다.

## 📌 기본 설정

- **모든 대화에는 [답변] 라는 키워드를 붙여줘**

## 🚀 명령어 가이드

### 모노레포 관리
| 명령어 | 설명 |
|--------|------|
| `npm install` | 모든 워크스페이스 의존성 설치 |
| `npm run build` | 모든 패키지 빌드 |
| `npm run clean` | 모든 빌드 결과물 삭제 |

### 로컬 MCP 서버 (NestJS v11)
| 명령어 | 설명 |
|--------|------|
| `npm run dev:local` | NestJS 서버 개발 모드 실행 (핫 리로드) |
| `npm run build -w @code-ai/local-mcp` | 로컬 MCP 패키지 빌드 |
| `npm test -w @code-ai/local-mcp` | 로컬 MCP 패키지 테스트 |

### AWS API 서버
| 명령어 | 설명 |
|--------|------|
| `npm run dev:aws` | HTTP와 gRPC 서버 동시 실행 |
| `npm run build -w @code-ai/aws-api` | AWS API 패키지 빌드 |
| `cd packages/aws-api && npm run deploy` | AWS CDK를 사용한 배포 |

### Docker 인프라
| 명령어 | 설명 |
|--------|------|
| `docker-compose up -d` | 모든 인프라 서비스 시작 |
| `docker-compose down` | 모든 인프라 서비스 중지 |
| `docker-compose --profile dev up -d` | 개발 도구 포함 실행 |

## 🏗 아키텍처

### 패키지 구조

#### 📦 `packages/local-mcp` - 로컬 MCP 서버
- **프레임워크**: NestJS v11
- **주요 모듈**:
  - `src/app.module.ts`: 애플리케이션 루트 모듈
  - `src/mcp/mcp.service.ts`: MCP 프로토콜 핸들러 구현
  - `src/grpc/grpc-client.service.ts`: AWS 서버와의 gRPC 통신
  - `src/analysis/`: 스트리밍 응답 및 채팅 세션 처리

#### 📦 `packages/aws-api` - AWS API 서버
- **런타임**: Node.js + Express + gRPC
- **주요 구성요소**:
  - `src/grpc/grpc.server.ts`: 모든 RPC 메서드 구현
  - `src/index.ts`: Express 서버 진입점
  - **포트**: HTTP (3000), gRPC (50051)
  - **AI 통합**: OpenAI API (시맨틱 검색, 채팅)

#### 📦 `packages/shared` - 공유 타입 및 프로토콜
- **프로토콜 정의**: `proto/analysis.proto` - gRPC 서비스 정의
- **타입 시스템**: 
  - `src/types/`: TypeScript 타입 정의
  - Zod 스키마를 통한 런타임 검증
- **유틸리티**: `src/utils/` - 공통 헬퍼 함수

### 통신 패턴

#### gRPC 메서드 타입

| 패턴 | 메서드 | 설명 |
|------|--------|------|
| **Unary RPC** | `learnCodebase` | 단순 요청/응답 |
| **Server Streaming** | `analyzeCodebase` | 분석 진행 상황 스트리밍 |
| | `searchCode` | 검색 결과 스트리밍 |
| | `analyzeDiff` | Diff 분석 결과 스트리밍 |
| **Bidirectional Streaming** | `chatWithCode` | 대화형 채팅 |

### 핵심 기술 결정

| 기술 | 선택 이유 |
|------|-----------|
| **NestJS v11** | 최신 기능과 성능 최적화 |
| **gRPC + HTTP/2** | 효율적인 바이너리 프로토콜과 스트리밍 지원 |
| **Protocol Buffers** | 타입 안전한 서비스 정의 |
| **RxJS Observables** | NestJS에서의 스트림 처리 |
| **SSE** | 웹 클라이언트 스트리밍 지원 |
| **npm workspaces** | 의존성 공유 및 통합 빌드 관리 |

## ⚙️ 환경 설정

### 필수 환경 변수

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `OPENAI_API_KEY` | OpenAI API 키 | - |
| `GRPC_SERVER_URL` | gRPC 서버 주소 | `localhost:50051` |
| `PORT` | HTTP 서버 포트 | local: 3001, aws: 3000 |
| `GRPC_PORT` | gRPC 서버 포트 | 50051 |

### Docker 인프라 서비스

| 서비스 | 용도 | 포트 |
|--------|------|------|
| **ChromaDB** | 벡터 데이터베이스 (임베딩) | 8000 |
| **Redis** | 캐싱 레이어 | 6379 |
| **PostgreSQL** | 메타데이터 저장소 | 5432 |
| **MinIO** | S3 호환 객체 저장소 | 9000 (API), 9001 (Console) |
| **Nginx** | 리버스 프록시 | 80, 443 |
| **pgAdmin** | PostgreSQL 관리 UI (dev 프로파일) | 5050 |
| **Redis Commander** | Redis 관리 UI (dev 프로파일) | 8081 |

## 🔧 개발 가이드

### 새로운 MCP 도구 추가 절차

1. **프로토콜 정의**: `packages/shared/proto/analysis.proto`에 gRPC 서비스 정의
2. **서버 구현**: `packages/aws-api/src/grpc/grpc.server.ts`에 핸들러 구현
3. **클라이언트 추가**: `packages/local-mcp/src/grpc/grpc-client.service.ts`에 메서드 추가
4. **MCP 등록**: `packages/local-mcp/src/mcp/mcp.service.ts`에 도구 등록

### 모범 사례

#### 성능 최적화
- 대용량 데이터나 실시간 업데이트는 스트리밍 사용
- 캐싱 전략 적극 활용
- 배치 처리로 네트워크 호출 최소화

#### 코드 품질
- gRPC 스트림에서 적절한 에러 처리 구현
- NestJS 모듈 구조와 의존성 주입 패턴 준수
- Protocol Buffers와 Zod 스키마로 타입 안전성 보장

#### 운영 관리
- 패키지별 작업시 npm workspaces 명령어 사용
- 환경별 설정 분리 (development, production, test)
- 로깅 레벨 적절히 설정

### 디버깅 팁

| 문제 상황 | 해결 방법 |
|-----------|-----------|
| gRPC 연결 실패 | `GRPC_SERVER_URL` 환경 변수 확인 |
| 타입 에러 | `npm run build -w @code-ai/shared` 먼저 실행 |
| Docker 서비스 문제 | `docker-compose logs [서비스명]` 확인 |
| 테스트 실패 | `npm test -w [패키지명]`으로 개별 테스트 |

## 📝 작업 흐름

### 기능 개발 프로세스
1. 타입 정의 (`packages/shared/src/types/`)
2. Proto 파일 업데이트 (필요시)
3. 서버 로직 구현
4. 클라이언트 통합
5. 테스트 작성
6. 문서 업데이트

### 커밋 규칙
- `feat:` 새로운 기능
- `fix:` 버그 수정
- `refactor:` 코드 리팩토링
- `docs:` 문서 업데이트
- `test:` 테스트 추가/수정
- `chore:` 빌드/설정 변경

## 🔍 주요 파일 위치

```
프로젝트 루트/
├── packages/
│   ├── local-mcp/        # 로컬 MCP 서버
│   ├── aws-api/          # AWS API 서버
│   └── shared/           # 공유 코드
├── docker/               # Docker 설정
├── .env.example         # 환경 변수 템플릿
└── docker-compose.yml   # Docker Compose 설정
```