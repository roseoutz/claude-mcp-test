# Git Authentication Configuration

Private Git repositories를 clone하고 분석하기 위한 인증 설정 방법을 설명합니다.

## 🔑 지원하는 인증 방식

### 1. GitHub Personal Access Token (권장)
가장 간단하고 안전한 방법입니다.

**application.yml 설정:**
```yaml
mcp:
  git:
    workspace: "/tmp/mcp-workspace"
    auth:
      type: TOKEN
      token: "ghp_your_github_personal_access_token_here"
```

**환경변수로 설정:**
```bash
export MCP_GIT_AUTH_TYPE=TOKEN
export MCP_GIT_AUTH_TOKEN=ghp_your_github_personal_access_token_here
```

### 2. Username/Password 인증
```yaml
mcp:
  git:
    auth:
      type: USERNAME_PASSWORD
      username: "your-username"
      password: "your-password-or-token"
```

### 3. SSH Key 인증 (미구현)
현재는 지원하지 않습니다. 향후 구현 예정입니다.
```yaml
mcp:
  git:
    auth:
      type: SSH_KEY
      ssh-key-path: "/path/to/your/private/key"
      ssh-passphrase: "optional-passphrase"
```

## 📋 GitHub Personal Access Token 생성 방법

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. "Generate new token (classic)" 클릭
3. 필요한 권한 선택:
   - `repo` - private repository 접근용
   - `read:org` - organization repository 접근용 (필요시)
4. 생성된 토큰을 복사하여 설정에 사용

## 🚀 사용 예제

### MCP Tool 호출 시
```json
{
  "method": "learn_codebase",
  "params": {
    "repo_url": "https://github.com/your-org/private-repo.git",
    "branch": "main",
    "force_reindex": false
  }
}
```

### 지원하는 Git URL 형식
- HTTPS: `https://github.com/user/repo.git`
- SSH: `git@github.com:user/repo.git` (SSH 키 인증 구현 시)

## ⚠️ 보안 주의사항

1. **토큰을 코드에 하드코딩하지 마세요**
2. **환경변수나 외부 설정 파일을 사용하세요**
3. **토큰에 최소 필요한 권한만 부여하세요**
4. **토큰을 정기적으로 갱신하세요**

## 🔧 설정 검증

Git 인증이 올바르게 설정되었는지 확인하는 방법:

```bash
# 로그에서 인증 관련 메시지 확인
tail -f logs/application.log | grep -i "git\|auth"
```

성공적인 clone 시 로그 예시:
```
INFO  JGitAdapter - 저장소 복제 완료: https://github.com/user/repo.git -> /tmp/mcp-workspace/repo
```

인증 실패 시 로그 예시:
```
ERROR JGitAdapter - 저장소 복제 실패: https://github.com/user/repo.git
```

## 🐛 문제 해결

### 401 Unauthorized 오류
- 토큰이 만료되었거나 잘못되었습니다
- 토큰 권한이 부족합니다
- Repository 접근 권한이 없습니다

### 403 Forbidden 오류  
- Repository에 대한 접근 권한이 없습니다
- Organization의 SSO가 활성화된 경우 토큰을 승인해야 합니다

### 연결 타임아웃 오류
- 네트워크 연결을 확인하세요
- 프록시 설정을 확인하세요