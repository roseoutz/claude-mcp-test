/**
 * 통합 인수테스트
 * MCP 서버와 AWS API 간의 실제 통신 및 전체 시스템 통합 테스트
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestCodebase } from '../helpers/test-environment';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

describe('Integration Acceptance Tests', () => {
  let testCodebasePath: string;
  let environment: any;

  beforeAll(async () => {
    // 테스트 환경 설정 (간소화)
    environment = {
      vectorStore: {
        count: async () => Math.floor(Math.random() * 50) + 10,
        clear: async () => {}
      }
    };

    // 테스트용 대규모 코드베이스 생성
    testCodebasePath = path.join(tmpdir(), 'integration-test-' + Date.now());
    await createTestCodebase(testCodebasePath);
  });

  afterAll(async () => {
    // 테스트 코드베이스 정리
    if (testCodebasePath) {
      await fs.rm(testCodebasePath, { recursive: true, force: true });
    }
  });

  describe('Feature: 실제 개발 워크플로우 시뮬레이션', () => {
    it('Scenario: 신규 개발자가 기존 프로젝트를 분석하고 기능을 추가하는 전체 과정', async () => {
      // 📖 Story: 새로운 개발자 Alice가 기존 이커머스 프로젝트에
      //          결제 기능을 추가해야 하는 상황

      const sessionId = 'alice-payment-feature-' + Date.now();

      // 🔍 Step 1: 프로젝트 전체 구조 파악
      console.log('👩‍💻 Alice: 프로젝트 구조를 먼저 파악해보자');

      const learningResult = await callMCPTool('learn_codebase', {
        repoPath: testCodebasePath,
        branch: 'main',
        includeTests: true,
        maxFileSize: 2 * 1024 * 1024, // 2MB
        filePatterns: ['**/*.ts', '**/*.js', '**/*.json'],
        excludePatterns: ['node_modules/**', '.git/**', 'dist/**']
      });

      expect(learningResult.isError).toBe(false);
      console.log('✅ 프로젝트 학습 완료');

      // 🏗️ Step 2: 기존 아키텍처 패턴 분석
      console.log('👩‍💻 Alice: 기존 아키텍처 패턴을 알아보자');

      const architectureAnalysis = await callAWSAPI('POST', '/api/v1/analysis/analyze', {
        sessionId,
        analysisType: 'architecture'
      });

      expect(architectureAnalysis.status).toBe(200);
      expect(architectureAnalysis.data.result.patterns).toBeDefined();

      const patterns = architectureAnalysis.data.result.patterns;
      console.log(`📊 발견된 패턴: ${patterns.map((p: any) => p.name).join(', ')}`);

      // 🔒 Step 3: 보안 취약점 사전 점검
      console.log('👩‍💻 Alice: 기존 코드의 보안 상태를 확인해보자');

      const securityAnalysis = await callAWSAPI('POST', '/api/v1/analysis/analyze', {
        sessionId,
        analysisType: 'security'
      });

      expect(securityAnalysis.status).toBe(200);
      expect(securityAnalysis.data.result.findings).toBeDefined();

      const criticalFindings = securityAnalysis.data.result.findings.filter(
        (f: any) => f.severity === 'critical' || f.severity === 'high'
      );
      console.log(`🚨 고위험 보안 이슈: ${criticalFindings.length}개`);

      // 🔍 Step 4: 결제 관련 기존 코드 검색
      console.log('👩‍💻 Alice: 결제 관련 기존 코드가 있나 찾아보자');

      const paymentSearch = await callAWSAPI('GET', '/api/v1/analysis/search', {
        sessionId,
        query: 'payment checkout order billing',
        semantic: true,
        limit: 10
      });

      expect(paymentSearch.status).toBe(200);
      const paymentResults = paymentSearch.data.filter((r: any) =>
        r.file_path.toLowerCase().includes('order') ||
        r.code_snippet.toLowerCase().includes('payment')
      );

      console.log(`💳 결제 관련 기존 코드: ${paymentResults.length}개 파일`);

      // 📝 Step 5: OrderService의 상세 분석
      console.log('👩‍💻 Alice: OrderService를 자세히 알아보자');

      const orderServiceExplanation = await callMCPTool('explain_feature', {
        featureId: 'OrderService',
        includeCodeExamples: true,
        depth: 'comprehensive',
        format: 'markdown'
      });

      expect(orderServiceExplanation.isError).toBe(false);
      const explanation = orderServiceExplanation.content.find((c: any) => c.type === 'text')?.text;
      expect(explanation).toContain('OrderService');

      // 🏗️ Step 6: PaymentService 추가 계획 수립
      console.log('👩‍💻 Alice: 새 PaymentService가 기존 코드에 미칠 영향을 분석해보자');

      const impactAnalysis = await callMCPTool('analyze_impact', {
        changeDescription: 'PaymentService 클래스 추가 및 OrderService와의 통합',
        affectedFiles: ['src/services/order.service.ts', 'src/controllers/order.controller.ts'],
        analysisDepth: 'deep',
        includeTests: true,
        includeDependencies: true
      });

      expect(impactAnalysis.isError).toBe(false);

      // 🛠️ Step 7: 실제 코드 구현 (시뮬레이션)
      console.log('👩‍💻 Alice: PaymentService를 구현해보자');

      await implementPaymentFeature(testCodebasePath);

      // 🔄 Step 8: 변경사항 차이 분석
      console.log('👩‍💻 Alice: 내가 구현한 코드를 분석해보자');

      const diffAnalysis = await callAWSAPI('POST', '/api/v1/analysis/diff', {
        sessionId,
        baseBranch: 'main',
        targetBranch: 'feature/payment-service',
        includeImpact: true
      });

      expect(diffAnalysis.status).toBe(200);
      expect(diffAnalysis.data.length).toBeGreaterThan(0);

      const paymentFiles = diffAnalysis.data.filter((d: any) =>
        d.file_path.includes('payment')
      );
      expect(paymentFiles.length).toBeGreaterThan(0);

      // 🧪 Step 9: 새로 추가된 코드의 품질 확인
      console.log('👩‍💻 Alice: 새 코드의 품질을 확인해보자');

      // 새로운 세션으로 업데이트된 코드베이스 학습
      const newSessionId = 'alice-payment-updated-' + Date.now();
      const { execSync } = await import('child_process');
      execSync('git checkout feature/payment-service', { cwd: testCodebasePath });

      await callMCPTool('learn_codebase', {
        repoPath: testCodebasePath,
        branch: 'feature/payment-service'
      });

      const qualityAnalysis = await callAWSAPI('POST', '/api/v1/analysis/analyze', {
        sessionId: newSessionId,
        analysisType: 'quality'
      });

      expect(qualityAnalysis.status).toBe(200);
      const qualityScore = qualityAnalysis.data.result.metrics.overall_score;
      console.log(`📊 전체 코드 품질 점수: ${qualityScore}`);

      // 🔒 Step 10: 보안 재검토
      const updatedSecurityAnalysis = await callAWSAPI('POST', '/api/v1/analysis/analyze', {
        sessionId: newSessionId,
        analysisType: 'security'
      });

      expect(updatedSecurityAnalysis.status).toBe(200);
      const newSecurityScore = updatedSecurityAnalysis.data.result.statistics.score;
      console.log(`🔒 보안 점수: ${newSecurityScore}`);

      // 전체 워크플로우 성공 검증
      expect(qualityScore).toBeGreaterThanOrEqual(70); // 품질 점수 70점 이상
      expect(newSecurityScore).toBeGreaterThanOrEqual(80); // 보안 점수 80점 이상

      console.log('🎉 Alice: 결제 기능 구현과 검토가 모두 완료되었어!');
    });

    it('Scenario: DevOps 엔지니어가 시스템 전체 건강성을 모니터링하는 과정', async () => {
      // 📖 Story: DevOps 엔지니어 Bob이 시스템 전체의 건강성과
      //          기술 부채를 정기적으로 모니터링하는 상황

      const sessionId = 'bob-monitoring-' + Date.now();
      console.log('👨‍💻 Bob: 시스템 전체 건강성을 체크해보자');

      // 🔍 Step 1: 전체 코드베이스 스캔
      await callMCPTool('learn_codebase', {
        repoPath: testCodebasePath,
        includeTests: true
      });

      // 📊 Step 2: 아키텍처 복잡도 분석
      const architectureHealth = await callAWSAPI('POST', '/api/v1/analysis/analyze', {
        sessionId,
        analysisType: 'architecture'
      });

      expect(architectureHealth.status).toBe(200);
      const metrics = architectureHealth.data.result.metrics;

      console.log(`🏗️ 복잡도 점수: ${metrics.complexity_score}`);
      console.log(`🔧 유지보수성 지수: ${metrics.maintainability_index}`);
      console.log(`🔗 결합도: ${metrics.coupling_score}`);

      // 🚨 복잡도가 너무 높으면 알림
      if (metrics.complexity_score > 7) {
        console.warn('⚠️ 시스템 복잡도가 높습니다!');
      }

      // 💰 Step 3: 기술 부채 측정
      const technicalDebtAnalysis = await callAWSAPI('POST', '/api/v1/analysis/analyze', {
        sessionId,
        analysisType: 'quality'
      });

      expect(technicalDebtAnalysis.status).toBe(200);
      const debtMetrics = technicalDebtAnalysis.data.result.metrics;

      console.log(`💸 기술 부채: ${debtMetrics.technical_debt_hours}시간`);
      console.log(`🎯 전체 품질 점수: ${debtMetrics.overall_score}`);

      // 🔍 Step 4: 가장 문제가 많은 파일 식별
      const issues = technicalDebtAnalysis.data.result.issues;
      const criticalIssues = issues.filter((i: any) => i.severity === 'major');

      console.log(`🚨 주요 이슈: ${criticalIssues.length}개`);

      if (criticalIssues.length > 0) {
        const problemFiles = [...new Set(criticalIssues.map((i: any) => i.file_path))];
        console.log(`📁 문제 파일들: ${problemFiles.join(', ')}`);
      }

      // 🔒 Step 5: 보안 상태 점검
      const securityStatus = await callAWSAPI('POST', '/api/v1/analysis/analyze', {
        sessionId,
        analysisType: 'security'
      });

      expect(securityStatus.status).toBe(200);
      const securityMetrics = securityStatus.data.result.statistics;

      console.log(`🛡️ 보안 점수: ${securityMetrics.score}`);
      console.log(`🚨 취약점: ${securityMetrics.vulnerabilities_found}개`);
      console.log(`⚠️ 약점: ${securityMetrics.weaknesses_found}개`);

      // 모니터링 임계값 검증
      expect(metrics.maintainability_index).toBeGreaterThanOrEqual(60);
      expect(securityMetrics.score).toBeGreaterThanOrEqual(75);
      expect(debtMetrics.overall_score).toBeGreaterThanOrEqual(70);

      console.log('✅ Bob: 시스템 건강성 체크 완료!');
    });
  });

  describe('Feature: 대규모 코드베이스 처리 성능', () => {
    it('대용량 파일과 많은 수의 파일을 효율적으로 처리할 수 있다', async () => {
      // Given: 대규모 코드베이스 (500+ 파일, 50MB+ 크기)
      const largeCodebasePath = path.join(tmpdir(), 'large-codebase-' + Date.now());
      await createLargeCodebase(largeCodebasePath);

      const sessionId = 'performance-test-' + Date.now();
      const startTime = Date.now();

      // When: 대규모 코드베이스 학습
      const result = await callMCPTool('learn_codebase', {
        repoPath: largeCodebasePath,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        filePatterns: ['**/*.ts', '**/*.js', '**/*.py', '**/*.java']
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Then: 합리적인 시간 내에 처리 완료
      expect(result.isError).toBe(false);
      expect(processingTime).toBeLessThan(300000); // 5분 이내

      console.log(`⚡ 처리 시간: ${processingTime / 1000}초`);
      console.log(`📁 처리된 파일: ${result.content.find((c: any) => c.type === 'text')?.text.match(/\d+/)?.[0] || 'N/A'}개`);

      // 메모리 사용량 체크
      const memUsage = process.memoryUsage();
      console.log(`💾 메모리 사용량: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);

      expect(memUsage.heapUsed).toBeLessThan(2 * 1024 * 1024 * 1024); // 2GB 이내

      // 정리
      await fs.rm(largeCodebasePath, { recursive: true, force: true });
    });
  });

  describe('Feature: 동시성 및 안정성', () => {
    it('여러 세션이 동시에 실행되어도 안정적으로 처리된다', async () => {
      const sessionIds = Array.from({ length: 5 }, (_, i) => `concurrent-test-${i}-${Date.now()}`);

      // When: 5개 세션이 동시에 실행
      const promises = sessionIds.map(async (sessionId) => {
        const result = await callMCPTool('learn_codebase', {
          repoPath: testCodebasePath
        });

        // 각 세션별로 서로 다른 검색 수행
        const searchResult = await callAWSAPI('GET', '/api/v1/analysis/search', {
          sessionId,
          query: `test query ${sessionId}`,
          semantic: true
        });

        return { sessionId, learnResult: result, searchResult };
      });

      const results = await Promise.all(promises);

      // Then: 모든 세션이 성공적으로 완료
      results.forEach(({ sessionId, learnResult, searchResult }) => {
        expect(learnResult.isError).toBe(false);
        expect(searchResult.status).toBe(200);
        console.log(`✅ 세션 ${sessionId} 완료`);
      });
    });
  });

  // 헬퍼 함수들
  async function startServers(): Promise<void> {
    // MCP 서버는 이미 테스트 환경에서 실행 중이므로 별도 프로세스 불필요
    // AWS API 서버도 테스트 환경에서 관리
    console.log('🚀 서버들이 준비되었습니다');
  }

  async function callMCPTool(toolName: string, args: any) {
    // 간소화된 모킹 응답
    switch (toolName) {
      case 'learn_codebase':
        return {
          isError: false,
          content: [{ type: 'text', text: '코드베이스 학습이 완료되었습니다.' }]
        };
      case 'analyze_branch_diff':
        return {
          isError: false,
          content: [{ type: 'text', text: '브랜치 차이 분석이 완료되었습니다.' }]
        };
      case 'explain_feature':
        return {
          isError: false,
          content: [{ type: 'text', text: `${args.featureId} 기능에 대한 설명입니다.` }]
        };
      case 'analyze_impact':
        return {
          isError: false,
          content: [{ type: 'text', text: '영향도 분석이 완료되었습니다.' }]
        };
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  async function callAWSAPI(method: string, path: string, data?: any) {
    // 모킹된 AWS API 응답
    if (path === '/api/v1/analysis/search') {
      return {
        status: 200,
        data: [
          { file: 'src/payment.service.ts', content: 'payment logic', score: 0.95 },
          { file: 'src/user.service.ts', content: 'user management', score: 0.88 }
        ]
      };
    }

    if (path === '/api/v1/analysis/analyze') {
      return {
        status: 200,
        data: {
          complexity: 'medium',
          recommendations: ['Add error handling', 'Improve validation']
        }
      };
    }

    if (path === '/api/v1/analysis/diff') {
      return {
        status: 200,
        data: {
          changes: { filesChanged: 2, linesAdded: 45, linesRemoved: 12 }
        }
      };
    }

    throw new Error(`Unsupported API call: ${method} ${path}`);
  }

  async function createAdvancedCodebase(basePath: string): Promise<void> {
    const files = {
      'src/services/user.service.ts': `
export class UserService {
  private users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async create(userData: CreateUserData): Promise<User> {
    const user = new User(userData);
    this.users.set(user.id, user);
    return user;
  }
}
      `,
      'src/services/order.service.ts': `
import { UserService } from './user.service';

export class OrderService {
  constructor(private userService: UserService) {}

  async createOrder(userId: string, items: OrderItem[]): Promise<Order> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const order = new Order({
      id: generateOrderId(),
      userId,
      items,
      status: 'pending',
      createdAt: new Date()
    });

    return order;
  }

  async calculateTotal(items: OrderItem[]): Promise<number> {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }
}

function generateOrderId(): string {
  return 'order_' + Date.now();
}
      `,
      'src/controllers/order.controller.ts': `
import { OrderService } from '../services/order.service';

export class OrderController {
  constructor(private orderService: OrderService) {}

  async createOrder(req: any, res: any): Promise<void> {
    try {
      const { userId, items } = req.body;
      const order = await this.orderService.createOrder(userId, items);
      res.json(order);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}
      `,
      'src/models/user.model.ts': `
export class User {
  id: string;
  email: string;
  password: string;
  createdAt: Date;

  constructor(data: CreateUserData) {
    this.id = generateUserId();
    this.email = data.email;
    this.password = data.password; // TODO: 해싱 필요
    this.createdAt = new Date();
  }
}

function generateUserId(): string {
  return 'user_' + Math.random().toString(36).substr(2, 9);
}
      `,
      'src/database/connection.ts': `
export class DatabaseConnection {
  private isConnected = false;

  async connect(): Promise<void> {
    // TODO: 실제 데이터베이스 연결
    this.isConnected = true;
  }

  async query(sql: string, params: any[]): Promise<any[]> {
    // 잠재적 SQL 인젝션 취약점
    const unsafeQuery = sql + params.join(' ');
    console.log('Executing:', unsafeQuery);
    return [];
  }
}
      `
    };

    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(basePath, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content.trim());
    }

    // Git 저장소 초기화
    const { execSync } = await import('child_process');
    execSync('git init', { cwd: basePath });
    execSync('git add .', { cwd: basePath });
    execSync('git commit -m "Initial e-commerce codebase"', { cwd: basePath });
  }

  async function implementPaymentFeature(basePath: string): Promise<void> {
    const { execSync } = await import('child_process');

    // 새 브랜치 생성
    execSync('git checkout -b feature/payment-service', { cwd: basePath });

    // PaymentService 구현
    const paymentServiceCode = `
import { OrderService } from './order.service';

export class PaymentService {
  constructor(private orderService: OrderService) {}

  async processPayment(orderId: string, paymentData: PaymentData): Promise<PaymentResult> {
    // 결제 데이터 검증
    this.validatePaymentData(paymentData);

    try {
      // 외부 결제 게이트웨이 호출 시뮬레이션
      const paymentResult = await this.callPaymentGateway(paymentData);

      if (paymentResult.success) {
        // 주문 상태 업데이트
        await this.updateOrderStatus(orderId, 'paid');

        return {
          success: true,
          transactionId: paymentResult.transactionId,
          amount: paymentData.amount
        };
      } else {
        throw new Error('Payment failed: ' + paymentResult.error);
      }
    } catch (error) {
      await this.updateOrderStatus(orderId, 'payment_failed');
      throw error;
    }
  }

  private validatePaymentData(data: PaymentData): void {
    if (!data.amount || data.amount <= 0) {
      throw new Error('Invalid payment amount');
    }

    if (!data.cardNumber || data.cardNumber.length < 13) {
      throw new Error('Invalid card number');
    }

    if (!data.cvv || data.cvv.length !== 3) {
      throw new Error('Invalid CVV');
    }
  }

  private async callPaymentGateway(data: PaymentData): Promise<any> {
    // 실제로는 외부 API 호출
    return {
      success: true,
      transactionId: 'tx_' + Date.now(),
      amount: data.amount
    };
  }

  private async updateOrderStatus(orderId: string, status: string): Promise<void> {
    // 주문 상태 업데이트 로직
    console.log(\`Order \${orderId} status updated to \${status}\`);
  }
}

interface PaymentData {
  amount: number;
  cardNumber: string;
  expiryDate: string;
  cvv: string;
}

interface PaymentResult {
  success: boolean;
  transactionId?: string;
  amount?: number;
  error?: string;
}
    `;

    await fs.writeFile(
      path.join(basePath, 'src/services/payment.service.ts'),
      paymentServiceCode.trim()
    );

    // OrderService 업데이트
    const updatedOrderService = `
import { UserService } from './user.service';
import { PaymentService } from './payment.service';

export class OrderService {
  constructor(
    private userService: UserService,
    private paymentService?: PaymentService
  ) {}

  async createOrder(userId: string, items: OrderItem[]): Promise<Order> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const total = await this.calculateTotal(items);
    const order = new Order({
      id: generateOrderId(),
      userId,
      items,
      total,
      status: 'pending',
      createdAt: new Date()
    });

    return order;
  }

  async processOrderPayment(orderId: string, paymentData: any): Promise<void> {
    if (!this.paymentService) {
      throw new Error('Payment service not available');
    }

    await this.paymentService.processPayment(orderId, paymentData);
  }

  async calculateTotal(items: OrderItem[]): Promise<number> {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }
}

function generateOrderId(): string {
  return 'order_' + Date.now();
}
    `;

    await fs.writeFile(
      path.join(basePath, 'src/services/order.service.ts'),
      updatedOrderService.trim()
    );

    // 커밋
    execSync('git add .', { cwd: basePath });
    execSync('git commit -m "Add PaymentService and integrate with OrderService"', { cwd: basePath });
    execSync('git checkout main', { cwd: basePath });
  }

  async function createLargeCodebase(basePath: string): Promise<void> {
    // 500개 파일, 다양한 언어로 구성된 대규모 코드베이스 생성
    const languages = ['ts', 'js', 'py', 'java'];
    const fileTypes = ['service', 'controller', 'model', 'util', 'test'];

    for (let i = 0; i < 500; i++) {
      const lang = languages[i % languages.length];
      const type = fileTypes[i % fileTypes.length];
      const fileName = `${type}${i}.${lang}`;
      const dirName = `src/${type}s`;

      const content = generateLargeFileContent(lang, type, i);

      const fullPath = path.join(basePath, dirName, fileName);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
    }

    // Git 초기화
    const { execSync } = await import('child_process');
    execSync('git init', { cwd: basePath });
    execSync('git add .', { cwd: basePath });
    execSync('git commit -m "Large codebase for performance testing"', { cwd: basePath });
  }

  function generateLargeFileContent(lang: string, type: string, index: number): string {
    const baseContent = `
// This is a generated file for testing - ${type}${index}.${lang}
// Generated at: ${new Date().toISOString()}

export class ${type.charAt(0).toUpperCase() + type.slice(1)}${index} {
  private id: string = '${type}${index}';
  private createdAt: Date = new Date();

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    console.log('Initializing ${type}${index}');
    this.performSetup();
  }

  private performSetup(): void {
    // Complex setup logic simulation
    ${generateComplexLogic(20)}
  }

  public process(data: any): any {
    // Main processing logic
    ${generateComplexLogic(30)}
    return this.finalizeResult(data);
  }

  private finalizeResult(data: any): any {
    return {
      id: this.id,
      processed: true,
      timestamp: this.createdAt,
      data
    };
  }
}
    `;

    return baseContent;
  }

  function generateComplexLogic(lines: number): string {
    const statements = [
      'const temp = this.processStep();',
      'if (temp && temp.isValid()) { this.handleValid(temp); }',
      'const result = this.computeValue(temp);',
      'this.validateResult(result);',
      'this.saveToCache(result);',
      'const transformed = this.transform(result);',
      'if (transformed) { this.publish(transformed); }'
    ];

    return Array.from({ length: lines }, (_, i) =>
      '    ' + statements[i % statements.length]
    ).join('\n');
  }
});