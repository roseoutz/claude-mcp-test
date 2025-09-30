#!/usr/bin/env node

/**
 * AWS API 서버 테스트
 * 메타데이터 강화 임베딩 시스템 검증
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testImpactAnalysis() {
  const API_URL = 'http://localhost:3000/api/v1/impact/analyze';

  const testCases = [
    {
      title: '인증 시스템 변경 영향도 분석',
      request: {
        query: 'JWT 토큰 검증 로직을 변경하고 사용자 인증 프로세스를 개선하려고 합니다.',
        type: 'security',
        targetFiles: [],
        language: 'java',
        repositoryPath: '/tmp/letsgo'
      }
    },
    {
      title: 'Python FastAPI 엔드포인트 수정',
      request: {
        query: 'FastAPI의 사용자 정보 조회 엔드포인트에 캐싱 기능을 추가하려고 합니다.',
        type: 'api',
        targetFiles: [],
        language: 'python',
        repositoryPath: '/tmp/letsgo'
      }
    },
    {
      title: 'TypeScript React 컴포넌트 리팩토링',
      request: {
        query: 'React 컴포넌트의 상태 관리를 Redux에서 Context API로 마이그레이션하려고 합니다.',
        type: 'frontend',
        targetFiles: [],
        language: 'typescript',
        repositoryPath: '/tmp/letsgo'
      }
    },
    {
      title: '데이터베이스 스키마 변경',
      request: {
        query: '사용자 테이블에 새로운 컬럼을 추가하고 관련 Repository와 Service를 수정해야 합니다.',
        type: 'database',
        targetFiles: [],
        language: 'kotlin',
        repositoryPath: '/tmp/letsgo'
      }
    }
  ];

  console.log('🚀 AWS API 서버 테스트 시작\n');
  console.log('=' .repeat(80));

  for (const testCase of testCases) {
    console.log(`\n📋 테스트: ${testCase.title}`);
    console.log('-'.repeat(60));

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase.request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ HTTP ${response.status}: ${errorText}`);
        continue;
      }

      const result = await response.json();

      if (result.success) {
        console.log('✅ 분석 성공!');
        console.log(`📊 분석 결과:`);

        if (result.data?.impactedFiles) {
          console.log(`\n영향받는 파일 수: ${result.data.impactedFiles.length}`);

          // 상위 5개 파일만 표시
          const topFiles = result.data.impactedFiles.slice(0, 5);
          topFiles.forEach((file, idx) => {
            console.log(`  ${idx + 1}. ${file.path}`);
            console.log(`     - 영향도: ${(file.impactScore * 100).toFixed(1)}%`);
            console.log(`     - 영향 수준: ${file.impactLevel}`);
            if (file.reason) {
              console.log(`     - 이유: ${file.reason}`);
            }
          });

          if (result.data.impactedFiles.length > 5) {
            console.log(`  ... 외 ${result.data.impactedFiles.length - 5}개 파일`);
          }
        }

        if (result.data?.summary) {
          console.log(`\n📝 요약:`);
          console.log(`  - 전체 영향도: ${result.data.summary.overallImpact}`);
          console.log(`  - 위험 수준: ${result.data.summary.riskLevel}`);
          console.log(`  - 예상 작업량: ${result.data.summary.estimatedEffort}`);
        }
      } else {
        console.error('❌ 분석 실패:', result.error);
      }
    } catch (error) {
      console.error('❌ 요청 실패:', error.message);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✨ 테스트 완료!');
}

// 실행
testImpactAnalysis().catch(console.error);