# Local MCP Server

Claude Code에 연결할 로컬 MCP (Model Context Protocol) 서버입니다.

## 개요

이 패키지는 Claude Code에서 사용할 수 있는 MCP 서버를 제공합니다. `@code-ai/shared` 패키지에 구현된 MCP 서버를 실행하는 간단한 wrapper 역할을 합니다.

## 주요 기능

- **코드베이스 학습**: 프로젝트 코드를 분석하고 벡터 인덱싱
- **브랜치 Diff 분석**: Git 브랜치 간 차이점 분석 및 요약  
- **기능 설명**: 특정 기능/컴포넌트에 대한 상세 설명 제공
- **영향도 분석**: 코드 변경이 시스템에 미치는 영향도 분석

## 설치

```bash
npm install
npm run build
```

## 사용법

### 개발 모드
```bash
npm run dev
```

### 프로덕션 모드
```bash
npm run build
npm start
```

### Claude Code에서 사용

1. Claude Code 설정에서 MCP 서버 추가
2. 서버 경로를 이 패키지의 실행 파일로 설정:
   ```
   /path/to/code-ai-mcp-node/packages/local-mcp/dist/index.js
   ```

## 프로젝트 구조

```
src/
├── index.ts          # 메인 진입점
└── index.test.ts     # 테스트
```

## 기술 스택

- **TypeScript**: ES2022 + ESM
- **MCP SDK**: Model Context Protocol 구현
- **Jest**: 테스트 프레임워크

## 환경 설정

필요한 환경 변수는 `@code-ai/shared` 패키지의 설정을 따릅니다:

- `OPENAI_API_KEY`: OpenAI API 키
- `GITHUB_TOKEN`: GitHub API 토큰
- 기타 설정은 `packages/shared/.env.example` 참조

## 테스트

```bash
npm test
```

## 빌드

```bash
npm run build
```

## 로그

서버 실행 중 로그는 stderr로 출력되며, Claude Code가 이를 통해 서버 상태를 확인합니다.

## 문제 해결

### 서버가 시작되지 않는 경우
1. 환경 변수 설정 확인
2. `@code-ai/shared` 패키지가 올바르게 빌드되었는지 확인
3. 로그 메시지를 통해 구체적인 오류 확인

### Claude Code에서 연결되지 않는 경우
1. MCP 서버 설정이 올바른지 확인
2. 실행 파일 권한 확인 (`chmod +x dist/index.js`)
3. Node.js 버전 호환성 확인 (Node.js 22+ 권장)

## 📖 전체 문서

자세한 사용법과 가이드는 [프로젝트 문서 허브](../../docs/README.md)를 참고하세요.