# Task 06: Redis Cache 구현

## 목표
Redis를 활용한 캐싱 서비스 구현

## 작업 내용

### 1. Redis 클라이언트 서비스 (`src/services/cache.service.ts`)
```typescript
import { createClient, RedisClientType } from 'redis';
import { ICacheService } from '../types/services.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/config-loader.js';

export class RedisCacheService implements ICacheService {
  private client: RedisClientType;
  private connected: boolean = false;
  private readonly defaultTTL: number;
  private readonly namespace: string;

  constructor() {
    this.defaultTTL = config.get('CACHE_TTL');
    this.namespace = config.get('CACHE_NAMESPACE');
    
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis: Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('error', (err) => {
      logger.error('Redis Client Error:', err);
      this.connected = false;
    });

    this.client.on('connect', () => {
      logger.info('Redis Client Connected');
      this.connected = true;
    });

    this.client.on('ready', () => {
      logger.info('Redis Client Ready');
      this.connected = true;
    });

    this.client.on('reconnecting', () => {
      logger.warn('Redis Client Reconnecting...');
      this.connected = false;
    });
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      try {
        await this.client.connect();
        this.connected = true;
      } catch (error) {
        logger.error('Failed to connect to Redis:', error);
        throw error;
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.quit();
      this.connected = false;
    }
  }

  private getKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.connected) await this.connect();

    try {
      const fullKey = this.getKey(key);
      const value = await this.client.get(fullKey);
      
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Failed to get cache key ${key}:`, error);
      return null;
    }
  }

  async set<T>(
    key: string, 
    value: T, 
    ttl?: number
  ): Promise<void> {
    if (!this.connected) await this.connect();

    try {
      const fullKey = this.getKey(key);
      const serialized = JSON.stringify(value);
      const expiry = ttl || this.defaultTTL;

      if (expiry > 0) {
        await this.client.setEx(fullKey, expiry, serialized);
      } else {
        await this.client.set(fullKey, serialized);
      }

      logger.debug(`Cached key: ${key} with TTL: ${expiry}s`);
    } catch (error) {
      logger.error(`Failed to set cache key ${key}:`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.connected) await this.connect();

    try {
      const fullKey = this.getKey(key);
      await this.client.del(fullKey);
      logger.debug(`Deleted cache key: ${key}`);
    } catch (error) {
      logger.error(`Failed to delete cache key ${key}:`, error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    if (!this.connected) await this.connect();

    try {
      const pattern = `${this.namespace}:*`;
      const keys = await this.client.keys(pattern);
      
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.info(`Cleared ${keys.length} cache entries`);
      }
    } catch (error) {
      logger.error('Failed to clear cache:', error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.connected) await this.connect();

    try {
      const fullKey = this.getKey(key);
      const exists = await this.client.exists(fullKey);
      return exists === 1;
    } catch (error) {
      logger.error(`Failed to check cache key ${key}:`, error);
      return false;
    }
  }

  async getTTL(key: string): Promise<number> {
    if (!this.connected) await this.connect();

    try {
      const fullKey = this.getKey(key);
      const ttl = await this.client.ttl(fullKey);
      return ttl;
    } catch (error) {
      logger.error(`Failed to get TTL for key ${key}:`, error);
      return -1;
    }
  }

  async setMultiple(
    items: Array<{ key: string; value: any; ttl?: number }>
  ): Promise<void> {
    if (!this.connected) await this.connect();

    const pipeline = this.client.multi();

    for (const item of items) {
      const fullKey = this.getKey(item.key);
      const serialized = JSON.stringify(item.value);
      const expiry = item.ttl || this.defaultTTL;

      if (expiry > 0) {
        pipeline.setEx(fullKey, expiry, serialized);
      } else {
        pipeline.set(fullKey, serialized);
      }
    }

    try {
      await pipeline.exec();
      logger.debug(`Cached ${items.length} items in batch`);
    } catch (error) {
      logger.error('Failed to set multiple cache keys:', error);
      throw error;
    }
  }

  async getMultiple<T>(keys: string[]): Promise<Map<string, T | null>> {
    if (!this.connected) await this.connect();

    const result = new Map<string, T | null>();
    
    if (keys.length === 0) {
      return result;
    }

    try {
      const fullKeys = keys.map(key => this.getKey(key));
      const values = await this.client.mGet(fullKeys);

      keys.forEach((key, index) => {
        const value = values[index];
        if (value) {
          try {
            result.set(key, JSON.parse(value) as T);
          } catch {
            result.set(key, null);
          }
        } else {
          result.set(key, null);
        }
      });

      return result;
    } catch (error) {
      logger.error('Failed to get multiple cache keys:', error);
      return result;
    }
  }
}

/**
 * 인메모리 캐시 서비스 (개발/테스트용)
 */
export class InMemoryCacheService implements ICacheService {
  private cache = new Map<string, {
    value: any;
    expires?: number;
  }>();

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    if (item.expires && Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    return item.value as T;
  }

  async set<T>(
    key: string, 
    value: T, 
    ttl?: number
  ): Promise<void> {
    const expires = ttl ? Date.now() + (ttl * 1000) : undefined;
    this.cache.set(key, { value, expires });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async exists(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async getTTL(key: string): Promise<number> {
    const item = this.cache.get(key);
    if (!item || !item.expires) {
      return -1;
    }
    
    const remaining = Math.floor((item.expires - Date.now()) / 1000);
    return remaining > 0 ? remaining : -1;
  }
}
```

### 2. 캐시 키 생성 유틸리티 (`src/utils/cache-keys.ts`)
```typescript
import crypto from 'crypto';

/**
 * 캐시 키 생성기
 */
export class CacheKeyBuilder {
  private parts: string[] = [];

  static create(): CacheKeyBuilder {
    return new CacheKeyBuilder();
  }

  add(part: string | number): CacheKeyBuilder {
    this.parts.push(String(part));
    return this;
  }

  addHash(data: any): CacheKeyBuilder {
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(data))
      .digest('hex')
      .substring(0, 8);
    this.parts.push(hash);
    return this;
  }

  build(): string {
    return this.parts.join(':');
  }
}

/**
 * 표준 캐시 키 생성
 */
export const CacheKeys = {
  // 코드베이스 분석
  codebaseAnalysis: (repoPath: string, branch: string) =>
    CacheKeyBuilder.create()
      .add('analysis')
      .addHash(repoPath)
      .add(branch)
      .build(),

  // 파일 분석
  fileAnalysis: (filePath: string, hash: string) =>
    CacheKeyBuilder.create()
      .add('file')
      .addHash(filePath)
      .add(hash.substring(0, 8))
      .build(),

  // Git 정보
  gitInfo: (repoPath: string) =>
    CacheKeyBuilder.create()
      .add('git')
      .addHash(repoPath)
      .build(),

  // 브랜치 차이
  branchDiff: (repo: string, base: string, target: string) =>
    CacheKeyBuilder.create()
      .add('diff')
      .addHash(repo)
      .add(base)
      .add(target)
      .build(),

  // AI 임베딩
  embedding: (text: string) =>
    CacheKeyBuilder.create()
      .add('embed')
      .addHash(text)
      .build(),

  // 검색 결과
  searchResults: (query: string, limit: number) =>
    CacheKeyBuilder.create()
      .add('search')
      .addHash(query)
      .add(limit)
      .build(),
};
```

### 3. 캐시 데코레이터 (`src/decorators/cache.decorator.ts`)
```typescript
import { ICacheService } from '../types/services.js';
import { logger } from '../utils/logger.js';

/**
 * 메소드 결과를 캐시하는 데코레이터
 */
export function Cacheable(
  keyGenerator: (...args: any[]) => string,
  ttl?: number
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheService: ICacheService = (this as any).cacheService;
      
      if (!cacheService) {
        logger.warn('Cache service not available, executing without cache');
        return originalMethod.apply(this, args);
      }

      const cacheKey = keyGenerator(...args);
      
      // 캐시 확인
      const cached = await cacheService.get(cacheKey);
      if (cached !== null) {
        logger.debug(`Cache hit for key: ${cacheKey}`);
        return cached;
      }

      // 원본 메소드 실행
      logger.debug(`Cache miss for key: ${cacheKey}`);
      const result = await originalMethod.apply(this, args);

      // 결과 캐싱
      if (result !== undefined && result !== null) {
        await cacheService.set(cacheKey, result, ttl);
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * 캐시 무효화 데코레이터
 */
export function CacheInvalidate(
  keyGenerator: (...args: any[]) => string | string[]
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);
      
      const cacheService: ICacheService = (this as any).cacheService;
      if (cacheService) {
        const keys = keyGenerator(...args);
        const keysArray = Array.isArray(keys) ? keys : [keys];
        
        for (const key of keysArray) {
          await cacheService.delete(key);
          logger.debug(`Invalidated cache key: ${key}`);
        }
      }

      return result;
    };

    return descriptor;
  };
}
```

### 4. 테스트 작성 (`src/__tests__/services/cache.test.ts`)
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryCacheService } from '../../services/cache.service.js';
import { CacheKeys, CacheKeyBuilder } from '../../utils/cache-keys.js';

describe('CacheService', () => {
  let cacheService: InMemoryCacheService;

  beforeEach(() => {
    cacheService = new InMemoryCacheService();
  });

  describe('InMemoryCacheService', () => {
    it('should set and get values', async () => {
      await cacheService.set('test-key', { data: 'test' });
      const value = await cacheService.get<{ data: string }>('test-key');
      
      expect(value).toEqual({ data: 'test' });
    });

    it('should respect TTL', async () => {
      await cacheService.set('temp-key', 'value', 0.1); // 0.1초 TTL
      
      const immediate = await cacheService.get('temp-key');
      expect(immediate).toBe('value');

      // TTL 만료 대기
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const expired = await cacheService.get('temp-key');
      expect(expired).toBeNull();
    });

    it('should delete keys', async () => {
      await cacheService.set('delete-me', 'value');
      await cacheService.delete('delete-me');
      
      const value = await cacheService.get('delete-me');
      expect(value).toBeNull();
    });

    it('should clear all keys', async () => {
      await cacheService.set('key1', 'value1');
      await cacheService.set('key2', 'value2');
      await cacheService.clear();

      const value1 = await cacheService.get('key1');
      const value2 = await cacheService.get('key2');
      
      expect(value1).toBeNull();
      expect(value2).toBeNull();
    });

    it('should check key existence', async () => {
      await cacheService.set('exists', 'value');
      
      expect(await cacheService.exists('exists')).toBe(true);
      expect(await cacheService.exists('not-exists')).toBe(false);
    });
  });

  describe('CacheKeyBuilder', () => {
    it('should build cache keys', () => {
      const key = CacheKeyBuilder.create()
        .add('prefix')
        .add('middle')
        .add(123)
        .build();
      
      expect(key).toBe('prefix:middle:123');
    });

    it('should add hash', () => {
      const key = CacheKeyBuilder.create()
        .add('data')
        .addHash({ test: 'value' })
        .build();
      
      expect(key).toMatch(/^data:[a-f0-9]{8}$/);
    });
  });

  describe('CacheKeys', () => {
    it('should generate consistent keys', () => {
      const key1 = CacheKeys.codebaseAnalysis('/repo', 'main');
      const key2 = CacheKeys.codebaseAnalysis('/repo', 'main');
      
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different inputs', () => {
      const key1 = CacheKeys.fileAnalysis('file1.ts', 'hash1');
      const key2 = CacheKeys.fileAnalysis('file2.ts', 'hash2');
      
      expect(key1).not.toBe(key2);
    });
  });
});
```

### 5. Docker Compose 설정
```yaml
# docker-compose.yml에 추가
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - ./data/redis:/data
  command: redis-server --appendonly yes
```

## 체크리스트
- [ ] RedisCacheService 구현
- [ ] InMemoryCacheService 구현 (테스트용)
- [ ] 캐시 키 빌더 유틸리티
- [ ] 캐시 데코레이터 구현
- [ ] 단위 테스트 작성
- [ ] Docker Compose 설정

## 커밋 메시지
```
feat: Redis 캐시 서비스 구현

- Redis 클라이언트 통합
- 인메모리 캐시 (개발/테스트용)
- 캐시 키 빌더 및 데코레이터
- TTL 및 배치 작업 지원
```

## 예상 소요 시간
1시간 30분

## 의존성
- redis (Node.js 클라이언트)
- Docker (Redis 실행용)

## 검증 방법
- Redis 연결 테스트
- TTL 동작 확인
- 캐시 무효화 테스트
- 데코레이터 동작 확인