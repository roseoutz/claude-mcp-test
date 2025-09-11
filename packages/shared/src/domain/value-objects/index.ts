/**
 * Domain Value Objects
 * 불변성을 가진 도메인 값 객체
 */

/**
 * 파일 경로 값 객체
 */
export class FilePath {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('File path cannot be empty');
    }
    
    // Normalize path separators
    this._value = value.replace(/\\/g, '/');
  }

  get value(): string {
    return this._value;
  }

  get extension(): string {
    const parts = this._value.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  get filename(): string {
    const parts = this._value.split('/');
    return parts[parts.length - 1];
  }

  get directory(): string {
    const parts = this._value.split('/');
    parts.pop();
    return parts.join('/');
  }

  isRelative(): boolean {
    return !this._value.startsWith('/');
  }

  isAbsolute(): boolean {
    return this._value.startsWith('/');
  }

  equals(other: FilePath): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

/**
 * 언어 식별자 값 객체
 */
export class Language {
  private static readonly SUPPORTED_LANGUAGES = new Set([
    'javascript',
    'typescript',
    'python',
    'java',
    'csharp',
    'cpp',
    'c',
    'go',
    'rust',
    'ruby',
    'php',
    'swift',
    'kotlin',
    'scala',
    'haskell',
    'clojure',
    'elixir',
    'dart',
    'lua',
    'r',
    'julia',
    'shell',
    'sql',
    'html',
    'css',
    'scss',
    'yaml',
    'json',
    'xml',
    'markdown',
  ]);

  private static readonly EXTENSION_MAP: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'cs': 'csharp',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'c': 'c',
    'h': 'c',
    'hpp': 'cpp',
    'go': 'go',
    'rs': 'rust',
    'rb': 'ruby',
    'php': 'php',
    'swift': 'swift',
    'kt': 'kotlin',
    'kts': 'kotlin',
    'scala': 'scala',
    'hs': 'haskell',
    'clj': 'clojure',
    'cljs': 'clojure',
    'ex': 'elixir',
    'exs': 'elixir',
    'dart': 'dart',
    'lua': 'lua',
    'r': 'r',
    'R': 'r',
    'jl': 'julia',
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'sql': 'sql',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'scss',
    'yml': 'yaml',
    'yaml': 'yaml',
    'json': 'json',
    'xml': 'xml',
    'md': 'markdown',
    'mdx': 'markdown',
  };

  private readonly _value: string;

  constructor(value: string) {
    const normalized = value.toLowerCase();
    
    if (!Language.SUPPORTED_LANGUAGES.has(normalized)) {
      throw new Error(`Unsupported language: ${value}`);
    }
    
    this._value = normalized;
  }

  static fromExtension(extension: string): Language {
    const lang = Language.EXTENSION_MAP[extension.toLowerCase()];
    if (!lang) {
      throw new Error(`Unknown file extension: ${extension}`);
    }
    return new Language(lang);
  }

  static fromFilePath(filePath: string): Language {
    const parts = filePath.split('.');
    if (parts.length < 2) {
      throw new Error(`Cannot determine language from file path: ${filePath}`);
    }
    return Language.fromExtension(parts[parts.length - 1]);
  }

  get value(): string {
    return this._value;
  }

  get displayName(): string {
    return this._value.charAt(0).toUpperCase() + this._value.slice(1);
  }

  get isMarkup(): boolean {
    return ['html', 'xml', 'markdown'].includes(this._value);
  }

  get isStyle(): boolean {
    return ['css', 'scss'].includes(this._value);
  }

  get isData(): boolean {
    return ['json', 'yaml', 'xml'].includes(this._value);
  }

  get isProgramming(): boolean {
    return !this.isMarkup && !this.isStyle && !this.isData;
  }

  equals(other: Language): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

/**
 * 코드 복잡도 값 객체
 */
export class Complexity {
  private readonly _value: number;

  constructor(value: number) {
    if (value < 0) {
      throw new Error('Complexity cannot be negative');
    }
    this._value = Math.floor(value);
  }

  get value(): number {
    return this._value;
  }

  get level(): 'low' | 'medium' | 'high' | 'very-high' {
    if (this._value <= 5) return 'low';
    if (this._value <= 10) return 'medium';
    if (this._value <= 20) return 'high';
    return 'very-high';
  }

  get isSimple(): boolean {
    return this._value <= 5;
  }

  get isComplex(): boolean {
    return this._value > 10;
  }

  get isVeryComplex(): boolean {
    return this._value > 20;
  }

  add(other: Complexity): Complexity {
    return new Complexity(this._value + other._value);
  }

  equals(other: Complexity): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return `${this._value} (${this.level})`;
  }
}

/**
 * 관련도 점수 값 객체
 */
export class RelevanceScore {
  private readonly _value: number;

  constructor(value: number) {
    if (value < 0 || value > 1) {
      throw new Error('Relevance score must be between 0 and 1');
    }
    this._value = value;
  }

  get value(): number {
    return this._value;
  }

  get percentage(): number {
    return Math.round(this._value * 100);
  }

  get level(): 'none' | 'low' | 'medium' | 'high' | 'perfect' {
    if (this._value === 0) return 'none';
    if (this._value < 0.3) return 'low';
    if (this._value < 0.6) return 'medium';
    if (this._value < 0.9) return 'high';
    return 'perfect';
  }

  get isRelevant(): boolean {
    return this._value > 0.3;
  }

  get isHighlyRelevant(): boolean {
    return this._value > 0.7;
  }

  combine(other: RelevanceScore, weight: number = 0.5): RelevanceScore {
    const combined = this._value * weight + other._value * (1 - weight);
    return new RelevanceScore(combined);
  }

  equals(other: RelevanceScore): boolean {
    return Math.abs(this._value - other._value) < 0.001;
  }

  toString(): string {
    return `${this.percentage}% (${this.level})`;
  }
}

/**
 * 세션 ID 값 객체
 */
export class SessionId {
  private readonly _value: string;

  constructor(value?: string) {
    if (value) {
      if (value.length < 8) {
        throw new Error('Session ID must be at least 8 characters');
      }
      this._value = value;
    } else {
      this._value = SessionId.generate();
    }
  }

  private static generate(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `session_${timestamp}_${random}`;
  }

  get value(): string {
    return this._value;
  }

  get shortId(): string {
    return this._value.substring(0, 8);
  }

  equals(other: SessionId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

/**
 * 브랜치 이름 값 객체
 */
export class BranchName {
  private static readonly INVALID_CHARS = /[~^:?*\[\]\\]/;
  private static readonly RESERVED_NAMES = new Set([
    'HEAD',
    'FETCH_HEAD',
    'ORIG_HEAD',
    'MERGE_HEAD',
  ]);

  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('Branch name cannot be empty');
    }

    if (BranchName.INVALID_CHARS.test(value)) {
      throw new Error(`Branch name contains invalid characters: ${value}`);
    }

    if (BranchName.RESERVED_NAMES.has(value.toUpperCase())) {
      throw new Error(`Branch name is reserved: ${value}`);
    }

    if (value.startsWith('.') || value.endsWith('.')) {
      throw new Error('Branch name cannot start or end with a dot');
    }

    if (value.startsWith('/') || value.endsWith('/')) {
      throw new Error('Branch name cannot start or end with a slash');
    }

    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  get isMainBranch(): boolean {
    return ['main', 'master', 'develop', 'development'].includes(this._value);
  }

  get isFeatureBranch(): boolean {
    return this._value.startsWith('feature/') || this._value.startsWith('feat/');
  }

  get isBugfixBranch(): boolean {
    return this._value.startsWith('bugfix/') || this._value.startsWith('fix/');
  }

  get isHotfixBranch(): boolean {
    return this._value.startsWith('hotfix/');
  }

  get isReleaseBranch(): boolean {
    return this._value.startsWith('release/');
  }

  equals(other: BranchName): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

/**
 * 커밋 해시 값 객체
 */
export class CommitHash {
  private static readonly HASH_REGEX = /^[a-f0-9]{40}$/i;
  private static readonly SHORT_HASH_REGEX = /^[a-f0-9]{7,40}$/i;

  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('Commit hash cannot be empty');
    }

    const trimmed = value.trim().toLowerCase();

    if (trimmed.length === 40 && !CommitHash.HASH_REGEX.test(trimmed)) {
      throw new Error(`Invalid commit hash format: ${value}`);
    }

    if (trimmed.length < 40 && !CommitHash.SHORT_HASH_REGEX.test(trimmed)) {
      throw new Error(`Invalid short commit hash format: ${value}`);
    }

    this._value = trimmed;
  }

  get value(): string {
    return this._value;
  }

  get shortHash(): string {
    return this._value.substring(0, 7);
  }

  get isFullHash(): boolean {
    return this._value.length === 40;
  }

  equals(other: CommitHash): boolean {
    if (this.isFullHash && other.isFullHash) {
      return this._value === other._value;
    }
    
    // Compare short hashes
    const minLength = Math.min(this._value.length, other._value.length);
    return this._value.substring(0, minLength) === other._value.substring(0, minLength);
  }

  toString(): string {
    return this._value;
  }
}

/**
 * 시간 범위 값 객체
 */
export class TimeRange {
  private readonly _start: Date;
  private readonly _end: Date;

  constructor(start: Date, end: Date) {
    if (start >= end) {
      throw new Error('Start time must be before end time');
    }
    
    this._start = new Date(start);
    this._end = new Date(end);
  }

  get start(): Date {
    return new Date(this._start);
  }

  get end(): Date {
    return new Date(this._end);
  }

  get duration(): number {
    return this._end.getTime() - this._start.getTime();
  }

  get durationInSeconds(): number {
    return Math.floor(this.duration / 1000);
  }

  get durationInMinutes(): number {
    return Math.floor(this.duration / 60000);
  }

  get durationInHours(): number {
    return Math.floor(this.duration / 3600000);
  }

  contains(date: Date): boolean {
    return date >= this._start && date <= this._end;
  }

  overlaps(other: TimeRange): boolean {
    return this._start < other._end && this._end > other._start;
  }

  equals(other: TimeRange): boolean {
    return this._start.getTime() === other._start.getTime() &&
           this._end.getTime() === other._end.getTime();
  }

  toString(): string {
    return `${this._start.toISOString()} - ${this._end.toISOString()}`;
  }
}