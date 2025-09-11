# AWS 기반 사내 MCP 서버 배포 가이드

## 📋 아키텍처 개요

사내 개발자들이 안전하게 GitHub 등 외부 저장소에 접근할 수 있도록 하는 MCP 서버 아키텍처입니다.

## 🏗️ 핵심 컴포넌트

### 1. **인증 및 권한 관리**

#### 다층 인증 전략
```yaml
Layer 1 - User Authentication:
  - AWS IAM (개발자 AWS 계정)
  - SAML/OIDC (회사 SSO)
  - API Key (Claude Desktop → MCP)

Layer 2 - Service Authentication:
  - AWS Secrets Manager (GitHub PAT 저장)
  - IAM Role 기반 접근
  - KMS 암호화

Layer 3 - Repository Access:
  - Organization-level GitHub App
  - IP 화이트리스팅 (AWS NAT Gateway)
  - Repository 화이트리스트
```

### 2. **배포 옵션**

#### Option A: ECS Fargate (권장)
```typescript
// infrastructure/ecs-task-definition.json
{
  "family": "mcp-server",
  "taskRoleArn": "arn:aws:iam::123456789012:role/mcp-server-task-role",
  "executionRoleArn": "arn:aws:iam::123456789012:role/mcp-server-execution-role",
  "networkMode": "awsvpc",
  "containerDefinitions": [{
    "name": "mcp-server",
    "image": "your-ecr-repo/mcp-server:latest",
    "environment": [
      {"name": "NODE_ENV", "value": "production"},
      {"name": "AWS_REGION", "value": "ap-northeast-2"}
    ],
    "secrets": [
      {
        "name": "GITHUB_TOKEN",
        "valueFrom": "arn:aws:secretsmanager:region:account:secret:mcp/github-token"
      }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/mcp-server",
        "awslogs-region": "ap-northeast-2",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }]
}
```

#### Option B: Lambda + API Gateway
```typescript
// infrastructure/lambda-handler.ts
import { APIGatewayProxyHandler } from 'aws-lambda';
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

const secretsManager = new SecretsManager();

export const handler: APIGatewayProxyHandler = async (event) => {
  // WebSocket 연결 처리
  const connectionId = event.requestContext.connectionId;
  
  // Secrets Manager에서 GitHub 토큰 가져오기
  const secret = await secretsManager.getSecretValue({
    SecretId: 'mcp/github-tokens'
  });
  
  // MCP 요청 처리
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Processed' })
  };
};
```

### 3. **GitHub 접근 제어 해결책**

#### 조직 수준 관리
```typescript
// src/config/repository-whitelist.ts

export interface RepositoryPolicy {
  pattern: string;           // 레포지토리 패턴 (예: "mycompany/*")
  allowedBranches?: string[]; // 허용된 브랜치
  maxFileSize?: number;      // 최대 파일 크기
  allowedOperations: ('read' | 'analyze' | 'diff')[];
}

export const COMPANY_REPOSITORY_POLICIES: RepositoryPolicy[] = [
  {
    // 회사 조직 저장소는 모두 허용
    pattern: "mycompany/*",
    allowedOperations: ['read', 'analyze', 'diff']
  },
  {
    // 특정 오픈소스 저장소만 허용
    pattern: "facebook/react",
    allowedBranches: ['main', 'stable'],
    allowedOperations: ['read']
  },
  {
    // 파트너 회사 저장소
    pattern: "partner-org/shared-*",
    allowedOperations: ['read', 'analyze']
  }
];

export class RepositoryAccessController {
  constructor(
    private policies: RepositoryPolicy[] = COMPANY_REPOSITORY_POLICIES
  ) {}

  async validateAccess(
    repoUrl: string, 
    operation: 'read' | 'analyze' | 'diff'
  ): Promise<{ allowed: boolean; reason?: string }> {
    const repoPath = this.extractRepoPath(repoUrl);
    
    for (const policy of this.policies) {
      if (this.matchesPattern(repoPath, policy.pattern)) {
        if (policy.allowedOperations.includes(operation)) {
          return { allowed: true };
        }
        return { 
          allowed: false, 
          reason: `Operation '${operation}' not allowed for ${repoPath}` 
        };
      }
    }
    
    return { 
      allowed: false, 
      reason: `Repository ${repoPath} not in whitelist` 
    };
  }

  private matchesPattern(repoPath: string, pattern: string): boolean {
    // 와일드카드 패턴 매칭
    const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
    return regex.test(repoPath);
  }

  private extractRepoPath(repoUrl: string): string {
    const match = repoUrl.match(/github\.com[\/:]([^\/]+\/[^\/\.]+)/);
    return match ? match[1] : '';
  }
}
```

### 4. **AWS Secrets Manager 통합**

```typescript
// src/services/aws-secrets.service.ts

import { 
  SecretsManagerClient, 
  GetSecretValueCommand,
  RotateSecretCommand 
} from '@aws-sdk/client-secrets-manager';

export class AWSSecretsService {
  private client: SecretsManagerClient;
  private cache = new Map<string, { value: string; expiry: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5분

  constructor() {
    this.client = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'ap-northeast-2'
    });
  }

  async getGitHubToken(organization?: string): Promise<string> {
    const secretKey = organization 
      ? `mcp/github/${organization}` 
      : 'mcp/github/default';

    // 캐시 확인
    const cached = this.cache.get(secretKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }

    try {
      const command = new GetSecretValueCommand({ SecretId: secretKey });
      const response = await this.client.send(command);
      
      const token = response.SecretString 
        ? JSON.parse(response.SecretString).token 
        : '';

      // 캐시 저장
      this.cache.set(secretKey, {
        value: token,
        expiry: Date.now() + this.CACHE_TTL
      });

      return token;
    } catch (error) {
      console.error(`Failed to retrieve secret ${secretKey}:`, error);
      throw new Error('GitHub 토큰을 가져올 수 없습니다');
    }
  }

  async rotateToken(secretKey: string): Promise<void> {
    const command = new RotateSecretCommand({ 
      SecretId: secretKey,
      RotationLambdaARN: process.env.ROTATION_LAMBDA_ARN
    });
    
    await this.client.send(command);
    this.cache.delete(secretKey); // 캐시 무효화
  }
}
```

### 5. **감사 로깅 (Audit Logging)**

```typescript
// src/services/audit.service.ts

import { CloudWatchLogsClient, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

export interface AuditEvent {
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  result: 'success' | 'failure';
  metadata?: Record<string, any>;
}

export class AuditService {
  private cwlClient: CloudWatchLogsClient;
  private logGroupName = '/aws/mcp-server/audit';
  private logStreamName = `audit-${new Date().toISOString().split('T')[0]}`;

  constructor() {
    this.cwlClient = new CloudWatchLogsClient({
      region: process.env.AWS_REGION || 'ap-northeast-2'
    });
  }

  async logAccess(event: AuditEvent): Promise<void> {
    const logEvent = {
      timestamp: Date.now(),
      message: JSON.stringify({
        ...event,
        environment: process.env.NODE_ENV,
        region: process.env.AWS_REGION,
        // IP 주소, User-Agent 등 추가 메타데이터
      })
    };

    try {
      await this.cwlClient.send(new PutLogEventsCommand({
        logGroupName: this.logGroupName,
        logStreamName: this.logStreamName,
        logEvents: [logEvent]
      }));
    } catch (error) {
      console.error('Failed to write audit log:', error);
      // 실패해도 서비스는 계속 실행
    }
  }

  async logRepositoryAccess(
    userId: string,
    repoUrl: string,
    operation: string,
    success: boolean
  ): Promise<void> {
    await this.logAccess({
      timestamp: new Date().toISOString(),
      userId,
      action: `repository.${operation}`,
      resource: repoUrl,
      result: success ? 'success' : 'failure',
      metadata: {
        userAgent: process.env.USER_AGENT,
        sourceIp: process.env.SOURCE_IP
      }
    });
  }
}
```

## 🚀 배포 프로세스

### 1. **인프라 구성 (Terraform/CDK)**

```hcl
# infrastructure/terraform/main.tf

module "mcp_server" {
  source = "./modules/mcp-server"
  
  environment = "production"
  vpc_id      = var.vpc_id
  subnet_ids  = var.private_subnet_ids
  
  github_org_whitelist = [
    "mycompany",
    "mycompany-labs"
  ]
  
  allowed_repositories = [
    "mycompany/*",
    "partner-org/shared-*"
  ]
  
  # CloudWatch 알람
  enable_monitoring = true
  alarm_email       = "devops@mycompany.com"
}
```

### 2. **CI/CD 파이프라인**

```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v2
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE }}
          aws-region: ap-northeast-2
          
      - name: Build and push to ECR
        run: |
          docker build -t mcp-server .
          docker tag mcp-server:latest $ECR_REPOSITORY:latest
          docker push $ECR_REPOSITORY:latest
          
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster mcp-cluster \
            --service mcp-server \
            --force-new-deployment
```

## 📊 모니터링 및 알림

### CloudWatch 대시보드
- API 호출 횟수
- 레포지토리 접근 패턴
- 에러율 및 응답 시간
- 비정상 접근 시도

### 알림 설정
- 비허가 레포지토리 접근 시도
- 과도한 API 호출
- 토큰 만료 임박
- 시스템 에러

## 🔒 보안 체크리스트

- [ ] GitHub Organization App 생성 및 최소 권한 설정
- [ ] AWS Secrets Manager에 토큰 저장 (KMS 암호화)
- [ ] VPC 내 프라이빗 서브넷에 배포
- [ ] NAT Gateway를 통한 아웃바운드 트래픽 (고정 IP)
- [ ] CloudWatch 감사 로그 활성화
- [ ] 레포지토리 화이트리스트 구성
- [ ] API Gateway 레이트 리밋 설정
- [ ] IAM 역할 최소 권한 원칙 적용
- [ ] 정기적인 토큰 로테이션
- [ ] 보안 그룹 최소 포트만 오픈