# PR Analyzer Scripts

AI 기반 Pull Request 자동 분석 스크립트입니다.

## 📦 설치

```bash
cd .github/scripts
npm install
```

## 🧪 테스트 방법

### 1. 로컬 테스트 (Mock 데이터)

Mock 데이터를 사용하여 스크립트를 테스트합니다:

```bash
# API 키 설정
export ANTHROPIC_API_KEY="your_anthropic_api_key_here"

# 테스트 실행
node test-analyzer.js

# 프롬프트 미리보기 옵션
node test-analyzer.js --show-prompt
```

**결과**:
- 콘솔에 분석 결과 출력
- `test-result.md` 파일에 결과 저장

### 2. 실제 PR 테스트

실제 GitHub PR에 대해 테스트:

```bash
# 환경 변수 설정
export GITHUB_TOKEN="ghp_your_github_token"
export ANTHROPIC_API_KEY="your_anthropic_api_key"
export PR_NUMBER="123"
export REPO_OWNER="your-org"
export REPO_NAME="your-repo"
export BASE_BRANCH="main"
export HEAD_BRANCH="feature/your-feature"
export PR_TITLE="Your PR title"

# 실행
node analyze-pr.js
```

## 📝 파일 설명

### `analyze-pr.js`
- GitHub Actions에서 실행되는 메인 스크립트
- 실제 PR 정보를 GitHub API로 가져와서 분석
- PR 본문을 자동으로 업데이트

### `test-analyzer.js`
- 로컬 테스트용 스크립트
- Mock 데이터를 사용하여 API 연동 없이 테스트 가능
- 분석 결과를 파일로 저장

### `package.json`
- 필요한 의존성 정의
- `@anthropic-ai/sdk`: Claude AI 연동
- `@octokit/rest`: GitHub API 연동

## ⚙️ 설정

### GitHub Secrets 설정

Repository Settings → Secrets and variables → Actions:

| Secret Name | 설명 |
|------------|------|
| `ANTHROPIC_API_KEY` | Anthropic Claude API 키 |
| `GITHUB_TOKEN` | 자동 제공됨 (별도 설정 불필요) |

### 분석 설정 (선택사항)

`.github/pr-analyzer-config.json` 파일을 수정하여 커스터마이징:

```json
{
  "customPrompt": "프로젝트별 추가 컨텍스트",
  "criticalPaths": ["중요한 파일 경로"],
  "excludePaths": ["제외할 파일 경로"],
  "checklistItems": ["커스텀 체크리스트"]
}
```

## 🎯 분석 목적

**코드 리뷰가 아닌, 변경 사항 요약**

파일이 많은 PR에서 리뷰어가:
- "무엇이 바뀌었는지" 빠르게 파악
- "왜 바뀌었는지" 맥락 이해
- "어떤 영향이 있는지" 전체 그림 이해

## 📋 AI 분석 결과 구조

### 1. **📋 한눈에 보는 변경 사항**
- PR 전체를 1-2문장으로 요약
- 변경 통계 (파일 수, 라인 수, 변경 유형)

### 2. **🗂️ 파일별 변경 요약**
- 파일들을 **기능/목적별로 카테고리 그룹화**
  - 예: "라우터 변경", "새 서비스 추가", "설정 파일 수정"
- 각 카테고리마다:
  - 📋 파일 목록 (표 형식)
  - 🤔 왜 변경했는지
  - 📊 어떤 영향이 있는지

### 3. **🎯 이번 PR의 핵심 스토리**
- 변경의 흐름을 순서대로 설명
  - 1단계 → 2단계 → 3단계
- 주요 의사결정과 이유

### 4. **🔄 변경 사항 연관 다이어그램**
- Before/After 구조 비교
- 파일 간 관계도
- 주요 연관성 설명

### 5. **💡 리뷰 시 참고사항**
- 특히 확인하면 좋은 부분
- 주의할 부분 (필요 시)
- Breaking Changes 여부
- 의존성 변경 사항

## 🐛 문제 해결

### "ANTHROPIC_API_KEY가 설정되지 않았습니다"
```bash
export ANTHROPIC_API_KEY="your_key_here"
```

### "패키지를 찾을 수 없습니다"
```bash
cd .github/scripts
npm install
```

### "GitHub API 호출 실패"
- GitHub Token 권한 확인
- Repository 접근 권한 확인
- Rate limit 확인

## 📊 비용

- **Claude Sonnet 4.5**: PR당 약 $0.01-0.05
- **GitHub Actions**: Public repo 무료, Private repo 월 2,000분 무료

## 🔗 관련 문서

- [Anthropic Claude API](https://docs.anthropic.com/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Octokit.js](https://octokit.github.io/rest.js/)
