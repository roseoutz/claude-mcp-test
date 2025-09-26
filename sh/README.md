# Shell Scripts Documentation

이 디렉토리는 Code AI MCP 프로젝트의 각 모듈을 관리하기 위한 쉘 스크립트들을 포함합니다.

## 📋 스크립트 목록

### 📦 설치 스크립트

| 스크립트 | 설명 |
|---------|------|
| `install-all.sh` | 전체 프로젝트 의존성 일괄 설치 |
| `install-shared.sh` | shared 패키지 의존성 설치 |
| `install-local-mcp.sh` | local-mcp 패키지 의존성 설치 |
| `install-aws-api.sh` | aws-api 패키지 의존성 설치 |
| `clean-all.sh` | 전체 프로젝트 정리 (node_modules, dist 등) |

### 🧪 테스트 스크립트

| 스크립트 | 설명 |
|---------|------|
| `test-all.sh` | 전체 프로젝트 테스트 실행 |
| `test-shared.sh` | shared 패키지 테스트 |
| `test-local-mcp.sh` | local-mcp 패키지 테스트 |
| `test-aws-api.sh` | aws-api 패키지 테스트 |

### 🚀 서버 시작 스크립트

| 스크립트 | 설명 |
|---------|------|
| `start-local-mcp.sh` | Local MCP 서버 시작 (프로덕션) |
| `start-aws-api.sh` | AWS API 서버 시작 (프로덕션) |
| `dev-local-mcp.sh` | Local MCP 서버 개발 모드 |
| `dev-aws-api.sh` | AWS API 서버 개발 모드 |

### 🛑 서버 종료 스크립트

| 스크립트 | 설명 |
|---------|------|
| `stop-local-mcp.sh` | Local MCP 서버 종료 |
| `stop-aws-api.sh` | AWS API 서버 종료 |

### 🔄 서버 재시작 스크립트

| 스크립트 | 설명 |
|---------|------|
| `restart-local-mcp.sh` | Local MCP 서버 재시작 |
| `restart-aws-api.sh` | AWS API 서버 재시작 |

### 📊 모니터링 스크립트

| 스크립트 | 설명 |
|---------|------|
| `status.sh` | 전체 시스템 상태 확인 |

## 🚀 사용법

### 최초 설정
```bash
# 프로젝트 루트에서 실행
./sh/install-all.sh          # 전체 의존성 설치 (최초 1회)
./sh/test-all.sh             # 전체 테스트 실행
```

### 빠른 시작
```bash
# 프로젝트 루트에서 실행
./sh/status.sh              # 시스템 상태 확인
./sh/start-local-mcp.sh      # MCP 서버 시작
./sh/start-aws-api.sh        # AWS API 서버 시작
```

### 프로젝트 정리
```bash
./sh/clean-all.sh           # 모든 빌드 아티팩트 및 의존성 정리
./sh/install-all.sh         # 의존성 재설치
```

### 개발 모드
```bash
./sh/dev-local-mcp.sh        # MCP 서버 개발 모드 (hot reload)
./sh/dev-aws-api.sh          # AWS API 서버 개발 모드 (hot reload)
```

### 서버 관리
```bash
./sh/stop-local-mcp.sh       # MCP 서버 종료
./sh/restart-aws-api.sh      # AWS API 서버 재시작
```

## ⚙️ 환경 변수

### 필수 환경 변수

#### Local MCP Server
- `OPENAI_API_KEY`: OpenAI API 키
- `GITHUB_TOKEN`: GitHub API 토큰

#### AWS API Server
- `OPENAI_API_KEY`: OpenAI API 키
- `AWS_REGION`: AWS 리전 (기본값: us-east-1)
- `S3_BUCKET`: S3 버킷 이름
- `DYNAMODB_TABLE`: DynamoDB 테이블 이름

#### 선택적 환경 변수
- `PORT`: HTTP 서버 포트 (기본값: 3000)
- `GRPC_PORT`: gRPC 서버 포트 (기본값: 50051)

## 📁 PID 파일 관리

서버 스크립트는 프로세스 관리를 위해 PID 파일을 사용합니다:

- Local MCP Server: `/tmp/local-mcp.pid`
- AWS API Server: `/tmp/aws-api.pid`

## 🎨 스크립트 특징

### 색상 출력
모든 스크립트는 가독성을 위해 색상 코드를 사용합니다:
- 🔴 Red: 에러, 실패
- 🟡 Yellow: 경고, 주의사항
- 🔵 Blue: 정보, 진행상황
- 🟢 Green: 성공, 완료

### 에러 처리
- `set -e`: 에러 발생 시 스크립트 중단
- 환경 변수 검증
- PID 파일 관리
- Graceful shutdown 지원

### 상태 확인
- 프로세스 실행 상태 확인
- 포트 연결 테스트
- 환경 변수 검증
- Docker 서비스 상태

## 🔧 문제 해결

### 권한 에러
```bash
chmod +x ./sh/*.sh
```

### 스테일 PID 파일
```bash
rm /tmp/local-mcp.pid /tmp/aws-api.pid
```

### 포트 충돌
```bash
export PORT=3001
export GRPC_PORT=50052
./sh/start-aws-api.sh
```

## 📝 로그 확인

서버 로그는 다음과 같이 확인할 수 있습니다:

```bash
# 시스템 상태 및 로그 파일 위치 확인
./sh/status.sh

# 실시간 로그 모니터링 (개발 모드에서)
./sh/dev-local-mcp.sh
./sh/dev-aws-api.sh
```

## 🚨 주의사항

1. **환경 변수**: 프로덕션에서는 반드시 필요한 환경 변수를 설정하세요
2. **포트 충돌**: 기본 포트가 사용 중인 경우 환경 변수로 변경하세요
3. **권한**: 스크립트 실행 권한을 확인하세요
4. **PID 관리**: 서버 종료 후 PID 파일이 정상적으로 삭제되는지 확인하세요

## 💡 팁

- `status.sh`를 먼저 실행하여 시스템 전체 상태를 파악하세요
- 개발 시에는 `dev-*.sh` 스크립트를 사용하여 hot reload 기능을 활용하세요  
- 테스트는 정기적으로 `test-all.sh`로 실행하세요
- 서버 재시작이 필요한 경우 `restart-*.sh`를 사용하세요