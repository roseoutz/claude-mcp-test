/**
 * 글로벌 테스트 설정
 */

export async function setup() {
  console.log('🔧 Global test setup starting...');

  // 환경 변수 설정
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.VECTOR_STORE_PROVIDER = 'elasticsearch';
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';

  console.log('✅ Global test setup complete');
}

export async function teardown() {
  console.log('🧹 Global test teardown starting...');
  console.log('✅ Global test teardown complete');
}