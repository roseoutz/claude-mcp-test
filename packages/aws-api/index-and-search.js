#!/usr/bin/env node

/**
 * 코드베이스 인덱싱 및 영향도 분석 스크립트
 *
 * 사용법:
 * 1. 인덱싱: node index-and-search.js index /path/to/your/project
 * 2. 검색: node index-and-search.js search "변경하려는 내용"
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API_URL = 'http://localhost:3000/api/v1/impact';

/**
 * 코드베이스 인덱싱
 */
async function indexCodebase(projectPath) {
  console.log(`\n📂 인덱싱 시작: ${projectPath}`);
  console.log('=' .repeat(60));

  try {
    // 지원하는 파일 패턴
    const patterns = [
      '**/*.java',
      '**/*.kt',
      '**/*.py',
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx'
    ];

    let totalFiles = 0;
    let indexedFiles = 0;

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: projectPath,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
      });

      for (const file of files) {
        const filePath = path.join(projectPath, file);
        const content = fs.readFileSync(filePath, 'utf8');

        totalFiles++;

        try {
          const response = await fetch(`${API_URL}/index`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filePath: file,
              content: content,
              projectPath: projectPath
            })
          });

          if (response.ok) {
            indexedFiles++;
            console.log(`✅ 인덱싱 완료: ${file}`);
          } else {
            console.log(`❌ 인덱싱 실패: ${file}`);
          }
        } catch (error) {
          console.error(`❌ 오류 발생: ${file}`, error.message);
        }
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log(`📊 인덱싱 결과: ${indexedFiles}/${totalFiles} 파일 완료`);
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('❌ 인덱싱 중 오류:', error);
  }
}

/**
 * 영향도 분석 검색
 */
async function searchImpact(query, type = 'general') {
  console.log(`\n🔍 영향도 분석: "${query}"`);
  console.log('=' .repeat(60));

  try {
    const response = await fetch(`${API_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        type: type,
        repositoryPath: process.cwd()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.data) {
      const { results, analysis } = result.data;

      if (results && results.length > 0) {
        console.log(`\n📁 영향받는 파일 (상위 10개):`);
        console.log('-'.repeat(40));

        results.slice(0, 10).forEach((file, idx) => {
          console.log(`${idx + 1}. ${file.path || file.filePath}`);
          // similarity가 이미 문자열 퍼센트로 오는 경우 처리
          const similarity = file.similarity || file.impactScore;
          const similarityStr = typeof similarity === 'string' ?
            similarity :
            `${(similarity * 100).toFixed(1)}%`;
          console.log(`   영향도: ${similarityStr}`);
          console.log(`   수준: ${file.impactLevel || 'MEDIUM'}`);
          if (file.reason) {
            console.log(`   이유: ${file.reason}`);
          }
        });
      } else {
        console.log('⚠️  영향받는 파일이 없습니다.');
      }

      if (analysis) {
        console.log(`\n📊 분석 요약:`);
        console.log('-'.repeat(40));
        console.log(`위험 수준: ${analysis.riskLevel}`);
        console.log(`예상 작업량: ${analysis.estimatedEffort}`);

        if (analysis.considerations?.length > 0) {
          console.log(`\n⚠️  고려사항:`);
          analysis.considerations.forEach(item => {
            console.log(`  - ${item}`);
          });
        }
      }
    } else {
      console.log('❌ 분석 실패:', result.error || '알 수 없는 오류');
    }

  } catch (error) {
    console.error('❌ 검색 중 오류:', error.message);
  }
}

/**
 * 예제 쿼리 목록
 */
function showExamples() {
  console.log('\n📝 예제 쿼리:');
  console.log('=' .repeat(60));

  const examples = [
    {
      query: "JWT 토큰 검증 로직을 변경하려고 합니다",
      type: "security",
      desc: "보안 관련 변경"
    },
    {
      query: "사용자 인증 API에 rate limiting을 추가하려고 합니다",
      type: "api",
      desc: "API 변경"
    },
    {
      query: "데이터베이스 스키마를 변경하고 User 테이블에 컬럼을 추가하려고 합니다",
      type: "database",
      desc: "DB 스키마 변경"
    },
    {
      query: "React 컴포넌트의 상태관리를 Redux에서 Context API로 변경하려고 합니다",
      type: "frontend",
      desc: "프론트엔드 변경"
    },
    {
      query: "로깅 시스템을 Log4j에서 Logback으로 마이그레이션하려고 합니다",
      type: "infrastructure",
      desc: "인프라 변경"
    }
  ];

  examples.forEach((ex, idx) => {
    console.log(`\n${idx + 1}. ${ex.desc}`);
    console.log(`   쿼리: "${ex.query}"`);
    console.log(`   타입: ${ex.type}`);
    console.log(`   명령: node index-and-search.js search "${ex.query}" ${ex.type}`);
  });

  console.log('\n' + '=' .repeat(60));
}

/**
 * 메인 함수
 */
async function main() {
  const command = process.argv[2];

  if (!command) {
    console.log(`
🚀 코드베이스 영향도 분석 도구

사용법:
  node index-and-search.js <명령> [옵션]

명령어:
  index <경로>          - 코드베이스 인덱싱
  search <쿼리> [타입]  - 영향도 분석 검색
  examples             - 예제 쿼리 보기

예제:
  node index-and-search.js index /tmp/letsgo
  node index-and-search.js search "JWT 토큰 로직 변경"
  node index-and-search.js search "API rate limiting 추가" api
  node index-and-search.js examples
    `);
    return;
  }

  switch (command) {
    case 'index':
      const projectPath = process.argv[3];
      if (!projectPath) {
        console.error('❌ 프로젝트 경로를 지정하세요.');
        console.log('예: node index-and-search.js index /path/to/project');
        return;
      }
      await indexCodebase(projectPath);
      break;

    case 'search':
      const query = process.argv[3];
      const type = process.argv[4] || 'general';
      if (!query) {
        console.error('❌ 검색 쿼리를 입력하세요.');
        console.log('예: node index-and-search.js search "변경하려는 내용"');
        return;
      }
      await searchImpact(query, type);
      break;

    case 'examples':
      showExamples();
      break;

    default:
      console.error(`❌ 알 수 없는 명령: ${command}`);
      console.log('사용 가능한 명령: index, search, examples');
  }
}

// 실행
main().catch(console.error);

export { indexCodebase, searchImpact };