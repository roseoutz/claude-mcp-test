/**
 * Vector Utilities for ChromaDB Integration
 */

/**
 * 텍스트를 청크로 분할
 */
export function splitTextIntoChunks(
  text: string,
  maxChunkSize: number = 1000,
  overlap: number = 100
): string[] {
  if (!text || text.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    const lineWithNewline = currentChunk ? '\n' + line : line;
    
    if (currentChunk.length + lineWithNewline.length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        
        // 오버랩 처리 - 마지막 문자들을 다음 청크로 이어감
        const overlapText = currentChunk.slice(-Math.min(overlap, currentChunk.length));
        currentChunk = overlapText + lineWithNewline;
      } else {
        // 단일 라인이 maxChunkSize보다 큰 경우 강제로 분할
        if (line.length > maxChunkSize) {
          chunks.push(line.slice(0, maxChunkSize).trim());
          const remaining = line.slice(maxChunkSize - overlap);
          currentChunk = remaining;
        } else {
          currentChunk = line;
        }
      }
    } else {
      currentChunk += lineWithNewline;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(chunk => chunk.length > 0);
}

/**
 * 벡터 정규화 (단위 벡터로 변환)
 */
export function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(
    vector.reduce((sum, val) => sum + val * val, 0)
  );

  if (magnitude === 0 || !isFinite(magnitude)) {
    return new Array(vector.length).fill(0);
  }

  return vector.map(val => val / magnitude);
}

/**
 * 두 벡터 간 유사도 계산
 */
export function calculateSimilarity(
  vector1: number[],
  vector2: number[],
  method: 'cosine' | 'euclidean' | 'dot' = 'cosine'
): number {
  if (vector1.length !== vector2.length) {
    throw new Error(`Vectors must have the same dimension: ${vector1.length} vs ${vector2.length}`);
  }

  if (vector1.length === 0) {
    return 0;
  }

  switch (method) {
    case 'cosine': {
      return calculateCosineSimilarity(vector1, vector2);
    }

    case 'euclidean': {
      return calculateEuclideanSimilarity(vector1, vector2);
    }

    case 'dot': {
      return calculateDotProduct(vector1, vector2);
    }

    default:
      throw new Error(`Unknown similarity method: ${method}`);
  }
}

/**
 * 코사인 유사도 계산
 */
function calculateCosineSimilarity(vector1: number[], vector2: number[]): number {
  const dotProduct = vector1.reduce(
    (sum, val, i) => sum + val * vector2[i], 0
  );
  
  const magnitude1 = Math.sqrt(
    vector1.reduce((sum, val) => sum + val * val, 0)
  );
  
  const magnitude2 = Math.sqrt(
    vector2.reduce((sum, val) => sum + val * val, 0)
  );

  if (magnitude1 === 0 || magnitude2 === 0 || !isFinite(magnitude1) || !isFinite(magnitude2)) {
    return 0;
  }

  const similarity = dotProduct / (magnitude1 * magnitude2);
  return isFinite(similarity) ? Math.max(-1, Math.min(1, similarity)) : 0;
}

/**
 * 유클리드 거리를 유사도로 변환
 */
function calculateEuclideanSimilarity(vector1: number[], vector2: number[]): number {
  const distance = Math.sqrt(
    vector1.reduce(
      (sum, val, i) => sum + Math.pow(val - vector2[i], 2), 0
    )
  );

  if (!isFinite(distance)) {
    return 0;
  }

  // 거리를 유사도로 변환 (0에 가까울수록 유사함)
  return 1 / (1 + distance);
}

/**
 * 내적 계산
 */
function calculateDotProduct(vector1: number[], vector2: number[]): number {
  const dotProduct = vector1.reduce(
    (sum, val, i) => sum + val * vector2[i], 0
  );

  return isFinite(dotProduct) ? dotProduct : 0;
}

/**
 * 벡터의 크기(magnitude) 계산
 */
export function calculateMagnitude(vector: number[]): number {
  const magnitude = Math.sqrt(
    vector.reduce((sum, val) => sum + val * val, 0)
  );

  return isFinite(magnitude) ? magnitude : 0;
}

/**
 * 벡터가 유효한지 검사
 */
export function isValidVector(vector: number[]): boolean {
  if (!Array.isArray(vector) || vector.length === 0) {
    return false;
  }

  return vector.every(val => 
    typeof val === 'number' && 
    isFinite(val) && 
    !isNaN(val)
  );
}

/**
 * 벡터 평균 계산
 */
export function calculateVectorMean(vectors: number[][]): number[] {
  if (vectors.length === 0) {
    return [];
  }

  const dimension = vectors[0].length;
  const mean = new Array(dimension).fill(0);

  for (const vector of vectors) {
    if (vector.length !== dimension) {
      throw new Error('All vectors must have the same dimension');
    }

    for (let i = 0; i < dimension; i++) {
      mean[i] += vector[i];
    }
  }

  return mean.map(val => val / vectors.length);
}

/**
 * 벡터 간 거리 계산 (여러 메트릭 지원)
 */
export function calculateDistance(
  vector1: number[],
  vector2: number[],
  method: 'euclidean' | 'manhattan' | 'chebyshev' = 'euclidean'
): number {
  if (vector1.length !== vector2.length) {
    throw new Error(`Vectors must have the same dimension: ${vector1.length} vs ${vector2.length}`);
  }

  switch (method) {
    case 'euclidean': {
      return Math.sqrt(
        vector1.reduce(
          (sum, val, i) => sum + Math.pow(val - vector2[i], 2), 0
        )
      );
    }

    case 'manhattan': {
      return vector1.reduce(
        (sum, val, i) => sum + Math.abs(val - vector2[i]), 0
      );
    }

    case 'chebyshev': {
      return Math.max(
        ...vector1.map((val, i) => Math.abs(val - vector2[i]))
      );
    }

    default:
      throw new Error(`Unknown distance method: ${method}`);
  }
}

/**
 * 텍스트 전처리 (임베딩 전 정리)
 */
export function preprocessTextForEmbedding(text: string): string {
  if (!text) {
    return '';
  }

  return text
    // 불필요한 공백 제거
    .replace(/\s+/g, ' ')
    // 특수 문자 정리 (기본적인 것만)
    .replace(/[\r\n\t]/g, ' ')
    // 앞뒤 공백 제거
    .trim()
    // 연속된 문장 부호 정리
    .replace(/[.]{2,}/g, '...')
    .replace(/[!]{2,}/g, '!')
    .replace(/[?]{2,}/g, '?');
}

/**
 * 텍스트가 임베딩하기에 적합한지 검사
 */
export function isValidTextForEmbedding(text: string, minLength: number = 10, maxLength: number = 8000): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const cleanText = preprocessTextForEmbedding(text);
  return cleanText.length >= minLength && cleanText.length <= maxLength;
}

/**
 * 코드 텍스트 전용 전처리
 */
export function preprocessCodeForEmbedding(code: string): string {
  if (!code) {
    return '';
  }

  return code
    // 코멘트 제거는 하지 않음 (의미가 있을 수 있음)
    // 불필요한 공백만 정리
    .replace(/[ \t]+/g, ' ')
    // 빈 줄 여러 개를 하나로
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}