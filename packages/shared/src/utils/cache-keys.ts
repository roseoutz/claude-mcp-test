/**
 * 캐시 키 관리 유틸리티
 */
export class CacheKeys {
  /**
   * 임베딩 캐시 키 생성
   */
  static embedding(text: string): string {
    // 텍스트의 해시를 사용하여 키 생성
    const hash = this.simpleHash(text);
    return `embedding:${hash}`;
  }

  /**
   * 코드 분석 캐시 키 생성
   */
  static codeAnalysis(code: string, language: string): string {
    const hash = this.simpleHash(code + language);
    return `analysis:${hash}`;
  }

  /**
   * 보안 분석 캐시 키 생성
   */
  static securityAnalysis(code: string): string {
    const hash = this.simpleHash(code);
    return `security:${hash}`;
  }

  /**
   * 코드 설명 캐시 키 생성
   */
  static codeExplanation(code: string, context?: string): string {
    const hash = this.simpleHash(code + (context || ''));
    return `explanation:${hash}`;
  }

  /**
   * 개선 제안 캐시 키 생성
   */
  static improvements(analysis: any): string {
    const hash = this.simpleHash(JSON.stringify(analysis));
    return `improvements:${hash}`;
  }

  /**
   * 간단한 해시 함수 (개발용)
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}