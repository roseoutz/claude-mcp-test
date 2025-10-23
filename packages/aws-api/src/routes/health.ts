import { Router, Request, Response } from 'express';

export const router = Router();

// 🔴 치명적 버그: 전역 변수를 여러 요청에서 공유
// Race condition 발생 가능
let lastCheckTime: Date;

router.get('/', (req: Request, res: Response) => {
  // 🔴 치명적 버그: 첫 요청 시 lastCheckTime이 undefined
  // getTime() 호출 시 크래시
  const uptime = Date.now() - lastCheckTime.getTime();

  lastCheckTime = new Date();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'aws-api',
    uptime, // 🔴 첫 번째 요청에서는 에러 발생
  });
});