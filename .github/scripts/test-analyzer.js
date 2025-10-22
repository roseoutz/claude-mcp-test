#!/usr/bin/env node

/**
 * AI PR 분석 스크립트 테스트
 * 실제 PR 없이 로컬에서 테스트할 수 있습니다.
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock 데이터
const mockPRData = {
  title: "refactor: 코드 분석 API 구조 개선 및 Elasticsearch 통합",
  baseBranch: "main",
  headBranch: "feature/elasticsearch-integration",
  files: [
    {
      filename: "packages/aws-api/src/routes/code-analysis.ts",
      status: "added",
      additions: 150,
      deletions: 0
    },
    {
      filename: "packages/aws-api/src/routes/code-search.ts",
      status: "added",
      additions: 120,
      deletions: 0
    },
    {
      filename: "packages/aws-api/src/services/elasticsearch.service.ts",
      status: "added",
      additions: 149,
      deletions: 0
    },
    {
      filename: "packages/aws-api/src/index.ts",
      status: "modified",
      additions: 10,
      deletions: 8
    },
    {
      filename: "packages/aws-api/package.json",
      status: "modified",
      additions: 2,
      deletions: 0
    }
  ],
  diff: String.raw`diff --git a/packages/aws-api/src/index.ts b/packages/aws-api/src/index.ts
index 9e4fb35..422711e 100644
--- a/packages/aws-api/src/index.ts
+++ b/packages/aws-api/src/index.ts
@@ -1,10 +1,10 @@
 import 'dotenv/config';
 import express from 'express';
 import cors from 'cors';
-import { ApiResponse, AnalysisRequest } from '@code-ai/shared';
-import { router as analysisRouter } from './routes/analysis.js';
+import { ApiResponse } from '@code-ai/shared';
 import { router as healthRouter } from './routes/health.js';
-import { router as impactRouter } from './routes/impact-analysis.js';
+import { router as codeAnalysisRouter } from './routes/code-analysis.js';
+import { router as codeSearchRouter } from './routes/code-search.js';
 import { startGrpcServer } from './grpc/grpc.server.js';

diff --git a/packages/aws-api/src/services/elasticsearch.service.ts b/packages/aws-api/src/services/elasticsearch.service.ts
new file mode 100644
index 0000000..0000000
--- /dev/null
+++ b/packages/aws-api/src/services/elasticsearch.service.ts
@@ -0,0 +1,149 @@
+import { Client } from '@elastic/elasticsearch';
+
+export class ElasticsearchService {
+  private client: Client;
+  private indexName = 'code-embeddings';
+
+  constructor() {
+    this.client = new Client({
+      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
+      auth: process.env.ELASTICSEARCH_AUTH === 'true' ? {
+        username: process.env.ELASTICSEARCH_USERNAME!,
+        password: process.env.ELASTICSEARCH_PASSWORD!
+      } : undefined
+    });
+  }
+
+  async ensureIndex(): Promise<void> {
+    const exists = await this.client.indices.exists({ index: this.indexName });
+
+    if (!exists) {
+      await this.client.indices.create({
+        index: this.indexName,
+        body: {
+          mappings: {
+            properties: {
+              file_path: { type: 'keyword' },
+              content: { type: 'text' },
+              embedding: {
+                type: 'dense_vector',
+                dims: 1536,
+                index: true,
+                similarity: 'cosine'
+              }
+            }
+          }
+        }
+      });
+    }
+  }
+}`
};

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
 * AI 분석 프롬프트 생성
 */
function createAnalysisPrompt(prData, config) {
  const fileList = prData.files.map((f) => {
    const status = f.status === 'added' ? '➕' : f.status === 'removed' ? '➖' : '📝';
    return `${status} ${f.filename} (+${f.additions}/-${f.deletions})`;
  }).join('\n');

  const totalAdditions = prData.files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = prData.files.reduce((sum, f) => sum + f.deletions, 0);

  const codeBlockMarker = '```';

  let prompt = `당신은 경험 많은 시니어 개발자이자 코드 리뷰 전문가입니다.
다음 Pull Request의 변경사항을 분석하고 리뷰어가 중점적으로 확인해야 할 사항을 작성해주세요.

## 📋 PR 정보
- **제목**: ${prData.title}
- **Base 브랜치**: ${prData.baseBranch}
- **Head 브랜치**: ${prData.headBranch}
- **변경 통계**: ${prData.files.length}개 파일, +${totalAdditions}줄/-${totalDeletions}줄

## 📁 변경된 파일 목록
${fileList}

## 🔍 코드 변경 내용 (Diff)
${codeBlockMarker}diff
${prData.diff}
${codeBlockMarker}

## 🎯 프로젝트 컨텍스트
이 프로젝트는 Code AI MCP (Model Context Protocol) 시스템입니다:
- **아키텍처**: Monorepo (npm workspaces)
- **주요 패키지**:
  - @code-ai/local-mcp: NestJS 기반 로컬 MCP 서버
  - @code-ai/aws-api: Express 기반 AWS API 서버
  - @code-ai/shared: 공유 타입 및 유틸리티
- **기술 스택**: TypeScript, Node.js, gRPC, OpenAI API, Anthropic API, Elasticsearch
- **주요 기능**: 코드베이스 분석, 영향도 분석, 시맨틱 검색

${config.customPrompt ? '\n## 📌 추가 컨텍스트\n' + config.customPrompt : ''}

## 📊 분석 목적
이 PR의 **변경 사항을 요약**하고 **전체 그림**을 그려주세요.
리뷰어가 많은 파일 변경 속에서 "무엇이, 왜, 어떻게 바뀌었는지" 빠르게 파악할 수 있도록 도와주세요.

**초점:**
- ✅ 변경 사항 요약 및 설명 (스토리텔링)
- ✅ 파일 간 연관성 및 변경 흐름
- ✅ 전체 맥락 이해
- ⚠️ 코드 리뷰가 아닌 요약 제공

## 📝 출력 형식 (반드시 이 형식을 따라주세요)

### 📋 한눈에 보는 변경 사항

**이 PR은 무엇을 하나요?** (1-2문장 요약)
> {전체 변경의 핵심을 한눈에 파악할 수 있도록}

**변경 통계:**
- 📁 변경 파일: {개수}개
- ➕ 추가: {개수}줄 / ➖ 삭제: {개수}줄
- 🏷️ 유형: feat / fix / refactor / docs 등

---

### 🗂️ 파일별 변경 요약

> 변경된 파일들을 카테고리별로 그룹화하여 설명합니다.

#### 📂 {카테고리 1}: {카테고리명} (예: 라우터 변경)

| 파일 | 변경 유형 | 주요 변경 내용 |
|------|----------|---------------|
| src/index.ts | 수정 ✏️ | {1줄 요약} |
| routes/new.ts | 추가 ➕ | {1줄 요약} |
| routes/old.ts | 삭제 ➖ | {1줄 요약} |

**왜 이렇게 변경했나요?**
- {카테고리 전체의 변경 이유 및 배경}

**어떤 영향이 있나요?**
- {이 변경으로 인한 시스템 영향}

#### 📂 {카테고리 2}: {카테고리명} (예: 새로운 서비스 추가)

| 파일 | 변경 유형 | 주요 변경 내용 |
|------|----------|---------------|
| services/elasticsearch.service.ts | 추가 ➕ | {1줄 요약} |

**왜 이렇게 변경했나요?**
- {변경 이유}

**어떤 영향이 있나요?**
- {영향 설명}

---

### 🎯 이번 PR의 핵심 스토리

> 변경 사항들이 어떻게 연결되는지, 전체 그림을 그려봅니다.

#### 변경의 흐름
1. **{첫 번째 단계}**: {설명}
   → 관련 파일: file1.ts, file2.ts

2. **{두 번째 단계}**: {설명}
   → 관련 파일: file3.ts

3. **{세 번째 단계}**: {설명}
   → 관련 파일: file4.ts

#### 주요 의사결정
- **{결정사항 1}**: {왜 이렇게 했는지}
- **{결정사항 2}**: {대안 대비 장점}

---

### 🔄 변경 사항 연관 다이어그램

**Before → After 구조:**
- [삭제] 분석 라우터 → [추가] 코드 분석 라우터
- [삭제] 이전 서비스 → [추가] Elasticsearch 서비스
- [추가] 코드 검색 라우터

**주요 연관성:**
- A 파일 변경 → B 파일에 영향
- C 기능 추가 → D, E 파일 수정 필요

---

### 💡 리뷰 시 참고사항

> 코드 리뷰가 아닌, 리뷰 시 알아두면 좋은 정보

#### 🎯 중점적으로 확인하면 좋은 부분
1. **{파일명}**: {이 파일에서 특히 확인할 부분과 이유}
2. **{파일명}**: {확인 포인트}

#### ⚠️ 주의해서 봐야 할 부분 (있다면)
- **{항목}**: {주의가 필요한 이유}

#### ✅ Breaking Changes
- ✅ 있음: {어떤 Breaking Change인지}
- ❌ 없음

#### 📦 의존성 변경
- ✅ 있음: {추가/제거/변경된 패키지}
- ❌ 없음

---

<div align="center">

✨ **이 분석은 Claude AI (Sonnet 4.5)에 의해 자동 생성되었습니다**

분석 결과는 참고용이며, 최종 판단은 리뷰어가 수행해주세요.

</div>

**중요 가이드라인 (반드시 준수)**:

1. **요약 중심**: 코드 리뷰가 아닌, 변경 사항 요약에 집중
2. **스토리텔링**: "무엇을", "왜", "어떻게" 바꿨는지 이야기로 전달
3. **카테고리화**: 파일들을 의미있는 그룹으로 묶어서 설명
4. **전체 그림**: 개별 파일보다 전체 변경의 맥락과 흐름 강조
5. **간결성**: 각 파일당 1줄 요약, 카테고리당 2-3문장
6. **연관성**: 파일 간 연결고리와 의존성 명시
7. **시각화**: 가능하면 다이어그램이나 표로 시각화

**각 섹션별 가이드**:
- **한눈에 보는 변경**: PR 전체를 1-2문장으로 핵심만
- **파일별 요약**: 기능/목적별로 그룹화 (파일 시스템 구조 아님)
- **핵심 스토리**: 변경의 흐름을 1→2→3 순서로 설명
- **연관 다이어그램**: Before/After 비교 또는 파일 간 관계도
- **리뷰 참고사항**: 꼭 필요한 정보만 간단히 (체크리스트 X)

**작성 시 주의사항**:
- ❌ "이 파일 확인하세요", "저기 테스트하세요" (리뷰 지시)
- ✅ "이 파일은 ~~을 위해 ~~하도록 변경", "~~와 연동"
- ❌ 파일 하나하나 나열
- ✅ 카테고리별 그룹화 및 요약
- ❌ 코드 줄 번호, 상세한 구현 설명
- ✅ 전체 맥락, 변경 이유, 영향 범위`;

  return prompt;
}

/**
 * AI 분석 실행
 */
async function analyzeWithAI(prompt, apiKey) {
  console.log(`\n🤖 Claude AI로 분석 중...`);

  const anthropic = new Anthropic({ apiKey });

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

    const analysis = message.content[0].text;
    console.log('✅ AI 분석 완료\n');
    return analysis;
  } catch (error) {
    console.error('❌ AI 분석 중 오류 발생:', error.message);
    throw error;
  }
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('\n🧪 AI PR Analyzer 테스트 모드\n');
  console.log('='.repeat(60));

  // API 키 확인
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('\n❌ ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다.');
    console.log('\n사용법:');
    console.log('export ANTHROPIC_API_KEY="your_api_key"');
    console.log('node test-analyzer.js\n');
    process.exit(1);
  }

  try {
    // 1. 설정 로드
    console.log('📋 설정 로드 중...');
    const config = loadConfig();
    console.log('✅ 설정 로드 완료\n');

    // 2. Mock 데이터 표시
    console.log('📦 테스트 데이터:');
    console.log(`- PR 제목: ${mockPRData.title}`);
    console.log(`- 변경된 파일: ${mockPRData.files.length}개`);
    console.log(`- Base: ${mockPRData.baseBranch} → Head: ${mockPRData.headBranch}\n`);

    // 3. 프롬프트 생성
    console.log('📝 AI 프롬프트 생성 중...');
    const prompt = createAnalysisPrompt(mockPRData, config);
    console.log('✅ 프롬프트 생성 완료\n');

    // 프롬프트 미리보기 (선택사항)
    if (process.argv.includes('--show-prompt')) {
      console.log('='.repeat(60));
      console.log('📄 생성된 프롬프트:\n');
      console.log(prompt);
      console.log('\n' + '='.repeat(60) + '\n');
    }

    // 4. AI 분석
    const analysis = await analyzeWithAI(prompt, apiKey);

    // 5. 결과 출력
    console.log('='.repeat(60));
    console.log('📊 AI 분석 결과:\n');
    console.log(analysis);
    console.log('\n' + '='.repeat(60));

    // 6. 결과를 파일로 저장
    const outputPath = path.join(__dirname, 'test-result.md');
    fs.writeFileSync(outputPath, `# AI PR 분석 테스트 결과\n\n${analysis}`, 'utf8');
    console.log(`\n💾 결과가 저장되었습니다: ${outputPath}`);

    console.log('\n✅ 테스트 완료!\n');
  } catch (error) {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
  }
}

// 실행
main();
