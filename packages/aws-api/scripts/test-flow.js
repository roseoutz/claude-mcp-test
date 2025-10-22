#!/usr/bin/env node

/**
 * 전체 플로우 테스트 스크립트
 * 1. 코드베이스 분석 및 인덱싱
 * 2. 검색 및 응답 테스트
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000';
const REPO_PATH = '/tmp/letsgo';

async function testAnalysis() {
  console.log('\n📚 코드베이스 분석 및 인덱싱 시작');
  console.log('=' .repeat(80));

  try {
    const response = await fetch(`${API_URL}/api/v1/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repositoryPath: REPO_PATH,
        patterns: ['**/*.java', '**/*.kt', '**/*.xml', '**/*.properties'],
        excludePaths: ['target', 'build', '.gradle'],
        forceReindex: true
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log(`✅ 분석 완료!`);
      console.log(`- 총 파일: ${result.data.totalFiles}`);
      console.log(`- 처리된 파일: ${result.data.processedFiles}`);
      console.log(`- 오류: ${result.data.errors}`);
    } else {
      console.log('❌ 분석 실패:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    return false;
  }

  console.log('\n' + '=' .repeat(80));
  return true;
}

async function testSearch(query) {
  console.log(`\n🔍 검색: "${query}"`);
  console.log('=' .repeat(80));

  try {
    const response = await fetch(`${API_URL}/api/v1/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        repositoryPath: REPO_PATH,
        maxResults: 5
      })
    });

    const result = await response.json();

    if (result.success && result.data) {
      console.log('\n📝 Claude의 답변:');
      console.log('-'.repeat(40));
      console.log(result.data.answer);

      if (result.data.relevantFiles && result.data.relevantFiles.length > 0) {
        console.log('\n📁 관련 파일들:');
        console.log('-'.repeat(40));
        result.data.relevantFiles.forEach((file, idx) => {
          console.log(`${idx + 1}. ${file.path} (점수: ${(file.score * 100).toFixed(1)}%)`);
        });
      }
    } else {
      console.log('❌ 검색 실패:', result.error);
    }
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
  }

  console.log('\n' + '=' .repeat(80));
}

async function runTests() {
  console.log(`
🤖 코드 AI MCP 테스트
========================================
1. 코드베이스 분석 및 Elasticsearch 인덱싱
2. 시맨틱 검색 및 Claude 응답 생성
========================================
  `);

  // Elasticsearch가 실행 중인지 확인
  try {
    const esCheck = await fetch('http://localhost:9200');
    if (!esCheck.ok) {
      console.log('⚠️  Elasticsearch가 실행되지 않았습니다. Docker를 실행해주세요:');
      console.log('   docker run -d -p 9200:9200 -p 9300:9300 -e "discovery.type=single-node" elasticsearch:8.11.0');
      process.exit(1);
    }
  } catch (err) {
    console.log('⚠️  Elasticsearch에 연결할 수 없습니다. Docker를 실행해주세요:');
    console.log('   docker run -d -p 9200:9200 -p 9300:9300 -e "discovery.type=single-node" -e "xpack.security.enabled=false" elasticsearch:8.11.0');
    process.exit(1);
  }

  // 1. 분석 및 인덱싱
  const analysisSuccess = await testAnalysis();

  if (!analysisSuccess) {
    console.log('\n❌ 분석이 실패하여 테스트를 중단합니다.');
    process.exit(1);
  }

  // 잠시 대기 (인덱싱 완료 대기)
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 2. 검색 테스트
  const testQueries = [
    "JWT 토큰 생성 로직이 어디에 있어?",
    "인증 관련 설정을 변경하려면 어떤 파일을 수정해야 해?",
    "환급액 계산 로직을 찾아줘",
    "데이터베이스 연결 설정이 어디에 있어?"
  ];

  for (const query of testQueries) {
    await testSearch(query);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n✅ 모든 테스트 완료!');
}

// 실행
runTests().catch(console.error);