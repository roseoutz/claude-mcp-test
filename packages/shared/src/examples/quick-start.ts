/**
 * 🚀 지능형 코드 검색 시스템 빠른 시작 가이드
 *
 * 이 예제는 지능형 코드 검색 시스템을 빠르게 시작하는 방법을 보여줍니다.
 * 실제 프로젝트에서 바로 사용할 수 있는 코드를 제공합니다.
 */

import {
  IntelligentCodeAnalyzerService,
  AIService,
  ElasticsearchVectorStore
} from '../services';

// =======================================
// 🔧 기본 설정 및 초기화
// =======================================

async function setupIntelligentSearch() {
  console.log('🔍 지능형 코드 검색 시스템 초기화 중...');

  // 1. AI 서비스 설정 (OpenAI API 키 필요)
  const aiService = new AIService();

  // 2. Elasticsearch 벡터 스토어 설정
  const vectorStore = new ElasticsearchVectorStore('my-codebase');

  // 3. 지능형 분석기 생성
  const analyzer = new IntelligentCodeAnalyzerService(aiService, vectorStore);

  // 4. 초기화
  await analyzer.initialize();

  console.log('✅ 초기화 완료!');
  return analyzer;
}

// =======================================
// 📂 코드베이스 분석하기
// =======================================

async function analyzeYourCodebase(analyzer: IntelligentCodeAnalyzerService) {
  console.log('\n📂 코드베이스 분석 시작...');

  const result = await analyzer.analyzeCodebase({
    repositoryPath: '/path/to/your/project',
    includePatterns: ['**/*.{ts,js,tsx,jsx}'],
    excludePatterns: ['node_modules/**', 'dist/**', '.git/**'],
    generateDescriptions: true,
    maxFiles: 100,

    // 진행 상황 표시
    onProgress: (progress) => {
      console.log(`  📊 ${progress.phase}: ${progress.percentage.toFixed(1)}% (${progress.processedFiles}/${progress.totalFiles})`);
    }
  });

  if (result.success) {
    console.log('\n✅ 분석 완료!');
    console.log(`  📈 분석된 파일: ${result.summary.filesProcessed}개`);
    console.log(`  🔍 분석된 코드 요소: ${result.summary.elementsAnalyzed}개`);
    console.log(`  🤖 AI 설명 생성: ${result.summary.descriptionsGenerated}개`);
    console.log(`  ⏱️ 총 소요 시간: ${(result.processingTime.total / 1000).toFixed(2)}초`);
  } else {
    console.error('❌ 분석 실패:', result.error);
  }

  return result;
}

// =======================================
// 🔍 자연어로 코드 검색하기
// =======================================

async function searchWithNaturalLanguage(analyzer: IntelligentCodeAnalyzerService) {
  console.log('\n🔍 자연어 검색 예시들...');

  // 예시 1: 한국어 검색
  const koreanResults = await analyzer.searchCode({
    query: '사용자 로그인 처리',
    size: 5
  });

  console.log('\n1️⃣ "사용자 로그인 처리" 검색 결과:');
  koreanResults.results.forEach((result, index) => {
    const metadata = result.metadata.semanticMetadata;
    console.log(`  ${index + 1}. ${metadata?.name || '이름 없음'} (점수: ${result.score.toFixed(3)})`);
    console.log(`     📄 ${result.metadata.filePath}`);
    console.log(`     💡 ${metadata?.description || '설명 없음'}`);
    console.log(`     🏷️ 키워드: ${metadata?.keywords?.join(', ') || '없음'}`);
    console.log('');
  });

  // 예시 2: 영어 검색
  const englishResults = await analyzer.searchCode({
    query: 'database connection pool',
    size: 3
  });

  console.log('\n2️⃣ "database connection pool" 검색 결과:');
  englishResults.results.forEach((result, index) => {
    const metadata = result.metadata.semanticMetadata;
    console.log(`  ${index + 1}. ${metadata?.name} - ${metadata?.purpose}`);
  });

  // 예시 3: 도메인별 탐색
  const authResults = await analyzer.exploreByDomain('authentication', { size: 5 });

  console.log('\n3️⃣ 인증(authentication) 도메인 코드들:');
  authResults.forEach((result, index) => {
    const metadata = result.metadata.semanticMetadata;
    console.log(`  ${index + 1}. ${metadata?.name} - ${metadata?.elementType}`);
  });
}

// =======================================
// 🎯 고급 검색 기능 사용하기
// =======================================

async function advancedSearchExamples(analyzer: IntelligentCodeAnalyzerService) {
  console.log('\n🎯 고급 검색 기능 예시들...');

  // 1. 가중치를 조정한 검색
  const weightedResults = await analyzer.searchCode({
    query: 'error handling exception',
    size: 3,
    weights: {
      semantic: 0.6,  // 의미적 검색 중시
      keyword: 0.3,   // 키워드 매칭
      vector: 0.1     // 벡터 유사도
    }
  });

  console.log('\n🎛️ 가중치 조정 검색 결과:');
  weightedResults.results.forEach((result, index) => {
    console.log(`  ${index + 1}. ${result.metadata.semanticMetadata?.name} (${result.score.toFixed(3)})`);
  });

  // 2. 특정 타입만 검색
  const functionResults = await analyzer.searchCode({
    query: 'validation check',
    elementTypes: ['function', 'method'],
    size: 3
  });

  console.log('\n🔧 함수/메서드만 검색:');
  functionResults.results.forEach((result, index) => {
    const metadata = result.metadata.semanticMetadata;
    console.log(`  ${index + 1}. ${metadata?.name} (${metadata?.elementType})`);
  });

  // 3. 유사한 코드 찾기
  if (weightedResults.results.length > 0) {
    const similarResults = await analyzer.findSimilarCode(
      weightedResults.results[0].id,
      { size: 3 }
    );

    console.log('\n🔗 유사한 코드들:');
    similarResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.metadata.semanticMetadata?.name}`);
    });
  }
}

// =======================================
// 📊 검색 품질 분석
// =======================================

async function analyzeSearchQuality(analyzer: IntelligentCodeAnalyzerService) {
  console.log('\n📊 검색 품질 분석...');

  const testQueries = [
    '사용자 인증',
    'user authentication',
    '데이터베이스 연결',
    'error handling',
    '결제 처리'
  ];

  for (const query of testQueries) {
    const startTime = Date.now();
    const results = await analyzer.searchCode({
      query,
      size: 5
    });
    const endTime = Date.now();

    console.log(`\n🔍 쿼리: "${query}"`);
    console.log(`  ⏱️ 검색 시간: ${endTime - startTime}ms`);
    console.log(`  📊 결과 수: ${results.results.length}`);

    if (results.queryExpansion) {
      console.log(`  🔄 확장된 키워드: ${results.queryExpansion.expandedKeywords.map(k => k.keyword).slice(0, 3).join(', ')}`);
    }

    if (results.results.length > 0) {
      const avgScore = results.results.reduce((sum, r) => sum + r.score, 0) / results.results.length;
      console.log(`  📈 평균 점수: ${avgScore.toFixed(3)}`);
    }
  }
}

// =======================================
// 🏃‍♂️ 메인 실행 함수
// =======================================

async function main() {
  try {
    console.log('🧠 지능형 코드 검색 시스템 데모');
    console.log('='.repeat(50));

    // 1. 시스템 초기화
    const analyzer = await setupIntelligentSearch();

    // 2. 코드베이스 분석 (실제 경로로 변경하세요)
    // await analyzeYourCodebase(analyzer);

    // 3. 자연어 검색 (분석 완료 후 실행)
    // await searchWithNaturalLanguage(analyzer);

    // 4. 고급 검색 기능
    // await advancedSearchExamples(analyzer);

    // 5. 검색 품질 분석
    // await analyzeSearchQuality(analyzer);

    console.log('\n🎉 데모 완료!');

  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
}

// =======================================
// 🔧 유틸리티 함수들
// =======================================

/**
 * 환경 변수 확인 헬퍼
 */
function checkEnvironment() {
  const requiredEnvVars = ['OPENAI_API_KEY'];
  const missing = requiredEnvVars.filter(env => !process.env[env]);

  if (missing.length > 0) {
    console.error('❌ 필수 환경 변수가 설정되지 않았습니다:');
    missing.forEach(env => console.error(`   - ${env}`));
    console.error('\n설정 방법:');
    console.error('   export OPENAI_API_KEY="your-openai-api-key"');
    process.exit(1);
  }
}

/**
 * 검색 결과를 예쁘게 출력하는 헬퍼
 */
function prettifySearchResults(results: any[], title: string) {
  console.log(`\n${title}:`);
  console.log('-'.repeat(title.length + 1));

  results.forEach((result, index) => {
    const metadata = result.metadata.semanticMetadata;
    console.log(`\n${index + 1}. 📄 ${metadata?.name || '이름 없음'}`);
    console.log(`   📍 ${result.metadata.filePath}`);
    console.log(`   📊 점수: ${result.score.toFixed(3)}`);
    console.log(`   💡 ${metadata?.description || '설명 없음'}`);

    if (metadata?.keywords?.length) {
      console.log(`   🏷️ 키워드: ${metadata.keywords.slice(0, 5).join(', ')}`);
    }
  });
}

// 개발 환경에서만 실행
if (require.main === module) {
  checkEnvironment();
  main();
}

export {
  setupIntelligentSearch,
  analyzeYourCodebase,
  searchWithNaturalLanguage,
  advancedSearchExamples,
  checkEnvironment,
  prettifySearchResults
};