/**
 * 캐시 데코레이터
 */
import { logger } from '../utils/logger.js';

/**
 * 메서드 결과를 캐시하는 데코레이터
 * @param keyGenerator 캐시 키를 생성하는 함수
 * @param ttl 캐시 TTL (초)
 */
export function Cacheable<T extends any[], R>(
  keyGenerator: (...args: T) => string,
  ttl: number = 3600
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const cache = new Map<string, { value: R; expiresAt: number }>();

    descriptor.value = async function (...args: T): Promise<R> {
      const cacheKey = keyGenerator(...args);
      const now = Date.now();

      // 캐시에서 값 확인
      const cached = cache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        logger.debug(`Cache hit for key: ${cacheKey}`);
        return cached.value;
      }

      // 캐시 미스 - 원본 메서드 실행
      logger.debug(`Cache miss for key: ${cacheKey}`);
      const result = await originalMethod.apply(this, args);

      // 결과를 캐시에 저장
      const expiresAt = now + (ttl * 1000);
      cache.set(cacheKey, { value: result, expiresAt });

      // 만료된 캐시 정리 (간단한 구현)
      (this as any).cleanupExpiredCache?.(cache, now);

      return result;
    };

    // 캐시 정리 메서드 추가
    if (!target.cleanupExpiredCache) {
      target.cleanupExpiredCache = function (
        cache: Map<string, any>,
        now: number
      ) {
        for (const [key, entry] of cache.entries()) {
          if (entry.expiresAt <= now) {
            cache.delete(key);
          }
        }
      };
    }

    return descriptor;
  };
}

/**
 * 캐시를 지우는 데코레이터
 * @param keyPattern 지울 캐시 키 패턴
 */
export function CacheEvict(keyPattern?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]): Promise<any> {
      const result = await originalMethod.apply(this, args);
      
      // 여기서는 간단한 로깅만 수행
      // 실제 구현에서는 캐시 시스템과 연동 필요
      logger.debug(`Cache eviction requested for pattern: ${keyPattern || 'all'}`);
      
      return result;
    };

    return descriptor;
  };
}