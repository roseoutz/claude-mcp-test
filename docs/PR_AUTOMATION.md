# AI PR 자동 분석 시스템 구축 계획서

## 📋 프로젝트 개요

GitHub Pull Request 생성 시 AI(Claude)가 자동으로 코드 변경사항을 분석하고, 리뷰어가 중점적으로 확인해야 할 사항을 PR 본문에 자동으로 작성해주는 시스템

---

## 🎯 프로젝트 목적

1. **리뷰 효율성 향상**: 리뷰어가 무엇을 중점적으로 봐야 할지 미리 파악
2. **코드 품질 개선**: 잠재적 위험 요소를 사전에 식별
3. **일관된 리뷰 프로세스**: 표준화된 PR 템플릿과 분석 기준 적용
4. **시간 절약**: 자동화를 통한 리뷰 준비 시간 단축

---

## 🔧 주요 기능

### 1. 자동 PR 템플릿 적용
- PR 생성 시 자동으로 표준 템플릿 적용
- 작성자가 채워야 할 항목과 AI가 채울 항목 구분

### 2. AI 기반 코드 분석
- 두 브랜치 간 코드 diff 분석
- 변경된 파일 목록 및 변경 내용 파악
- 보안, 성능, 호환성, 코드 품질 등 다각도 분석

### 3. 자동 리뷰 가이드 생성
- 리뷰 중점 사항 체크리스트
- 잠재적 위험 요소 목록
- 영향받는 모듈/기능 정리
- 추가 제안사항

### 4. 프로젝트별 커스터마이징
- 프로젝트 특성에 맞는 분석 기준 설정
- 중요 파일 경로 지정
- 커스텀 프롬프트 적용

---

## 🛠 기술 스택

### 프론트엔드/인터페이스
- GitHub Pull Request UI
- Markdown 템플릿

### 백엔드/자동화
- GitHub Actions (CI/CD)
- Node.js (스크립트 실행 환경)

### AI/분석
- Anthropic Claude API (claude-sonnet-4-5-20250929)
- GitHub API (@octokit/rest)

---

## 📁 프로젝트 파일 구조

```
your-repository/
├── .github/
│   ├── workflows/
│   │   └── pr-analyzer.yml              # GitHub Action 워크플로우
│   ├── scripts/
│   │   ├── analyze-pr.js                # AI 분석 메인 스크립트
│   │   ├── package.json                 # Node.js 의존성
│   │   └── prompt-templates.js          # (선택) 프롬프트 템플릿 관리
│   ├── PULL_REQUEST_TEMPLATE.md         # PR 템플릿
│   └── pr-analyzer-config.json          # 분석 설정 파일
├── src/                                  # 실제 프로젝트 소스코드
└── README.md
```

---

## 📝 구현 단계

### Phase 1: 기본 구조 설정 (1일)

#### 1.1 PR 템플릿 작성
**파일**: `.github/PULL_REQUEST_TEMPLATE.md`

```markdown
# Pull Request

## 📝 변경 사항 요약
<!-- 이 PR의 주요 변경 사항을 간단히 설명해주세요 -->

## 🎯 변경 목적
<!-- 왜 이 변경이 필요한가요? -->
Closes #

## 🔍 주요 변경 내용
- 
- 

## 🤖 AI 분석 결과 (자동 생성)
<!-- GitHub Action이 자동으로 채우는 영역 -->

## ✅ 테스트 완료 항목
- [ ] 로컬 테스트
- [ ] 단위 테스트
- [ ] 통합 테스트

## 💬 추가 코멘트
```

#### 1.2 GitHub Action 워크플로우 설정
**파일**: `.github/workflows/pr-analyzer.yml`

```yaml
name: AI PR Analyzer

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd .github/scripts
          npm install
      
      - name: Get PR diff
        id: diff
        run: |
          {
            echo 'diff<<EOF'
            git diff ${{ github.event.pull_request.base.sha }}..${{ github.event.pull_request.head.sha }}
            echo EOF
          } >> $GITHUB_OUTPUT
      
      - name: Analyze PR with AI
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
          REPO_OWNER: ${{ github.repository_owner }}
          REPO_NAME: ${{ github.event.repository.name }}
        run: |
          cd .github/scripts
          node analyze-pr.js
```

### Phase 2: AI 분석 스크립트 개발 (2-3일)

#### 2.1 패키지 설정
**파일**: `.github/scripts/package.json`

```json
{
  "name": "pr-analyzer-scripts",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@anthropic-ai/sdk": "^0.20.0",
    "@octokit/rest": "^20.0.0"
  }
}
```

#### 2.2 메인 분석 스크립트
**파일**: `.github/scripts/analyze-pr.js`

**주요 기능**:
1. GitHub API를 통한 PR 정보 수집
2. Git diff 데이터 추출
3. Claude API 호출 및 프롬프트 구성
4. 분석 결과를 PR 본문에 자동 업데이트

**핵심 로직**:
```javascript
// 1. PR 정보 수집
const { data: pr } = await octokit.rest.pulls.get({
  owner, repo, pull_number: prNumber
});

// 2. AI 프롬프트 구성
const prompt = `
당신은 코드 리뷰 전문가입니다.
다음 변경사항을 분석해주세요:

## 변경된 파일: ${changedFiles}
## Diff: ${gitDiff}

다음 형식으로 분석 결과를 작성해주세요:
### 🎯 리뷰 중점 사항
### ⚠️ 잠재적 위험 요소
### 📦 영향받는 모듈
### 💡 추가 제안사항
`;

// 3. Claude API 호출
const message = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 4096,
  messages: [{ role: 'user', content: prompt }]
});

// 4. PR 본문 업데이트
await octokit.rest.pulls.update({
  owner, repo, pull_number: prNumber,
  body: originalBody + '\n\n' + aiAnalysis
});
```

### Phase 3: 설정 및 커스터마이징 (1일)

#### 3.1 분석 설정 파일
**파일**: `.github/pr-analyzer-config.json`

```json
{
  "customPrompt": "이 프로젝트는 금융 서비스입니다. 보안을 최우선으로 검토해주세요.",
  "criticalPaths": [
    "src/auth/**",
    "src/payment/**",
    "src/api/**"
  ],
  "excludePaths": [
    "**/*.test.js",
    "**/*.spec.js"
  ],
  "checklistItems": [
    "보안 취약점 확인",
    "성능 영향 검토",
    "에러 핸들링 확인"
  ]
}
```

### Phase 4: 테스트 및 배포 (1-2일)

#### 4.1 로컬 테스트
```bash
cd .github/scripts
npm install

# 환경 변수 설정
export GITHUB_TOKEN="your_token"
export ANTHROPIC_API_KEY="your_key"
export PR_NUMBER="1"

# 실행
node analyze-pr.js
```

#### 4.2 GitHub Secrets 설정
1. Repository Settings → Secrets and variables → Actions
2. 다음 Secret 추가:
    - `ANTHROPIC_API_KEY`: Claude API 키

#### 4.3 실제 PR로 테스트
1. 테스트 브랜치 생성 및 변경사항 커밋
2. PR 생성
3. GitHub Actions 실행 확인
4. PR 본문에 AI 분석 결과 추가 확인

---

## 🤖 AI 프롬프트 설계

### 분석 항목

#### 1. 보안 이슈
- 인증/인가 로직 변경
- 민감 정보 노출 가능성
- SQL Injection, XSS 등 취약점
- 입력값 검증 로직

#### 2. 성능 영향
- 데이터베이스 쿼리 변경
- N+1 쿼리 문제
- 반복문 복잡도
- 메모리 사용량

#### 3. 호환성
- API Breaking Changes
- 데이터베이스 스키마 변경
- 의존성 버전 변경
- 하위 호환성

#### 4. 코드 품질
- 에러 핸들링 누락
- 중복 코드
- 테스트 커버리지
- 코드 스멜

#### 5. 비즈니스 로직
- 핵심 프로세스 변경
- 데이터 정합성
- 예외 상황 처리

### 프롬프트 예시

```javascript
const prompt = `
당신은 경험 많은 시니어 개발자이자 코드 리뷰 전문가입니다.
다음 Pull Request의 변경사항을 분석하고 리뷰어가 중점적으로 확인해야 할 사항을 작성해주세요.

## 브랜치 정보
- Base: ${baseBranch}
- Head: ${headBranch}
- PR 제목: ${prTitle}

## 변경된 파일 목록
${changedFiles}

## 코드 Diff
\`\`\`diff
${gitDiff}
\`\`\`

## 프로젝트 컨텍스트
${projectContext}

## 분석 요청
다음 항목을 중점 분석해주세요:
1. 보안 이슈
2. 성능 영향
3. 호환성
4. 코드 품질
5. 비즈니스 로직

## 출력 형식
### 🎯 리뷰 중점 사항
- [ ] {파일명}: {확인사항}

### ⚠️ 잠재적 위험 요소
- **{카테고리}**: {설명}

### 📦 영향받는 모듈
- {모듈명}: {영향}

### 💡 추가 제안사항
- {제안}

간결하고 구체적으로 작성해주세요.
`;
```

---

## 🔐 보안 고려사항

### 1. API 키 관리
- GitHub Secrets 사용
- 환경 변수로만 접근
- 코드에 직접 하드코딩 금지

### 2. 권한 설정
```yaml
permissions:
  pull-requests: write  # PR 수정 권한
  contents: read        # 코드 읽기 권한만
```

### 3. 민감 정보 제외
- `.gitignore`에 설정 파일 추가 (필요시)
- 분석 시 비밀번호, API 키 등 제외

---

## 📊 예상 결과물

### PR 본문에 자동 추가되는 내용

```markdown
## 🤖 AI 분석 결과

### 📊 변경 통계
- 변경된 파일: 5개
- 추가된 라인: 127줄
- 삭제된 라인: 43줄

### 🎯 리뷰 중점 사항
- [ ] src/auth/login.js: JWT 토큰 생성 로직 보안 검증 필요
- [ ] src/api/users.js: SQL 쿼리 파라미터 바인딩 확인
- [ ] src/utils/validator.js: 입력값 검증 로직 강화 여부 확인

### ⚠️ 잠재적 위험 요소
- **보안**: 사용자 입력값을 직접 SQL 쿼리에 사용 (Injection 위험)
- **성능**: 반복문 내 데이터베이스 쿼리 호출 (N+1 문제)
- **호환성**: API 응답 형식 변경으로 클라이언트 영향 가능

### 📦 영향받는 모듈/기능
- 사용자 인증 시스템
- 사용자 정보 조회 API
- 입력값 검증 유틸리티

### 💡 추가 제안사항
- Prepared Statement 사용 권장
- 에러 핸들링 try-catch 추가
- 단위 테스트 추가 필요
- API 버전 관리 고려

---
✨ 이 분석은 Claude AI에 의해 자동 생성되었습니다.
```

---

## 💰 비용 예상

### Anthropic Claude API
- 모델: claude-sonnet-4-5-20250929
- 예상 비용: PR당 약 $0.01-0.05
- 월 100개 PR 기준: ~$5 이하

### GitHub Actions
- Public Repository: 무료
- Private Repository: 월 2,000분 무료 (초과 시 분당 $0.008)

---

## 📈 성능 최적화

### 1. Diff 크기 제한
```javascript
// 너무 큰 diff는 잘라서 전송
const truncatedDiff = prDiff.slice(0, 8000);
```

### 2. 캐싱
- 동일한 commit hash에 대한 분석 결과 캐싱
- 재분석 방지

### 3. 병렬 처리
- 여러 파일을 병렬로 분석 (필요시)

---

## 🔄 유지보수 계획

### 1. 정기 업데이트
- AI 모델 버전 업데이트
- 프롬프트 개선
- 분석 기준 조정

### 2. 피드백 수집
- 리뷰어 만족도 조사
- 분석 정확도 평가
- 개선 사항 반영

### 3. 모니터링
- GitHub Actions 실행 로그 확인
- API 호출 성공률 추적
- 에러 알림 설정

---

## 🎓 학습 리소스

### 공식 문서
- [GitHub Actions 문서](https://docs.github.com/en/actions)
- [Anthropic Claude API](https://docs.anthropic.com/)
- [Octokit.js](https://octokit.github.io/rest.js/)

### 참고 자료
- GitHub PR Template 작성 가이드
- CI/CD Best Practices
- Prompt Engineering Guide

---

## ✅ 체크리스트

### 설정 완료 체크
- [ ] `.github/PULL_REQUEST_TEMPLATE.md` 작성
- [ ] `.github/workflows/pr-analyzer.yml` 작성
- [ ] `.github/scripts/analyze-pr.js` 작성
- [ ] `.github/scripts/package.json` 작성
- [ ] `.github/pr-analyzer-config.json` 설정
- [ ] GitHub Secrets에 `ANTHROPIC_API_KEY` 추가
- [ ] Actions 권한 설정 확인
- [ ] 테스트 PR 생성 및 검증

### 테스트 항목
- [ ] PR 생성 시 템플릿 자동 적용
- [ ] GitHub Action 정상 실행
- [ ] AI 분석 결과 생성
- [ ] PR 본문에 결과 자동 추가
- [ ] 에러 핸들링 동작 확인

---

## 🚀 배포 후 다음 단계

### 추가 기능 고려
1. **멀티 템플릿**: Feature/Bugfix/Hotfix 별 다른 템플릿
2. **Slack 알림**: 중요한 위험 요소 발견 시 알림
3. **대시보드**: PR 분석 통계 시각화
4. **자동 레이블링**: 분석 결과에 따라 자동 레이블 추가
5. **코드 제안**: 간단한 수정사항 자동 커밋

### 팀 내 도입 절차
1. 파일럿 프로젝트에서 시험 운영
2. 팀원 피드백 수집
3. 개선 및 조정
4. 전체 프로젝트 적용

---

## 📞 문의 및 지원

- GitHub Issues를 통한 문의
- 프로젝트 문서 참조
- 팀 내부 Slack 채널

---

**작성일**: 2025년 10월 22일  
**버전**: 1.0  
**작성자**: AI PR Analyzer 개발팀