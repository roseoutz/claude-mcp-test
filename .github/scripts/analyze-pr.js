#!/usr/bin/env node

/**
 * AI PR 분석 스크립트
 * GitHub Pull Request를 분석하여 리뷰 가이드를 자동 생성합니다.
 */

import Anthropic from '@anthropic-ai/sdk';
import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경 변수 검증
const REQUIRED_ENV_VARS = [
  'GITHUB_TOKEN',
  'ANTHROPIC_API_KEY',
  'PR_NUMBER',
  'REPO_OWNER',
  'REPO_NAME',
];

for (const envVar of REQUIRED_ENV_VARS) {
  if (!process.env[envVar]) {
    console.error(`❌ 환경 변수 ${envVar}가 설정되지 않았습니다.`);
    process.exit(1);
  }
}

// 초기화
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const owner = process.env.REPO_OWNER;
const repo = process.env.REPO_NAME;
const prNumber = parseInt(process.env.PR_NUMBER, 10);
const baseBranch = process.env.BASE_BRANCH || 'main';
const headBranch = process.env.HEAD_BRANCH || '';
const prTitle = process.env.PR_TITLE || '';

// 환경변수로 전달된 diff와 files (GitHub Actions에서 제공)
const prDiffFromEnv = process.env.PR_DIFF || null;
const changedFilesFromEnv = process.env.CHANGED_FILES || null;

// PR Number 유효성 검증
if (isNaN(prNumber) || prNumber <= 0) {
  console.error('❌ 유효하지 않은 PR_NUMBER:', process.env.PR_NUMBER);
  process.exit(1);
}

/**
 * 설정 파일 로드
 */
function loadConfig() {
  const configPath = path.join(__dirname, '..', 'pr-analyzer-config.json');
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (error) {
    console.log('⚠️  설정 파일을 로드할 수 없습니다. 기본 설정을 사용합니다.');
  }
  return {
    customPrompt: '',
    criticalPaths: [],
    excludePaths: [],
    checklistItems: [],
  };
}

/**
 * PR 정보 가져오기
 */
async function getPRInfo() {
  console.log(`\n📋 PR 정보 수집 중...`);
  console.log(`- Repository: ${owner}/${repo}`);
  console.log(`- PR Number: ${prNumber}`);

  try {
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    const { data: files } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
    });

    return { pr, files };
  } catch (error) {
    console.error('❌ PR 정보를 가져오는 중 오류 발생:', error.message);
    throw error;
  }
}

/**
 * Git diff 가져오기
 */
async function getDiff() {
  // 환경변수로 전달된 diff가 있으면 우선 사용 (GitHub Actions에서 제공)
  if (prDiffFromEnv) {
    console.log(`\n🔍 환경변수에서 Git diff 로드 (길이: ${prDiffFromEnv.length}자)`);
    return prDiffFromEnv;
  }

  // 환경변수가 없으면 GitHub API로 가져오기 (fallback)
  console.log(`\n🔍 GitHub API로 Git diff 가져오는 중...`);

  try {
    const { data: diff } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
      mediaType: {
        format: 'diff',
      },
    });

    return diff;
  } catch (error) {
    console.error('❌ Diff를 가져오는 중 오류 발생:', error.message || error);
    throw error;
  }
}

/**
 * PR 본문에서 작성자가 입력한 정보 추출
 */
function extractAuthorInput(prBody) {
  const input = {
    coreChange: '',
    checkPoints: [],
    concerns: [],
  };

  if (!prBody) return input;

  // "변경의 핵심" 추출
  const coreMatch = prBody.match(/\*\*변경의 핵심:\*\*\s*(?:<!--.*?-->\s*)?([\s\S]*?)(?=\*\*특히 확인|$)/);
  if (coreMatch && coreMatch[1].trim()) {
    input.coreChange = coreMatch[1].trim().split('\n')[0];
  }

  // "특히 확인해야 할 부분" 추출
  const checkMatch = prBody.match(/\*\*특히 확인해야 할 부분:\*\*\s*(?:<!--.*?-->\s*)?([\s\S]*?)(?=\*\*우려 사항|---|\*\*|$)/);
  if (checkMatch && checkMatch[1].trim()) {
    const points = checkMatch[1].trim().split('\n').filter(line => line.trim().startsWith('-'));
    input.checkPoints = points.map(p => p.replace(/^-\s*/, '').trim()).filter(Boolean);
  }

  // "우려 사항" 추출
  const concernMatch = prBody.match(/\*\*우려 사항:\*\*\s*(?:<!--.*?-->\s*)?([\s\S]*?)(?=---|\*\*|$)/);
  if (concernMatch && concernMatch[1].trim()) {
    const concerns = concernMatch[1].trim().split('\n').filter(line => line.trim().startsWith('-'));
    input.concerns = concerns.map(c => c.replace(/^-\s*/, '').trim()).filter(Boolean);
  }

  return input;
}

/**
 * AI 분석 프롬프트 생성
 */
function createAnalysisPrompt(pr, files, diff, config) {
  const fileList = files.map((f) => {
    const status = f.status === 'added' ? '➕' : f.status === 'removed' ? '➖' : '📝';
    return `${status} ${f.filename} (+${f.additions}/-${f.deletions})`;
  }).join('\n');

  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

  // Diff 크기 제한 (Claude API 토큰 제한 고려)
  const maxDiffLength = 15000;
  const truncatedDiff = diff.length > maxDiffLength
    ? diff.slice(0, maxDiffLength) + '\n\n... (diff truncated for length) ...'
    : diff;

  const codeBlockMarker = '```';

  // 작성자 입력 정보 추출
  const authorInput = extractAuthorInput(pr.body);

  let prompt = `당신은 경험 많은 시니어 개발자입니다.
Pull Request 변경사항을 요약하고 전체 그림을 그려주세요.

## 📋 PR 정보
- **제목**: ${prTitle}
- **Base**: ${baseBranch} / **Head**: ${headBranch}
- **변경**: ${files.length}개 파일, +${totalAdditions}/-${totalDeletions}줄

${authorInput.coreChange ? `## 💡 작성자가 알려준 정보 (중요!)

**변경의 핵심**: ${authorInput.coreChange}
${authorInput.checkPoints.length > 0 ? '\n**특히 확인해야 할 부분**:\n' + authorInput.checkPoints.map(p => `- ${p}`).join('\n') : ''}
${authorInput.concerns.length > 0 ? '\n**우려 사항**:\n' + authorInput.concerns.map(c => `- ${c}`).join('\n') : ''}

→ 위 정보를 분석에 적극 활용하세요!
` : ''}
## 📁 변경된 파일
${fileList}

## 🔍 Diff
${codeBlockMarker}diff
${truncatedDiff}
${codeBlockMarker}

## 🎯 프로젝트 컨텍스트
Code AI MCP 시스템 (Monorepo):
- @code-ai/local-mcp: NestJS MCP 서버
- @code-ai/aws-api: Express API 서버
- @code-ai/shared: 공유 타입
- 기술: TypeScript, gRPC, OpenAI, Anthropic, Elasticsearch

${config.customPrompt ? '\n' + config.customPrompt + '\n' : ''}

## 📊 분석 목적
이 PR의 **변경 사항을 요약**하고 **전체 그림**을 그려주세요.
리뷰어가 많은 파일 변경 속에서 "무엇이, 왜, 어떻게 바뀌었는지" 빠르게 파악할 수 있도록 도와주세요.

**초점:**
- ✅ 변경 사항 요약 및 설명 (스토리텔링)
- ✅ 파일 간 연관성 및 변경 흐름
- ✅ 전체 맥락 이해
- ⚠️ 코드 리뷰가 아닌 요약 제공

## 📝 출력 형식

### 📋 요약 (2-3문장)

**변경 내용:**


**변경 통계:** {N}개 파일, +{N}/-{N}줄

---

### 🗂️ 카테고리별 변경

#### {카테고리명} (예: API 라우터 추가)
| 파일 | 변경 | 내용 (1줄) |
|------|------|------------|
| path/to/file | ➕/📝/➖ | ... |

**이유**: ...
**영향**: ...

---

### 💡 리뷰 참고사항

**확인 포인트:**
1. {파일}: {내용}
2. {파일}: {내용}

**주의사항** (있다면):
- {내용}

**Breaking Changes**: ✅ 있음 / ❌ 없음

**의존성 변경**: ✅ 있음 / ❌ 없음

---

<div align="center">

✨ **이 분석은 Claude AI (Sonnet 4.5)에 의해 자동 생성되었습니다**

분석 결과는 참고용이며, 최종 판단은 리뷰어가 수행해주세요.

</div>

**가이드**:
1. 간결하게: 각 파일 1줄, 카테고리 2-3문장
2. 작성자 정보 우선 참고
3. 파일을 의미있는 카테고리로 그룹화
4. 코드 리뷰가 아닌 변경 요약에 집중
5. 표 형식으로 시각화

**주의**:
- ✅ "이 파일은 XX를 위해 변경"
- ❌ "이 파일 확인하세요"`;

  return prompt;
}

/**
 * AI 분석 실행 (재시도 로직 포함)
 */
async function analyzeWithAI(prompt, retries = 3) {
  console.log(`\n🤖 Claude AI로 분석 중...`);
  console.log(`📊 프롬프트 길이: ${prompt.length}자`);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      if (!message.content || message.content.length === 0) {
        throw new Error('AI 응답이 비어있습니다.');
      }

      const analysis = message.content[0].text;
      console.log(`✅ AI 분석 완료 (응답 길이: ${analysis.length}자)`);
      return analysis;
    } catch (error) {
      const errorMsg = error.message || String(error);
      console.error(`❌ AI 분석 실패 (시도 ${attempt}/${retries}):`, errorMsg);

      if (attempt < retries) {
        const waitTime = attempt * 2000; // 2초, 4초, 6초
        console.log(`⏳ ${waitTime / 1000}초 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw new Error(`AI 분석 실패 (${retries}회 시도): ${errorMsg}`);
      }
    }
  }
}

/**
 * PR 본문 업데이트
 */
async function updatePRBody(pr, analysis) {
  console.log(`\n📝 PR 본문 업데이트 중...`);

  const originalBody = pr.body || '';
  const aiSectionMarker = '## 🤖 AI 코드 리뷰 (자동 생성)';

  // 템플릿에서 사용하는 마커도 체크
  const templateMarker = '## 🤖 AI 분석 결과 (자동 생성)';

  let newBody;
  let markerToUse = aiSectionMarker;

  // 어느 마커가 사용되었는지 확인
  if (originalBody.includes(templateMarker)) {
    markerToUse = templateMarker;
  }

  if (originalBody.includes(markerToUse)) {
    // 기존 AI 분석 섹션이 있으면 교체
    const parts = originalBody.split(markerToUse);
    const beforeSection = parts[0];

    // 다음 ## 헤더 찾기 (더 robust한 regex)
    const afterMarker = parts.slice(1).join(markerToUse);
    const nextHeaderMatch = afterMarker.match(/\n## (?!🤖)/);

    if (nextHeaderMatch) {
      const afterSection = afterMarker.slice(nextHeaderMatch.index);
      newBody = `${beforeSection}${markerToUse}\n\n${analysis}\n${afterSection}`;
    } else {
      newBody = `${beforeSection}${markerToUse}\n\n${analysis}`;
    }
  } else {
    // AI 분석 섹션이 없으면 추가
    newBody = `${originalBody}\n\n${aiSectionMarker}\n\n${analysis}`;
  }

  try {
    await octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: prNumber,
      body: newBody,
    });
    console.log('✅ PR 본문 업데이트 완료');
    console.log(`📏 업데이트된 본문 길이: ${newBody.length}자`);
  } catch (error) {
    const errorMsg = error.message || String(error);
    console.error('❌ PR 업데이트 중 오류 발생:', errorMsg);

    // 에러 상세 정보 출력
    if (error.status) {
      console.error(`HTTP Status: ${error.status}`);
    }
    if (error.response) {
      console.error(`Response:`, error.response.data);
    }

    throw error;
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('\n🚀 AI PR Analyzer 시작\n');
  console.log('='.repeat(60));

  try {
    // 1. 설정 로드
    console.log('\n📂 1단계: 설정 로드');
    const config = loadConfig();

    // 2. PR 정보 수집
    console.log('\n📋 2단계: PR 정보 수집');
    const { pr, files } = await getPRInfo();

    if (!files || files.length === 0) {
      console.log('⚠️  변경된 파일이 없습니다. 분석을 건너뜁니다.');
      return;
    }

    console.log(`📊 파일 수: ${files.length}개`);

    // 3. Diff 가져오기
    console.log('\n🔍 3단계: Git diff 가져오기');
    const diff = await getDiff();

    if (!diff || diff.length === 0) {
      console.log('⚠️  Diff가 비어있습니다. 분석을 건너뜁니다.');
      return;
    }

    console.log(`📏 Diff 크기: ${diff.length}자`);

    // 4. AI 프롬프트 생성
    console.log('\n📝 4단계: AI 프롬프트 생성');
    const prompt = createAnalysisPrompt(pr, files, diff, config);

    // 5. AI 분석
    console.log('\n🤖 5단계: AI 분석 실행');
    const analysis = await analyzeWithAI(prompt);

    // 6. PR 본문 업데이트
    console.log('\n✏️  6단계: PR 본문 업데이트');
    await updatePRBody(pr, analysis);

    console.log('\n' + '='.repeat(60));
    console.log('✅ PR 분석 완료!\n');
    console.log(`🔗 PR 확인: https://github.com/${owner}/${repo}/pull/${prNumber}`);
  } catch (error) {
    const errorMsg = error.message || String(error);
    console.error('\n' + '='.repeat(60));
    console.error('❌ 오류 발생:', errorMsg);
    console.error('='.repeat(60));

    // 스택 트레이스 출력 (디버깅용)
    if (error.stack) {
      console.error('\n스택 트레이스:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// 실행
main();
