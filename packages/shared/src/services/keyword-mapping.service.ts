/**
 * 키워드 매핑 및 의미적 유사성 계산 서비스
 * 자연어 검색의 정밀도를 높이기 위한 키워드 확장과 매핑 기능
 */

export interface KeywordMapping {
  keyword: string;
  domain: string;
  weight: number;
  synonyms: string[];
  relatedTerms: string[];
  language: 'ko' | 'en' | 'mixed';
}

export interface SearchQueryExpansion {
  originalQuery: string;
  expandedKeywords: KeywordMapping[];
  synonyms: string[];
  relatedConcepts: string[];
  domainWeights: { [domain: string]: number };
}

export interface KeywordSimilarity {
  keyword1: string;
  keyword2: string;
  similarity: number;
  type: 'semantic' | 'syntactic' | 'domain' | 'synonym';
}

export class KeywordMappingService {
  private keywordDatabase = new Map<string, KeywordMapping>();
  private similarityCache = new Map<string, number>();

  constructor() {
    this.initializeKeywordDatabase();
  }

  /**
   * 키워드 데이터베이스 초기화
   */
  private initializeKeywordDatabase(): void {
    const mappings: KeywordMapping[] = [
      // 인증 도메인
      {
        keyword: 'login',
        domain: 'authentication',
        weight: 1.0,
        synonyms: ['signin', '로그인', '로그인하기', '인증', 'authenticate'],
        relatedTerms: ['password', 'token', 'session', '비밀번호', '세션'],
        language: 'mixed'
      },
      {
        keyword: '인증',
        domain: 'authentication',
        weight: 1.0,
        synonyms: ['authentication', 'auth', '로그인', '확인'],
        relatedTerms: ['토큰', '세션', '보안', 'security', 'verify'],
        language: 'ko'
      },
      {
        keyword: 'password',
        domain: 'authentication',
        weight: 0.9,
        synonyms: ['비밀번호', 'passwd', 'pwd', 'credential'],
        relatedTerms: ['hash', 'encrypt', '암호화', 'security'],
        language: 'mixed'
      },

      // 사용자 도메인
      {
        keyword: 'user',
        domain: 'user',
        weight: 1.0,
        synonyms: ['사용자', '유저', 'member', 'client', 'customer'],
        relatedTerms: ['profile', 'account', '프로필', '계정'],
        language: 'mixed'
      },
      {
        keyword: '사용자',
        domain: 'user',
        weight: 1.0,
        synonyms: ['user', '유저', '회원', 'member'],
        relatedTerms: ['계정', '프로필', 'profile', 'account'],
        language: 'ko'
      },
      {
        keyword: 'profile',
        domain: 'user',
        weight: 0.8,
        synonyms: ['프로필', '프로파일', 'info', 'information'],
        relatedTerms: ['user', 'account', '사용자', '계정'],
        language: 'mixed'
      },

      // 결제 도메인
      {
        keyword: 'payment',
        domain: 'payment',
        weight: 1.0,
        synonyms: ['결제', '지불', 'pay', 'billing', '청구'],
        relatedTerms: ['transaction', 'money', 'price', '거래', '금액'],
        language: 'mixed'
      },
      {
        keyword: '결제',
        domain: 'payment',
        weight: 1.0,
        synonyms: ['payment', '지불', '납부', 'billing'],
        relatedTerms: ['거래', '금액', 'transaction', 'money'],
        language: 'ko'
      },
      {
        keyword: 'transaction',
        domain: 'payment',
        weight: 0.9,
        synonyms: ['거래', '트랜잭션', 'trade', 'deal'],
        relatedTerms: ['payment', 'money', '결제', '금액'],
        language: 'mixed'
      },

      // 데이터베이스 도메인
      {
        keyword: 'database',
        domain: 'database',
        weight: 1.0,
        synonyms: ['db', '데이터베이스', 'storage', '저장소'],
        relatedTerms: ['query', 'table', 'schema', '쿼리', '테이블'],
        language: 'mixed'
      },
      {
        keyword: 'query',
        domain: 'database',
        weight: 0.9,
        synonyms: ['쿼리', 'search', '검색', 'select'],
        relatedTerms: ['database', 'sql', 'find', '데이터베이스'],
        language: 'mixed'
      },
      {
        keyword: '데이터',
        domain: 'database',
        weight: 0.8,
        synonyms: ['data', 'information', '정보', 'record'],
        relatedTerms: ['database', 'storage', '저장', 'save'],
        language: 'ko'
      },

      // API 도메인
      {
        keyword: 'api',
        domain: 'api',
        weight: 1.0,
        synonyms: ['interface', '인터페이스', 'endpoint', '엔드포인트'],
        relatedTerms: ['rest', 'http', 'service', '서비스'],
        language: 'mixed'
      },
      {
        keyword: 'service',
        domain: 'api',
        weight: 0.9,
        synonyms: ['서비스', 'handler', 'provider', '핸들러'],
        relatedTerms: ['api', 'business', 'logic', '로직'],
        language: 'mixed'
      },
      {
        keyword: 'controller',
        domain: 'api',
        weight: 0.8,
        synonyms: ['컨트롤러', 'handler', 'router', '라우터'],
        relatedTerms: ['api', 'service', 'endpoint', '엔드포인트'],
        language: 'mixed'
      },

      // 검증 도메인
      {
        keyword: 'validate',
        domain: 'validation',
        weight: 1.0,
        synonyms: ['검증', '유효성검사', 'check', 'verify', '확인'],
        relatedTerms: ['input', 'sanitize', 'clean', '입력'],
        language: 'mixed'
      },
      {
        keyword: '검증',
        domain: 'validation',
        weight: 1.0,
        synonyms: ['validation', 'check', '확인', 'verify'],
        relatedTerms: ['유효성', 'valid', 'invalid', '검사'],
        language: 'ko'
      },

      // 오류 처리 도메인
      {
        keyword: 'error',
        domain: 'error',
        weight: 1.0,
        synonyms: ['에러', '오류', 'exception', '예외', 'fail'],
        relatedTerms: ['handle', 'catch', 'throw', '처리'],
        language: 'mixed'
      },
      {
        keyword: '에러',
        domain: 'error',
        weight: 1.0,
        synonyms: ['error', '오류', 'exception', '예외'],
        relatedTerms: ['핸들링', 'handle', 'catch', '처리'],
        language: 'ko'
      },

      // 유틸리티 도메인
      {
        keyword: 'util',
        domain: 'utility',
        weight: 0.8,
        synonyms: ['utility', '유틸리티', 'helper', '헬퍼', 'tool'],
        relatedTerms: ['common', 'shared', '공통', '공유'],
        language: 'mixed'
      },
      {
        keyword: 'helper',
        domain: 'utility',
        weight: 0.8,
        synonyms: ['헬퍼', 'util', 'utility', 'assist', '보조'],
        relatedTerms: ['function', 'tool', '함수', '도구'],
        language: 'mixed'
      }
    ];

    // 키워드 데이터베이스에 저장
    mappings.forEach(mapping => {
      this.keywordDatabase.set(mapping.keyword.toLowerCase(), mapping);

      // 동의어들도 동일한 매핑으로 등록
      mapping.synonyms.forEach(synonym => {
        if (!this.keywordDatabase.has(synonym.toLowerCase())) {
          this.keywordDatabase.set(synonym.toLowerCase(), {
            ...mapping,
            keyword: synonym
          });
        }
      });
    });
  }

  /**
   * 검색 쿼리 확장
   */
  expandSearchQuery(query: string): SearchQueryExpansion {
    const originalQuery = query.trim();
    const queryTerms = this.tokenizeQuery(originalQuery);

    const expandedKeywords: KeywordMapping[] = [];
    const synonyms = new Set<string>();
    const relatedConcepts = new Set<string>();
    const domainWeights: { [domain: string]: number } = {};

    // 각 쿼리 용어에 대해 확장
    for (const term of queryTerms) {
      const lowerTerm = term.toLowerCase();
      const mapping = this.keywordDatabase.get(lowerTerm);

      if (mapping) {
        expandedKeywords.push(mapping);

        // 동의어 추가
        mapping.synonyms.forEach(synonym => synonyms.add(synonym));

        // 관련 용어 추가
        mapping.relatedTerms.forEach(related => relatedConcepts.add(related));

        // 도메인 가중치 계산
        domainWeights[mapping.domain] = (domainWeights[mapping.domain] || 0) + mapping.weight;
      } else {
        // 매핑에 없는 용어는 유사한 키워드 찾기
        const similarKeywords = this.findSimilarKeywords(lowerTerm, 0.7);
        expandedKeywords.push(...similarKeywords);
      }
    }

    // 컨텍스트 기반 추가 확장
    const contextualTerms = this.getContextualTerms(expandedKeywords);
    contextualTerms.forEach(term => relatedConcepts.add(term));

    return {
      originalQuery,
      expandedKeywords,
      synonyms: Array.from(synonyms),
      relatedConcepts: Array.from(relatedConcepts),
      domainWeights
    };
  }

  /**
   * 유사한 키워드 찾기
   */
  findSimilarKeywords(term: string, threshold: number = 0.5): KeywordMapping[] {
    const similar: KeywordMapping[] = [];

    for (const [keyword, mapping] of this.keywordDatabase) {
      const similarity = this.calculateSimilarity(term, keyword);

      if (similarity >= threshold) {
        similar.push({
          ...mapping,
          weight: mapping.weight * similarity // 유사도로 가중치 조정
        });
      }
    }

    // 유사도가 높은 순으로 정렬
    return similar.sort((a, b) => b.weight - a.weight).slice(0, 5);
  }

  /**
   * 키워드 간 유사도 계산
   */
  calculateSimilarity(keyword1: string, keyword2: string): number {
    const cacheKey = `${keyword1}:${keyword2}`;

    if (this.similarityCache.has(cacheKey)) {
      return this.similarityCache.get(cacheKey)!;
    }

    let similarity = 0;

    // 1. 정확한 일치
    if (keyword1 === keyword2) {
      similarity = 1.0;
    }
    // 2. 하나가 다른 하나를 포함
    else if (keyword1.includes(keyword2) || keyword2.includes(keyword1)) {
      similarity = 0.8;
    }
    // 3. 레벤슈타인 거리 기반 유사도
    else {
      similarity = this.calculateLevenshteinSimilarity(keyword1, keyword2);
    }

    // 4. 의미적 유사도 (도메인 기반)
    const semanticSimilarity = this.calculateSemanticSimilarity(keyword1, keyword2);
    similarity = Math.max(similarity, semanticSimilarity);

    this.similarityCache.set(cacheKey, similarity);
    return similarity;
  }

  /**
   * 레벤슈타인 거리 기반 유사도
   */
  private calculateLevenshteinSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * 레벤슈타인 거리 계산
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * 의미적 유사도 계산 (도메인 기반)
   */
  private calculateSemanticSimilarity(keyword1: string, keyword2: string): number {
    const mapping1 = this.keywordDatabase.get(keyword1);
    const mapping2 = this.keywordDatabase.get(keyword2);

    if (!mapping1 || !mapping2) return 0;

    // 같은 도메인인 경우 높은 유사도
    if (mapping1.domain === mapping2.domain) {
      return 0.7;
    }

    // 관련 용어에 포함된 경우
    if (mapping1.relatedTerms.includes(keyword2) ||
        mapping2.relatedTerms.includes(keyword1)) {
      return 0.6;
    }

    // 동의어 관계인 경우
    if (mapping1.synonyms.includes(keyword2) ||
        mapping2.synonyms.includes(keyword1)) {
      return 0.9;
    }

    return 0;
  }

  /**
   * 쿼리 토큰화
   */
  private tokenizeQuery(query: string): string[] {
    // 한국어와 영어 혼합 텍스트 처리
    return query
      .toLowerCase()
      .replace(/[^\w\s가-힣]/g, ' ') // 특수문자 제거
      .split(/\s+/)
      .filter(term => term.length > 0);
  }

  /**
   * 컨텍스트 기반 추가 용어 생성
   */
  private getContextualTerms(expandedKeywords: KeywordMapping[]): string[] {
    const contextualTerms = new Set<string>();
    const domains = [...new Set(expandedKeywords.map(k => k.domain))];

    // 도메인별로 관련 용어 추가
    domains.forEach(domain => {
      const domainKeywords = Array.from(this.keywordDatabase.values())
        .filter(mapping => mapping.domain === domain)
        .slice(0, 3); // 도메인당 최대 3개

      domainKeywords.forEach(mapping => {
        mapping.relatedTerms.forEach(term => contextualTerms.add(term));
      });
    });

    return Array.from(contextualTerms);
  }

  /**
   * 키워드 추가
   */
  addKeyword(mapping: KeywordMapping): void {
    this.keywordDatabase.set(mapping.keyword.toLowerCase(), mapping);

    // 동의어들도 추가
    mapping.synonyms.forEach(synonym => {
      if (!this.keywordDatabase.has(synonym.toLowerCase())) {
        this.keywordDatabase.set(synonym.toLowerCase(), {
          ...mapping,
          keyword: synonym
        });
      }
    });

    // 캐시 무효화
    this.similarityCache.clear();
  }

  /**
   * 도메인별 키워드 조회
   */
  getKeywordsByDomain(domain: string): KeywordMapping[] {
    return Array.from(this.keywordDatabase.values())
      .filter(mapping => mapping.domain === domain);
  }

  /**
   * 키워드 통계
   */
  getKeywordStats(): {
    totalKeywords: number;
    domainCounts: { [domain: string]: number };
    languageCounts: { [language: string]: number };
  } {
    const domainCounts: { [domain: string]: number } = {};
    const languageCounts: { [language: string]: number } = {};

    Array.from(this.keywordDatabase.values()).forEach(mapping => {
      domainCounts[mapping.domain] = (domainCounts[mapping.domain] || 0) + 1;
      languageCounts[mapping.language] = (languageCounts[mapping.language] || 0) + 1;
    });

    return {
      totalKeywords: this.keywordDatabase.size,
      domainCounts,
      languageCounts
    };
  }

  /**
   * 캐시 클리어
   */
  clearCache(): void {
    this.similarityCache.clear();
  }
}