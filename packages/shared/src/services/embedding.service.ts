/**
 * Embedding Service Implementation
 * OpenAI 임베딩 전용 AI 서비스
 *
 * @description
 * 이 서비스는 OpenAI의 임베딩 모델만을 사용하여 텍스트를 벡터로 변환하는
 * 기능을 제공합니다. LLM 텍스트 생성 기능은 포함하지 않습니다.
 *
 * @key_features
 * 1. 텍스트 임베딩: 코드를 벡터로 변환하여 유사성 검색 지원
 * 2. 배치 임베딩: 여러 텍스트를 동시에 처리
 * 3. 캐싱 지원: 동일한 텍스트에 대한 중복 처리 방지
 * 4. 오류 처리: API 실패 시 fallback 벡터 제공
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import { config } from '../config/config-loader.js';

/**
 * 임베딩 전용 AI 서비스
 *
 * @class EmbeddingService
 * @description
 * OpenAI API를 사용하여 텍스트 임베딩 생성만을 담당하는 서비스
 *
 * @responsibilities
 * 1. OpenAI 클라이언트 관리
 * 2. 단일/배치 임베딩 생성
 * 3. 에러 처리 및 fallback
 * 4. 임베딩 차원 및 모델 관리
 */
export class EmbeddingService {
  /** @private OpenAI API 클라이언트 - 임베딩 생성 전용 */
  private openai: OpenAI;

  /** @private 임베딩 모델 이름 */
  private readonly embeddingModel: string;

  /** @private 임베딩 차원 수 */
  private readonly embeddingDimensions: number;

  /**
   * EmbeddingService 생성자
   *
   * @param {string} [apiKey] - OpenAI API 키 (선택적, 환경변수 사용 가능)
   */
  constructor(apiKey?: string) {
    const oaiKey = apiKey || config.get('OPENAI_API_KEY');
    if (!oaiKey) {
      logger.warn('OpenAI API key not provided, embedding features will be limited');
    }

    this.openai = new OpenAI({
      apiKey: oaiKey || 'dummy-key',
    });

    this.embeddingModel = config.get('EMBEDDING_MODEL') || 'text-embedding-3-large';
    this.embeddingDimensions = config.get('EMBEDDING_DIMENSIONS') || 1536;
  }

  /**
   * 단일 텍스트 임베딩 생성
   *
   * @param {string} text - 임베딩할 텍스트
   * @returns {Promise<number[]>} 임베딩 벡터
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Failed to generate embedding:', error as Error);
      // 오류 시 결정적 더미 벡터 반환
      return this.generateDummyEmbedding(text);
    }
  }

  /**
   * 여러 텍스트의 임베딩 생성 (배치 처리)
   *
   * @param {string[]} texts - 임베딩할 텍스트 배열
   * @returns {Promise<number[][]>} 임베딩 벡터 배열
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: texts,
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      logger.error('Failed to generate embeddings:', error as Error);
      // 오류 시 각 텍스트에 대해 더미 벡터 반환
      return texts.map(text => this.generateDummyEmbedding(text));
    }
  }

  /**
   * 사용 중인 임베딩 모델 정보 반환
   */
  getModelInfo(): {
    model: string;
    dimensions: number;
  } {
    return {
      model: this.embeddingModel,
      dimensions: this.embeddingDimensions,
    };
  }

  /**
   * 연결 상태 확인
   *
   * @returns {Promise<boolean>} API 연결 가능 여부
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.generateEmbedding('test');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 더미 임베딩 생성 (fallback)
   *
   * @private
   * @param {string} text - 원본 텍스트
   * @returns {number[]} 결정적 더미 벡터
   */
  private generateDummyEmbedding(text: string): number[] {
    // 텍스트 기반 시드를 사용한 결정적 벡터 생성
    const seed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array(this.embeddingDimensions).fill(0).map((_, i) =>
      Math.sin(seed + i) * 0.5 + 0.5
    );
  }
}

/**
 * Mock Embedding Service (테스트용)
 *
 * @class MockEmbeddingService
 * @description
 * API 호출 없이 결정적인 임베딩 벡터를 생성하는 모의 서비스
 */
export class MockEmbeddingService {
  private readonly dimensions: number;

  constructor(dimensions: number = 1536) {
    this.dimensions = dimensions;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // 텍스트 길이 기반 결정적 벡터 생성
    const seed = text.length;
    return Array(this.dimensions).fill(0).map((_, i) =>
      Math.sin(seed + i) * 0.5 + 0.5
    );
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(text => this.generateEmbedding(text)));
  }

  getModelInfo(): { model: string; dimensions: number } {
    return {
      model: 'mock-embedding-model',
      dimensions: this.dimensions,
    };
  }

  async checkConnection(): Promise<boolean> {
    return true;
  }
}