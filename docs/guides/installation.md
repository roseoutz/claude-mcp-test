# 🔧 상세 설치 가이드

> 지능형 코드 검색 시스템의 완전한 설치와 설정 방법

## 📋 시스템 요구사항

### 필수 요구사항
- **Node.js**: 22.0.0 이상
- **npm**: 10.x 이상
- **메모리**: 최소 4GB RAM (AI 처리용)
- **디스크**: 최소 10GB 여유 공간

### 선택적 요구사항
- **Docker**: 18.0+ (Elasticsearch 실행용)
- **Git**: 2.0+ (저장소 관리용)

## 🔑 API 키 준비

### OpenAI API 키 (필수)
1. [OpenAI 웹사이트](https://platform.openai.com) 방문
2. 계정 생성 후 API 키 생성
3. 사용량 제한 설정 (권장: 월 $20)

### Anthropic API 키 (선택사항)
1. [Anthropic Console](https://console.anthropic.com) 방문
2. API 키 생성 (Claude 모델용)

## 💻 설치 과정

### 1단계: 저장소 클론

```bash
# HTTPS로 클론
git clone https://github.com/your-org/code-ai-mcp-node.git
cd code-ai-mcp-node

# 또는 SSH로 클론 (권장)
git clone git@github.com:your-org/code-ai-mcp-node.git
cd code-ai-mcp-node
```

### 2단계: 의존성 설치

```bash
# 모든 패키지 의존성 설치
npm install

# 개별 패키지 설치 (문제 발생시)
npm install --workspace=@code-ai/shared
npm install --workspace=@code-ai/local-mcp
npm install --workspace=@code-ai/aws-api
```

### 3단계: 환경변수 설정

```bash
# 환경변수 템플릿 복사
cp .env.example .env

# 환경변수 편집
nano .env
```

#### 필수 환경변수
```bash
# AI 서비스 (필수)
OPENAI_API_KEY=your_openai_api_key_here

# 검색 엔진 (기본값 사용 가능)
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=intelligent-codebase

# 로그 레벨
LOG_LEVEL=info
```

#### 선택적 환경변수
```bash
# Anthropic (Claude 사용시)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# 성능 튜닝
AI_BATCH_SIZE=10
MAX_FILE_SIZE=1048576
SEARCH_TIMEOUT=5000

# 보안 설정
ENABLE_CORS=true
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### 4단계: 빌드

```bash
# 전체 프로젝트 빌드
npm run build

# 개별 패키지 빌드 (필요시)
npm run build --workspace=@code-ai/shared
npm run build --workspace=@code-ai/local-mcp
npm run build --workspace=@code-ai/aws-api
```

## 🐳 Docker 설정 (권장)

### Elasticsearch 실행
```bash
# Elasticsearch만 실행
docker-compose up elasticsearch -d

# 모든 인프라 서비스 실행
docker-compose up -d

# 상태 확인
docker-compose ps
```

### Elasticsearch 설정 확인
```bash
# 클러스터 상태 확인
curl http://localhost:9200/_cluster/health

# 인덱스 목록 확인
curl http://localhost:9200/_cat/indices
```

## 🧪 설치 검증

### 1. 기본 빌드 테스트
```bash
# 타입스크립트 컴파일 확인
npm run build

# 린트 검사
npm run lint

# 유닛 테스트
npm test
```

### 2. 서비스 연결 테스트
```bash
# 로컬 MCP 서버 실행
npm run dev:local

# 다른 터미널에서 AWS API 서버 실행
npm run dev:aws

# 헬스체크 확인
curl http://localhost:3001/health
curl http://localhost:3000/health
```

### 3. AI 서비스 테스트
```typescript
// test-ai-connection.ts
import { AIService } from '@code-ai/shared/services';

async function testAI() {
  const ai = new AIService();

  try {
    const response = await ai.chat([{
      role: 'user',
      content: 'Hello! This is a connection test.'
    }]);

    console.log('✅ AI Service 연결 성공');
    console.log('응답:', response);
  } catch (error) {
    console.error('❌ AI Service 연결 실패:', error);
  }
}

testAI();
```

```bash
# AI 연결 테스트 실행
npx tsx test-ai-connection.ts
```

## ⚙️ 설정 최적화

### 성능 최적화
```bash
# .env 파일에 추가
# AI 요청 배치 크기 (API 제한 고려)
AI_BATCH_SIZE=5

# 파일 크기 제한 (1MB)
MAX_FILE_SIZE=1048576

# 검색 타임아웃 (5초)
SEARCH_TIMEOUT=5000

# 메모리 사용량 제한
NODE_OPTIONS="--max-old-space-size=4096"
```

### 보안 설정
```bash
# API 키 보안
chmod 600 .env

# 방화벽 설정 (필요시)
sudo ufw allow 3000/tcp  # AWS API
sudo ufw allow 3001/tcp  # Local MCP
sudo ufw allow 9200/tcp  # Elasticsearch
```

## 🔍 문제 해결

### 일반적인 문제들

#### 1. "MODULE_NOT_FOUND" 에러
```bash
# 의존성 재설치
rm -rf node_modules package-lock.json
npm install

# 빌드 재실행
npm run build
```

#### 2. Elasticsearch 연결 실패
```bash
# 컨테이너 상태 확인
docker-compose ps elasticsearch

# 로그 확인
docker-compose logs elasticsearch

# 재시작
docker-compose restart elasticsearch
```

#### 3. AI API 키 문제
```bash
# API 키 확인
echo $OPENAI_API_KEY

# 권한 테스트
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models
```

#### 4. 포트 충돌
```bash
# 사용중인 포트 확인
lsof -i :3000
lsof -i :3001
lsof -i :9200

# 프로세스 종료
kill -9 <PID>
```

### 로그 확인
```bash
# 애플리케이션 로그
tail -f logs/application.log

# Docker 로그
docker-compose logs -f

# 시스템 로그
journalctl -f -u your-service
```

## 🎯 다음 단계

설치가 완료되었다면:

1. **🚀 [빠른 시작](./quick-start.md)** - 첫 번째 분석 실행
2. **📖 [사용법 가이드](./intelligent-search.md)** - 상세 기능 학습
3. **🛠️ [개발자 가이드](./developer-guide.md)** - 커스터마이징 방법

## 💡 팁과 권장사항

### 첫 번째 사용 시
1. **작은 프로젝트부터 시작**: 100개 이하 파일로 테스트
2. **진행상황 모니터링**: `onProgress` 콜백 활용
3. **API 사용량 확인**: OpenAI 대시보드에서 비용 모니터링

### 프로덕션 환경
1. **환경변수 보안**: `.env` 파일을 Git에서 제외
2. **리소스 모니터링**: 메모리와 디스크 사용량 주시
3. **백업 설정**: Elasticsearch 데이터 정기 백업
4. **로그 로테이션**: 로그 파일 크기 관리

---

## 🆘 도움이 필요하세요?

- 🐛 **설치 문제**: [Issue 제출](https://github.com/your-repo/issues)
- 💬 **질문하기**: [토론 포럼](https://github.com/your-repo/discussions)
- 📖 **문서 개선**: [Pull Request 환영](https://github.com/your-repo/pulls)

**설치가 완료되면 놀라운 AI 기반 코드 검색을 경험해보세요!** ✨