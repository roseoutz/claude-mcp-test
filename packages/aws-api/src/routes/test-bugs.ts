/**
 * 테스트용 버그 포함 코드
 * 이 파일은 AI PR 분석이 치명적 버그를 감지하는지 테스트하기 위한 것입니다.
 */

import { Router, Request, Response } from 'express';
import { ApiResponse } from '@code-ai/shared';

export const router = Router();

interface User {
  id: number;
  name: string;
  email: string;
  settings?: {
    notifications: boolean;
    theme: string;
  };
}

/**
 * 🐛 버그 1: Null 참조 에러
 * user.settings가 undefined일 때 크래시 발생
 */
router.get('/user/:id', async (req: Request, res: Response) => {
  const users: User[] = [
    { id: 1, name: 'User1', email: 'user1@test.com' },
    { id: 2, name: 'User2', email: 'user2@test.com', settings: { notifications: true, theme: 'dark' } }
  ];

  const userId = parseInt(req.params.id);
  const user = users.find(u => u.id === userId);

  // 🔴 치명적 버그: user가 undefined일 수 있음
  // 🔴 치명적 버그: settings가 undefined일 수 있음
  const notifications = user.settings.notifications;

  res.json({
    success: true,
    data: {
      name: user.name,
      notifications
    }
  });
});

/**
 * 🐛 버그 2: 무한 루프 위험
 * count가 증가하지 않으면 무한 루프
 */
router.post('/process-items', async (req: Request, res: Response<ApiResponse>) => {
  const items = req.body.items || [];
  const results = [];

  let count = 0;
  // 🔴 치명적 버그: count++가 조건문 안에 있어서 특정 케이스에서 무한 루프
  while (count < items.length) {
    const item = items[count];

    if (item.type === 'skip') {
      // count++를 하지 않음!
      continue;
    }

    results.push({ processed: item });
    count++;
  }

  res.json({
    success: true,
    data: { results }
  });
});

/**
 * 🐛 버그 3: 배열 인덱스 오버플로우
 * 배열 범위 체크 없이 접근
 */
router.get('/data/:index', (req: Request, res: Response) => {
  const data = ['item1', 'item2', 'item3'];
  const index = parseInt(req.params.index);

  // 🔴 치명적 버그: 인덱스 범위 체크 없음
  // index가 음수이거나 배열 길이보다 크면 undefined 반환
  const item = data[index];

  // 🔴 치명적 버그: undefined에 대한 메서드 호출 시도
  const uppercased = item.toUpperCase();

  res.json({
    success: true,
    data: uppercased
  });
});

/**
 * 🐛 버그 4: Promise 에러 처리 누락
 * async 작업에서 에러 발생 시 서버 크래시
 */
router.post('/analyze', async (req: Request, res: Response<ApiResponse>) => {
  const { code } = req.body;

  // 🔴 치명적 버그: try-catch 없음
  // API 호출 실패 시 unhandled promise rejection
  const result = await fetch('http://invalid-api-endpoint.com/analyze', {
    method: 'POST',
    body: JSON.stringify({ code }),
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await result.json();

  res.json({
    success: true,
    data
  });
});

/**
 * 🐛 버그 5: 타입 불일치로 인한 런타임 에러
 * 숫자 연산을 문자열에 수행
 */
router.post('/calculate', (req: Request, res: Response) => {
  const { numbers } = req.body;

  // 🔴 치명적 버그: numbers가 배열이 아닐 수 있음
  // 🔴 치명적 버그: 배열 요소가 숫자가 아닐 수 있음
  const total = numbers.reduce((sum: number, num: any) => sum + num, 0);

  res.json({
    success: true,
    data: { total }
  });
});

/**
 * 🐛 버그 6: 메모리 누수
 * 이벤트 리스너가 제거되지 않음
 */
let globalListeners: Array<() => void> = [];

router.post('/subscribe', (req: Request, res: Response) => {
  const { userId } = req.body;

  // 🔴 치명적 버그: 리스너가 계속 쌓임, 제거 안 됨
  const listener = () => {
    console.log(`Notification for user ${userId}`);
  };

  globalListeners.push(listener);
  // 리스너 제거 메커니즘 없음!

  res.json({
    success: true,
    message: 'Subscribed'
  });
});

/**
 * 🐛 버그 7: 재귀 호출 스택 오버플로우
 * 종료 조건이 잘못됨
 */
function processRecursively(data: any, depth: number): any {
  // 🔴 치명적 버그: depth > 1000 대신 depth < 1000
  // 거의 항상 재귀 호출 → 스택 오버플로우
  if (depth < 1000) {
    return processRecursively(data, depth + 1);
  }

  return data;
}

router.post('/recursive-process', (req: Request, res: Response) => {
  const { data } = req.body;

  const result = processRecursively(data, 0);

  res.json({
    success: true,
    data: result
  });
});

/**
 * 🐛 버그 8: Race Condition
 * 비동기 카운터 업데이트
 */
let requestCount = 0;

router.get('/stats', async (req: Request, res: Response) => {
  // 🔴 치명적 버그: 비동기 환경에서 동기화 없는 카운터 증가
  // 동시 요청 시 정확하지 않은 카운트
  const currentCount = requestCount;

  await new Promise(resolve => setTimeout(resolve, 100));

  requestCount = currentCount + 1;

  res.json({
    success: true,
    count: requestCount
  });
});
