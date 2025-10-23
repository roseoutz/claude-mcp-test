# 🐛 테스트용 치명적 버그 목록

이 문서는 PR 자동화 시스템이 치명적인 버그를 감지하는지 테스트하기 위해 의도적으로 추가된 버그들을 설명합니다.

## 📋 브랜치: `test/critical-bugs-detection`

---

## 🔴 추가된 치명적 버그 목록

### 1. Null 참조 에러 (NPE)
**파일**: `packages/aws-api/src/routes/test-bugs.ts:23-41`
```typescript
const user = users.find(u => u.id === userId);
const notifications = user.settings.notifications; // ❌ user와 settings 체크 없음
```

**문제**:
- `user`가 `undefined`일 수 있음
- `user.settings`가 `undefined`일 수 있음
- 첫 번째 접근 시 `TypeError: Cannot read property 'settings' of undefined`

**영향**: 서버 크래시

---

### 2. 무한 루프 위험
**파일**: `packages/aws-api/src/routes/test-bugs.ts:48-66`
```typescript
while (count < items.length) {
  const item = items[count];
  if (item.type === 'skip') {
    continue; // ❌ count++가 없어서 무한 루프
  }
  results.push({ processed: item });
  count++;
}
```

**문제**:
- `type === 'skip'`인 아이템에서 count가 증가하지 않음
- 무한 루프 발생 → CPU 100%, 메모리 소진

**영향**: 서버 응답 불가, DoS

---

### 3. 배열 인덱스 오버플로우
**파일**: `packages/aws-api/src/routes/test-bugs.ts:72-85`
```typescript
const index = parseInt(req.params.index);
const item = data[index]; // ❌ 인덱스 범위 체크 없음
const uppercased = item.toUpperCase(); // ❌ undefined.toUpperCase() 크래시
```

**문제**:
- 음수 인덱스 가능
- 배열 길이 초과 가능
- `undefined.toUpperCase()` 호출 시 TypeError

**영향**: 서버 크래시

---

### 4. Promise 에러 처리 누락
**파일**: `packages/aws-api/src/routes/test-bugs.ts:91-107`
```typescript
// ❌ try-catch 없음
const result = await fetch('http://invalid-api-endpoint.com/analyze', {
  method: 'POST',
  body: JSON.stringify({ code })
});
```

**문제**:
- 네트워크 오류 시 unhandled promise rejection
- 서버 크래시 또는 응답 없음

**영향**: 서버 불안정, 사용자 경험 저하

---

### 5. 타입 불일치 런타임 에러
**파일**: `packages/aws-api/src/routes/test-bugs.ts:113-123`
```typescript
const { numbers } = req.body;
const total = numbers.reduce((sum: number, num: any) => sum + num, 0); // ❌ 타입 체크 없음
```

**문제**:
- `numbers`가 배열이 아닐 수 있음
- 배열 요소가 숫자가 아닐 수 있음
- `TypeError: numbers.reduce is not a function` 또는 `NaN` 결과

**영향**: 서버 크래시 또는 잘못된 계산 결과

---

### 6. 메모리 누수
**파일**: `packages/aws-api/src/routes/test-bugs.ts:129-146`
```typescript
let globalListeners: Array<() => void> = [];

router.post('/subscribe', (req, res) => {
  const listener = () => { ... };
  globalListeners.push(listener); // ❌ 제거 메커니즘 없음
});
```

**문제**:
- 요청마다 리스너가 계속 쌓임
- GC가 회수하지 못함
- 장시간 운영 시 메모리 소진

**영향**: 메모리 부족으로 서버 다운

---

### 7. 스택 오버플로우
**파일**: `packages/aws-api/src/routes/test-bugs.ts:152-161`
```typescript
function processRecursively(data: any, depth: number): any {
  if (depth < 1000) { // ❌ 잘못된 조건 (> 대신 <)
    return processRecursively(data, depth + 1);
  }
  return data;
}
```

**문제**:
- 종료 조건이 거의 실행되지 않음
- 재귀 호출 무한 반복
- Maximum call stack size exceeded

**영향**: 서버 크래시

---

### 8. Race Condition
**파일**: `packages/aws-api/src/routes/test-bugs.ts:167-181`
```typescript
let requestCount = 0;

router.get('/stats', async (req, res) => {
  const currentCount = requestCount; // ❌ 동기화 없음
  await new Promise(resolve => setTimeout(resolve, 100));
  requestCount = currentCount + 1; // ❌ 잘못된 카운트
});
```

**문제**:
- 동시 요청 시 카운트 정확도 떨어짐
- Lost update problem
- 통계 데이터 부정확

**영향**: 잘못된 비즈니스 로직

---

### 9. 초기화되지 않은 변수 사용
**파일**: `packages/aws-api/src/routes/health.ts:7-21`
```typescript
let lastCheckTime: Date; // ❌ 초기화 안 됨

router.get('/', (req, res) => {
  const uptime = Date.now() - lastCheckTime.getTime(); // ❌ 첫 요청에서 크래시
});
```

**문제**:
- 첫 번째 요청 시 `lastCheckTime`이 `undefined`
- `undefined.getTime()` 호출 → TypeError
- 헬스체크 실패 → 로드밸런서가 서버 제외

**영향**: 서버가 서비스에서 제외됨

---

### 10. 잘못된 비동기 패턴
**파일**: `packages/aws-api/src/services/elasticsearch.service.ts:188-201`
```typescript
getAllDocuments(): Promise<any[]> { // ❌ async 키워드 없음
  const response = this.client.search({ // ❌ await 없음
    query: { match_all: {} },
    size: 10000 // ❌ 메모리 과다 사용
  });
  return response as any; // ❌ 잘못된 타입, Promise<SearchResponse> 반환
}
```

**문제**:
- `async` 없이 비동기 작업
- `await` 없어서 미완료된 Promise 반환
- 10,000개 문서 한 번에 로드 → 메모리 부족
- 타입 불일치

**영향**: 잘못된 데이터 반환, 메모리 부족, 타입 에러

---

## 🎯 테스트 목적

이 PR을 생성하면 AI 분석 시스템이 다음을 감지해야 합니다:

### 기대하는 AI 분석 결과

#### 📋 한눈에 보는 변경 사항
> 테스트용 버그가 포함된 라우터와 서비스 메서드 추가

#### 🗂️ 파일별 변경 요약

**카테고리: 치명적 버그가 포함된 테스트 코드**

| 파일 | 변경 | 내용 |
|------|------|------|
| routes/test-bugs.ts | 추가 | 8가지 치명적 버그 포함 |
| routes/health.ts | 수정 | 초기화 안 된 변수 사용 |
| services/elasticsearch.service.ts | 수정 | 잘못된 비동기 패턴 |
| index.ts | 수정 | 테스트 라우터 등록 |

#### 💡 리뷰 시 참고사항

**⚠️ 주의해서 봐야 할 부분**:
1. **test-bugs.ts**: Null 참조, 무한 루프, 배열 오버플로우
2. **health.ts**: 초기화 안 된 변수로 인한 첫 요청 크래시
3. **elasticsearch.service.ts**: 비동기 패턴 오류, 메모리 이슈

**✅ Breaking Changes**: ❌ 없음 (테스트 엔드포인트만 추가)

**📦 의존성 변경**: ❌ 없음

---

## ✅ 성공 기준

AI가 다음 항목들을 감지하면 성공:

- [ ] Null/Undefined 체크 누락
- [ ] 무한 루프 가능성
- [ ] 배열 인덱스 범위 체크 누락
- [ ] try-catch 누락
- [ ] 타입 검증 없음
- [ ] 메모리 누수 패턴
- [ ] 재귀 종료 조건 오류
- [ ] Race condition
- [ ] 초기화 안 된 변수
- [ ] 비동기 패턴 오류

---

## 📝 테스트 절차

1. 이 브랜치를 푸시
2. GitHub에서 PR 생성 (base: main)
3. GitHub Actions가 자동 실행
4. PR 본문의 "🤖 AI 분석 결과" 확인
5. AI가 위 버그들을 얼마나 감지했는지 확인

---

**주의**: 이 코드는 테스트용입니다. 절대 main에 머지하지 마세요!
