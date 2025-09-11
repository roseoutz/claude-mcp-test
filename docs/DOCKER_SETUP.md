# Docker 개발 환경 설정 가이드

## 📋 목차
1. [빠른 시작](#빠른-시작)
2. [서비스 구성](#서비스-구성)
3. [접속 정보](#접속-정보)
4. [보안 설정](#보안-설정)
5. [운영 명령어](#운영-명령어)
6. [문제 해결](#문제-해결)

## 🚀 빠른 시작

### 1. 환경 변수 설정
```bash
# .env 파일 생성
cp .env.example .env

# .env 파일 편집하여 필요한 값 설정
# 특히 OPENAI_API_KEY는 필수!
nano .env
```

### 2. Docker Compose 실행
```bash
# 모든 서비스 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 특정 서비스만 시작
docker-compose up -d chromadb redis postgres
```

### 3. 서비스 상태 확인
```bash
# 모든 컨테이너 상태 확인
docker-compose ps

# 헬스체크
curl http://localhost/health
```

## 🏗️ 서비스 구성

### 전체 아키텍처
```
┌─────────────────────────────────────────────────────┐
│                   Nginx (80, 443)                   │
│                   Reverse Proxy                      │
└─────────────┬───────────────────────────────────────┘
              │
    ┌─────────┼─────────┬──────────┬──────────┐
    ▼         ▼         ▼          ▼          ▼
ChromaDB   Redis    PostgreSQL   MinIO    MCP App
 (8000)    (6379)     (5432)     (9000)    (8080)
    │         │          │          │          │
    └─────────┴──────────┴──────────┴──────────┘
              172.28.0.0/16 Network
```

### 서비스별 역할

| 서비스 | 포트 | 역할 | 컨테이너 이름 |
|--------|------|------|---------------|
| **ChromaDB** | 8000 | 벡터 데이터베이스 (임베딩 저장) | mcp-chromadb |
| **Redis** | 6379 | 캐시 & 세션 스토어 | mcp-redis |
| **PostgreSQL** | 5432 | 메타데이터 & 분석 결과 저장 | mcp-postgres |
| **MinIO** | 9000, 9001 | S3 호환 파일 스토리지 | mcp-minio |
| **Nginx** | 80, 443 | 리버스 프록시 & 로드 밸런서 | mcp-nginx |
| **Redis Commander** | 8081 | Redis 웹 UI | mcp-redis-commander |
| **pgAdmin** | 5050 | PostgreSQL 웹 UI | mcp-pgadmin |

## 🔐 접속 정보

### 웹 UI 접속
모든 웹 UI는 Nginx를 통해 접속 가능합니다:

| 서비스 | URL | 계정 정보 |
|--------|-----|-----------|
| **ChromaDB API** | http://localhost/chromadb/ | Token: `chroma-token-change-in-production-abc123!@#` |
| **Redis Commander** | http://localhost/redis/ | ID: `admin` / PW: `admin123!@#` |
| **pgAdmin** | http://localhost/pgadmin/ | Email: `admin@mcp.local` / PW: `pgadmin123!@#` |
| **MinIO Console** | http://localhost/minio/ | ID: `minioadmin` / PW: `minio123!@#` |

### 직접 포트 접속
개발 중 직접 접속이 필요한 경우:

```bash
# ChromaDB
curl -H "Authorization: Bearer chroma-token-change-in-production-abc123!@#" \
     http://localhost:8000/api/v1/collections

# Redis
redis-cli -h localhost -p 6379 -a redis123!@#

# PostgreSQL
psql -h localhost -p 5432 -U mcp_user -d mcp_db
# Password: postgres123!@#

# MinIO (S3 CLI)
aws s3 ls --endpoint-url http://localhost:9000 \
    --access-key minioadmin \
    --secret-key minio123!@#
```

## 🔒 보안 설정

### 프로덕션 배포 전 필수 변경 사항

⚠️ **중요**: 프로덕션 환경에서는 반드시 모든 기본 비밀번호를 변경하세요!

1. **.env 파일의 모든 비밀번호 변경**
```bash
# 강력한 비밀번호 생성
openssl rand -base64 32

# 또는 pwgen 사용
pwgen -s 32 1
```

2. **환경별 설정 분리**
```bash
# 개발 환경
cp .env.example .env.development

# 프로덕션 환경
cp .env.example .env.production
```

3. **SSL/TLS 인증서 설정**
```bash
# Let's Encrypt 인증서 생성
docker run --rm -v ./docker/nginx/certs:/etc/letsencrypt \
    certbot/certbot certonly --standalone \
    -d your-domain.com
```

### 방화벽 설정 (프로덕션)
```bash
# 필요한 포트만 열기
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 8000/tcp  # ChromaDB 직접 접근 차단
sudo ufw deny 6379/tcp  # Redis 직접 접근 차단
sudo ufw deny 5432/tcp  # PostgreSQL 직접 접근 차단
```

## 🔧 운영 명령어

### 기본 명령어
```bash
# 전체 시작
docker-compose up -d

# 전체 중지
docker-compose down

# 전체 중지 + 볼륨 삭제 (데이터 초기화)
docker-compose down -v

# 재시작
docker-compose restart

# 특정 서비스 재시작
docker-compose restart chromadb
```

### 로그 확인
```bash
# 전체 로그
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f chromadb

# 최근 100줄만
docker-compose logs --tail=100 redis
```

### 백업
```bash
# PostgreSQL 백업
docker exec mcp-postgres pg_dump -U mcp_user mcp_db > backup_$(date +%Y%m%d).sql

# Redis 백업
docker exec mcp-redis redis-cli --rdb /data/dump.rdb BGSAVE

# 전체 볼륨 백업
docker run --rm -v mcp_postgres-data:/data -v $(pwd):/backup \
    alpine tar czf /backup/postgres_backup_$(date +%Y%m%d).tar.gz /data
```

### 복원
```bash
# PostgreSQL 복원
docker exec -i mcp-postgres psql -U mcp_user mcp_db < backup_20240101.sql

# Redis 복원
docker cp dump.rdb mcp-redis:/data/dump.rdb
docker-compose restart redis
```

### 성능 모니터링
```bash
# 컨테이너 리소스 사용량
docker stats

# ChromaDB 상태
curl -H "Authorization: Bearer chroma-token-change-in-production-abc123!@#" \
     http://localhost:8000/api/v1/heartbeat

# Redis 정보
docker exec mcp-redis redis-cli INFO

# PostgreSQL 연결 수
docker exec mcp-postgres psql -U mcp_user -c "SELECT count(*) FROM pg_stat_activity;"
```

## 🐛 문제 해결

### 1. 컨테이너가 시작되지 않는 경우
```bash
# 상세 로그 확인
docker-compose logs [service-name]

# 개별 컨테이너 상태 확인
docker inspect mcp-[service-name]

# 포트 충돌 확인
netstat -tulpn | grep [port-number]
```

### 2. 메모리 부족
```bash
# Docker 메모리 설정 확인
docker system info | grep Memory

# 불필요한 리소스 정리
docker system prune -a
```

### 3. 연결 문제
```bash
# 네트워크 확인
docker network ls
docker network inspect ai.mcp.turner-code-ai-mcp_mcp-network

# DNS 확인
docker exec [container] nslookup [service-name]
```

### 4. 데이터 초기화
```bash
# 특정 서비스 데이터만 초기화
docker-compose stop chromadb
docker volume rm ai.mcp.turner-code-ai-mcp_chroma-data
docker-compose up -d chromadb

# 전체 초기화
docker-compose down -v
docker-compose up -d
```

### 5. 권한 문제
```bash
# 볼륨 권한 확인
ls -la /var/lib/docker/volumes/

# 권한 수정
sudo chown -R 1000:1000 ./data
```

## 📊 헬스체크

### 자동 헬스체크 스크립트
```bash
#!/bin/bash
# healthcheck.sh

echo "🔍 MCP 서비스 상태 확인..."

# ChromaDB
if curl -s -H "Authorization: Bearer chroma-token-change-in-production-abc123!@#" \
   http://localhost:8000/api/v1/heartbeat > /dev/null; then
    echo "✅ ChromaDB: 정상"
else
    echo "❌ ChromaDB: 응답 없음"
fi

# Redis
if docker exec mcp-redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis: 정상"
else
    echo "❌ Redis: 응답 없음"
fi

# PostgreSQL
if docker exec mcp-postgres pg_isready > /dev/null 2>&1; then
    echo "✅ PostgreSQL: 정상"
else
    echo "❌ PostgreSQL: 응답 없음"
fi

# MinIO
if curl -s http://localhost:9000/minio/health/live > /dev/null; then
    echo "✅ MinIO: 정상"
else
    echo "❌ MinIO: 응답 없음"
fi
```

## 🔄 업데이트

### 이미지 업데이트
```bash
# 최신 이미지 다운로드
docker-compose pull

# 재시작
docker-compose up -d
```

### 설정 변경 적용
```bash
# 설정 파일 수정 후
docker-compose restart [service-name]

# 또는 전체 재생성
docker-compose up -d --force-recreate
```

## 📝 추가 설정

### 1. 외부 접근 허용
```yaml
# docker-compose.override.yml 생성
version: '3.8'
services:
  nginx:
    ports:
      - "0.0.0.0:80:80"    # 모든 인터페이스에서 접근 가능
      - "0.0.0.0:443:443"
```

### 2. 볼륨 경로 커스터마이징
```yaml
# 로컬 디렉토리 사용
volumes:
  chroma-data:
    driver: local
    driver_opts:
      type: none
      device: /data/mcp/chromadb
      o: bind
```

### 3. 리소스 제한
```yaml
services:
  chromadb:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

## 📞 지원

문제가 지속되면:
1. 로그 파일 확인: `docker-compose logs > debug.log`
2. GitHub Issues에 보고
3. 디버그 모드 활성화: `.env`에서 `LOG_LEVEL=DEBUG` 설정