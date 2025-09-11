// GitHub 및 Git 저장소 인증 서비스

export interface GitCredentials {
  type: 'personal_token' | 'oauth2' | 'ssh_key';
  token?: string;
  username?: string;
  email?: string;
  sshKeyPath?: string;
}

export interface RepositoryPermissions {
  canRead: boolean;
  canWrite: boolean;
  isPublic: boolean;
  owner: string;
  name: string;
}

export class AuthService {
  private credentials: Map<string, GitCredentials> = new Map();

  /**
   * Personal Access Token 설정
   */
  setPersonalAccessToken(repoUrl: string, token: string, username?: string): void {
    this.credentials.set(repoUrl, {
      type: 'personal_token',
      token,
      username,
    });
  }

  /**
   * GitHub 저장소 권한 확인
   */
  async validateRepositoryAccess(repoUrl: string): Promise<RepositoryPermissions> {
    const credentials = this.credentials.get(repoUrl);
    
    if (!credentials) {
      // 공개 저장소인지 확인
      return await this.checkPublicRepository(repoUrl);
    }

    switch (credentials.type) {
      case 'personal_token':
        return await this.validateWithPersonalToken(repoUrl, credentials.token!);
      case 'oauth2':
        return await this.validateWithOAuth2(repoUrl, credentials.token!);
      default:
        throw new Error('지원되지 않는 인증 방식입니다');
    }
  }

  private async checkPublicRepository(repoUrl: string): Promise<RepositoryPermissions> {
    try {
      const { owner, name } = this.parseGitHubUrl(repoUrl);
      const response = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'code-ai-mcp-node/1.0.0',
        },
      });

      if (response.status === 404) {
        throw new Error('저장소를 찾을 수 없거나 비공개 저장소입니다');
      }

      if (!response.ok) {
        throw new Error(`GitHub API 오류: ${response.status} ${response.statusText}`);
      }

      const repoData = await response.json();

      return {
        canRead: true,
        canWrite: false,
        isPublic: !repoData.private,
        owner,
        name,
      };
    } catch (error) {
      throw new Error(`저장소 접근 검증 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  private async validateWithPersonalToken(repoUrl: string, token: string): Promise<RepositoryPermissions> {
    try {
      const { owner, name } = this.parseGitHubUrl(repoUrl);
      
      // 토큰의 권한 및 저장소 접근 권한 확인
      const [repoResponse, userResponse] = await Promise.all([
        fetch(`https://api.github.com/repos/${owner}/${name}`, {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'code-ai-mcp-node/1.0.0',
          },
        }),
        fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'code-ai-mcp-node/1.0.0',
          },
        })
      ]);

      if (!repoResponse.ok) {
        if (repoResponse.status === 404) {
          throw new Error('저장소를 찾을 수 없거나 접근 권한이 없습니다');
        }
        throw new Error(`GitHub API 오류: ${repoResponse.status} ${repoResponse.statusText}`);
      }

      if (!userResponse.ok) {
        throw new Error('유효하지 않은 Personal Access Token입니다');
      }

      const repoData = await repoResponse.json();
      const userData = await userResponse.json();

      // 토큰 권한 스코프 확인 (실제로는 헤더에서 X-OAuth-Scopes를 확인해야 함)
      const scopes = repoResponse.headers.get('X-OAuth-Scopes') || '';
      const canWrite = scopes.includes('repo') || scopes.includes('public_repo');

      return {
        canRead: true,
        canWrite: canWrite && repoData.permissions?.push === true,
        isPublic: !repoData.private,
        owner,
        name,
      };
    } catch (error) {
      throw new Error(`Personal Access Token 검증 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  private async validateWithOAuth2(repoUrl: string, token: string): Promise<RepositoryPermissions> {
    // OAuth2 구현은 더 복잡하므로 향후 구현
    throw new Error('OAuth2 인증은 아직 구현되지 않았습니다');
  }

  private parseGitHubUrl(repoUrl: string): { owner: string; name: string } {
    // GitHub URL 파싱
    const patterns = [
      /github\.com[\/:]([^\/]+)\/([^\/\s]+?)(?:\.git)?$/,
      /github\.com\/([^\/]+)\/([^\/\s]+)/,
    ];

    for (const pattern of patterns) {
      const match = repoUrl.match(pattern);
      if (match) {
        return {
          owner: match[1],
          name: match[2].replace(/\.git$/, ''),
        };
      }
    }

    throw new Error('유효하지 않은 GitHub URL입니다');
  }

  /**
   * 환경 변수에서 인증 정보 로드
   */
  loadCredentialsFromEnv(): void {
    const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    const githubUsername = process.env.GITHUB_USERNAME;
    
    if (githubToken) {
      // 기본적으로 모든 GitHub 저장소에 대해 이 토큰을 사용
      this.credentials.set('github.com', {
        type: 'personal_token',
        token: githubToken,
        username: githubUsername,
      });
      
      console.error('[INFO] GitHub Personal Access Token이 환경 변수에서 로드되었습니다');
    } else {
      console.error('[WARNING] GitHub 인증 토큰이 설정되지 않았습니다. 공개 저장소만 접근 가능합니다');
    }
  }

  /**
   * 특정 저장소의 인증 정보 가져오기
   */
  getCredentialsForRepo(repoUrl: string): GitCredentials | null {
    // 정확한 URL 매치 시도
    let credentials = this.credentials.get(repoUrl);
    
    if (!credentials) {
      // 호스트별 기본 인증 정보 사용
      try {
        const url = new URL(repoUrl);
        credentials = this.credentials.get(url.hostname);
      } catch {
        // URL 파싱 실패 시 무시
      }
    }
    
    return credentials || null;
  }

  /**
   * 인증이 필요한 Git 작업을 위한 환경 변수 설정
   */
  getGitEnvironment(repoUrl: string): Record<string, string> {
    const credentials = this.getCredentialsForRepo(repoUrl);
    const env: Record<string, string> = {};

    if (credentials && credentials.type === 'personal_token') {
      // Git에서 HTTPS 인증에 사용할 환경 변수 설정
      env['GIT_ASKPASS'] = 'echo';
      env['GIT_USERNAME'] = credentials.username || 'token';
      env['GIT_PASSWORD'] = credentials.token!;
    }

    return env;
  }
}

// 전역 인증 서비스 인스턴스
export const authService = new AuthService();

// 애플리케이션 시작 시 환경 변수에서 인증 정보 로드
authService.loadCredentialsFromEnv();