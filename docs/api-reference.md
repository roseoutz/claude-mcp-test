# API 참조 문서 (API Reference)

## 🔧 MCP 도구 (Tools) API

### 1. learn_codebase

코드베이스를 학습하고 인덱싱하는 도구입니다.

#### 요청 스키마

```json
{
  "name": "learn_codebase",
  "arguments": {
    "repoPath": "string",
    "branch": "string?" 
  }
}
```

#### 매개변수

| 매개변수 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|-------|------|
| `repoPath` | string | ✅ | - | 분석할 Git 레포지토리의 절대 경로 |
| `branch` | string | ❌ | "main" | 분석할 브랜치명 |

#### 응답 예시

```json
{
  "content": [
    {
      "type": "text",
      "text": "코드베이스 학습 완료:\n\n분석된 파일: 127개\n지원 언어: TypeScript, JavaScript, JSON\n분석 시간: 2.3초\n\n주요 통계:\n- 총 라인 수: 15,420\n- 테스트 파일: 23개\n- 설정 파일: 8개\n\n주요 컴포넌트:\n- MCP Server: 메인 MCP 서버 구현\n- Git Service: Git 작업 처리 서비스\n- Analysis Service: 코드 분석 서비스"
    }
  ]
}
```

#### 에러 상황

- `repoPath`가 존재하지 않는 경우
- Git 레포지토리가 아닌 경우
- 지정된 브랜치가 존재하지 않는 경우

---

### 2. analyze_branch_diff

브랜치 간 차이점을 분석하는 도구입니다.

#### 요청 스키마

```json
{
  "name": "analyze_branch_diff",
  "arguments": {
    "repoPath": "string",
    "baseBranch": "string",
    "targetBranch": "string"
  }
}
```

#### 매개변수

| 매개변수 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `repoPath` | string | ✅ | Git 레포지토리의 절대 경로 |
| `baseBranch` | string | ✅ | 기준이 되는 브랜치명 |
| `targetBranch` | string | ✅ | 비교할 대상 브랜치명 |

#### 응답 예시

```json
{
  "content": [
    {
      "type": "text", 
      "text": "브랜치 차이 분석 완료:\n\n- 기본 브랜치: main\n- 대상 브랜치: feature/mcp-server\n- 변경된 파일: 12개\n- 추가된 라인: +234\n- 삭제된 라인: -67\n\n주요 변경사항:\n- src/server.ts: MCP 서버 구현 추가\n- src/tools/: 4개 도구 구현 추가\n- package.json: MCP SDK 의존성 추가\n- README.md: 문서 업데이트"
    }
  ]
}
```

#### 분석 결과 구조

```typescript
interface BranchDiffResult {
  sourceBranch: string;
  targetBranch: string;
  changedFiles: Array<{
    path: string;
    status: 'added' | 'modified' | 'deleted';
    linesAdded: number;
    linesDeleted: number;
  }>;
  summary: {
    totalFiles: number;
    totalLinesAdded: number;
    totalLinesDeleted: number;
    mainChanges: string[];
  };
}
```

---

### 3. explain_feature

특정 기능에 대한 상세한 설명을 제공하는 도구입니다.

#### 요청 스키마

```json
{
  "name": "explain_feature",
  "arguments": {
    "featureId": "string",
    "includeCodeExamples": "boolean?"
  }
}
```

#### 매개변수

| 매개변수 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|-------|------|
| `featureId` | string | ✅ | - | 설명할 기능의 식별자 |
| `includeCodeExamples` | boolean | ❌ | false | 코드 예시 포함 여부 |

#### 응답 예시 (기본)

```json
{
  "content": [
    {
      "type": "text",
      "text": "기능 설명:\n\nMCP Server는 Model Context Protocol을 구현한 서버로, Claude Desktop과 같은 AI 클라이언트가 외부 도구와 상호작용할 수 있게 해주는 중간 계층입니다.\n\n주요 기능:\n- JSON-RPC 2.0 프로토콜 기반 통신\n- STDIO를 통한 클라이언트-서버 통신\n- 동적 도구 등록 및 실행\n- 타입 안전성을 보장하는 TypeScript 구현"
    }
  ]
}
```

#### 응답 예시 (코드 예시 포함)

```json
{
  "content": [
    {
      "type": "text",
      "text": "기능 설명:\n...\n\n코드 예시:\n\nsrc/server.ts:\n```typescript\nimport { Server } from '@modelcontextprotocol/sdk/server/index.js';\n\nconst server = new Server({\n  name: 'code-ai-mcp',\n  version: '1.0.0'\n}, {\n  capabilities: { tools: {} }\n});\n```"
    }
  ]
}
```

---

### 4. analyze_impact

코드 변경이 시스템에 미치는 영향을 분석하는 도구입니다.

#### 요청 스키마

```json
{
  "name": "analyze_impact",
  "arguments": {
    "changeDescription": "string",
    "affectedFiles": ["string"],
    "analysisDepth": "basic" | "deep"
  }
}
```

#### 매개변수

| 매개변수 | 타입 | 필수 | 기본값 | 설명 |
|---------|------|------|-------|------|
| `changeDescription` | string | ✅ | - | 변경사항에 대한 설명 |
| `affectedFiles` | string[] | ✅ | - | 영향받는 파일 경로 목록 |
| `analysisDepth` | enum | ❌ | "basic" | 분석 깊이 ("basic" 또는 "deep") |

#### 응답 예시

```json
{
  "content": [
    {
      "type": "text",
      "text": "영향도 분석 완료:\n\n위험도 평가: 중간 (MEDIUM)\n\n직접적 영향:\n- 영향받는 파일: 3개\n- 영향받는 컴포넌트: MCP Server, Tool Handler\n- 예상 변경량: 12개 메서드\n- 복잡도: 보통\n\n간접적 영향:\n- 연쇄적 영향 파일: 7개\n- 영향받는 컴포넌트: Git Service, Analysis Service\n- 의존성 깊이: 2단계\n- 연쇄 위험도: 낮음\n\n권장사항:\n- 변경 전 단위 테스트 추가 작성\n- 기존 기능과의 호환성 확인\n- 점진적 배포 고려"
    }
  ]
}
```

#### 위험도 등급

| 등급 | 설명 | 권장 조치 |
|------|------|----------|
| `LOW` | 낮은 위험도 | 일반적인 코드 리뷰 |
| `MEDIUM` | 중간 위험도 | 추가 테스트 및 면밀한 리뷰 |
| `HIGH` | 높은 위험도 | 종합적인 테스트 및 단계적 배포 |
| `CRITICAL` | 치명적 위험도 | 신중한 계획 및 롤백 준비 |

## 🔄 MCP 프로토콜 기본 메시지

### 1. 초기화 (Initialize)

#### 요청

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "Claude Desktop",
      "version": "1.0.0"
    }
  }
}
```

#### 응답

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {}
    },
    "serverInfo": {
      "name": "code-ai-mcp-node", 
      "version": "1.0.0"
    }
  }
}
```

### 2. 도구 목록 조회 (tools/list)

#### 요청

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

#### 응답

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "learn_codebase",
        "description": "코드베이스를 학습하고 인덱싱합니다",
        "inputSchema": {
          "type": "object",
          "properties": {
            "repoPath": {"type": "string"},
            "branch": {"type": "string"}
          },
          "required": ["repoPath"]
        }
      }
      // ... 다른 도구들
    ]
  }
}
```

### 3. 도구 실행 (tools/call)

#### 요청

```json
{
  "jsonrpc": "2.0", 
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "learn_codebase",
    "arguments": {
      "repoPath": "/path/to/repo",
      "branch": "main"
    }
  }
}
```

#### 응답

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "코드베이스 학습 결과..."
      }
    ]
  }
}
```

## ⚠️ 에러 처리

### 에러 응답 형식

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "details": "repoPath 매개변수가 필요합니다"
    }
  }
}
```

### 표준 에러 코드

| 코드 | 메시지 | 설명 |
|------|--------|------|
| -32700 | Parse error | JSON 파싱 오류 |
| -32600 | Invalid Request | 잘못된 요청 형식 |
| -32601 | Method not found | 존재하지 않는 메서드 |
| -32602 | Invalid params | 잘못된 매개변수 |
| -32603 | Internal error | 내부 서버 오류 |

### 사용자 정의 에러 코드

| 코드 | 메시지 | 설명 |
|------|--------|------|
| -1000 | Repository not found | Git 레포지토리를 찾을 수 없음 |
| -1001 | Branch not found | 지정된 브랜치를 찾을 수 없음 |
| -1002 | Analysis failed | 코드 분석 실패 |
| -1003 | AI service error | AI 서비스 연결 오류 |