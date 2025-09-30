# 🚀 코드 영향도 분석 시스템 사용 가이드

## 📋 시작하기

### 1. 서버 실행
```bash
# aws-api 디렉토리에서
npm run dev
```
서버가 포트 3000에서 실행됩니다.

### 2. 코드베이스 인덱싱
```bash
# 프로젝트를 인덱싱
node index-and-search.js index /path/to/your/project

# 예: Java 프로젝트
node index-and-search.js index /tmp/letsgo
```

### 3. 영향도 분석 검색
```bash
# 기본 검색
node index-and-search.js search "변경하려는 내용 설명"

# 타입 지정 검색
node index-and-search.js search "JWT 토큰 검증 로직 변경" security
```

## 📝 검색 예제

### 보안 관련 변경
```bash
node index-and-search.js search "JWT 토큰 검증 로직을 BCrypt로 변경하려고 합니다" security
node index-and-search.js search "OAuth2 인증을 추가하려고 합니다" security
node index-and-search.js search "API 키 관리 시스템을 개선하려고 합니다" security
```

### API 엔드포인트 변경
```bash
node index-and-search.js search "사용자 조회 API에 페이징 기능을 추가하려고 합니다" api
node index-and-search.js search "REST API에 rate limiting을 구현하려고 합니다" api
node index-and-search.js search "GraphQL 엔드포인트를 추가하려고 합니다" api
```

### 데이터베이스 변경
```bash
node index-and-search.js search "User 테이블에 last_login 컬럼을 추가하려고 합니다" database
node index-and-search.js search "인덱스를 최적화하려고 합니다" database
node index-and-search.js search "MongoDB에서 PostgreSQL로 마이그레이션하려고 합니다" database
```

### 프론트엔드 변경
```bash
node index-and-search.js search "React Hook으로 리팩토링하려고 합니다" frontend
node index-and-search.js search "Redux를 Context API로 교체하려고 합니다" frontend
node index-and-search.js search "컴포넌트를 TypeScript로 변환하려고 합니다" frontend
```

### 인프라/설정 변경
```bash
node index-and-search.js search "로깅 시스템을 Logback으로 변경하려고 합니다" infrastructure
node index-and-search.js search "캐싱 레이어를 Redis로 구현하려고 합니다" infrastructure
node index-and-search.js search "Docker 컨테이너화를 진행하려고 합니다" infrastructure
```

## 🎯 검색 타입 옵션

| 타입 | 설명 | 사용 예시 |
|------|------|-----------|
| `general` | 일반적인 코드 변경 (기본값) | 리팩토링, 버그 수정 |
| `security` | 보안 관련 변경 | 인증, 권한, 암호화 |
| `api` | API 엔드포인트 변경 | REST, GraphQL, gRPC |
| `database` | 데이터베이스 관련 변경 | 스키마, 쿼리, 마이그레이션 |
| `frontend` | 프론트엔드 변경 | UI, 상태관리, 컴포넌트 |
| `infrastructure` | 인프라/설정 변경 | 로깅, 캐싱, 배포 |
| `performance` | 성능 최적화 | 쿼리 최적화, 캐싱, 알고리즘 |
| `testing` | 테스트 관련 변경 | 단위 테스트, 통합 테스트 |

## 🔍 분석 결과 해석

### 영향도 수준
- **CRITICAL (90-100%)**: 핵심 기능에 직접적인 영향, 즉각적인 주의 필요
- **HIGH (70-89%)**: 중요 기능에 영향, 신중한 검토 필요
- **MEDIUM (40-69%)**: 일반적인 영향, 표준 검토 프로세스
- **LOW (0-39%)**: 최소한의 영향, 간단한 검토

### 위험 수준
- **CRITICAL**: 시스템 전체에 영향, 롤백 계획 필수
- **HIGH**: 주요 기능 영향, 상세 테스트 필요
- **MEDIUM**: 일부 기능 영향, 일반 테스트
- **LOW**: 격리된 변경, 기본 테스트

## 📊 API 직접 호출

### cURL로 검색
```bash
curl -X POST http://localhost:3000/api/v1/impact/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "query": "JWT 토큰 검증 로직 변경",
    "type": "security",
    "repositoryPath": "/tmp/letsgo"
  }'
```

### Node.js에서 호출
```javascript
const response = await fetch('http://localhost:3000/api/v1/impact/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "변경 내용 설명",
    type: "general",
    repositoryPath: "/path/to/project"
  })
});

const result = await response.json();
```

## ⚙️ 설정

### 환경 변수 (.env)
```bash
OPENAI_API_KEY=your_api_key_here  # 필수: OpenAI API 키
PORT=3000                          # HTTP 서버 포트
GRPC_PORT=50051                   # gRPC 서버 포트
```

## 🐛 문제 해결

### 서버가 시작되지 않음
```bash
# 포트 확인
lsof -i :3000
lsof -i :50051

# 프로세스 종료
kill -9 <PID>
```

### 인덱싱이 실패함
- OpenAI API 키 확인
- 네트워크 연결 확인
- 파일 권한 확인

### 검색 결과가 없음
- 먼저 코드베이스를 인덱싱했는지 확인
- 검색 쿼리를 더 구체적으로 작성
- 적절한 타입을 지정

## 📚 고급 사용법

### 배치 인덱싱
```bash
# 여러 프로젝트 인덱싱
for project in /projects/*; do
  node index-and-search.js index "$project"
done
```

### 결과 저장
```bash
# JSON 파일로 저장
node index-and-search.js search "변경 내용" | tee analysis.json
```

### CI/CD 통합
```yaml
# GitHub Actions 예제
- name: Impact Analysis
  run: |
    npm run dev &
    sleep 5
    node index-and-search.js index .
    node index-and-search.js search "${{ github.event.pull_request.title }}"
```