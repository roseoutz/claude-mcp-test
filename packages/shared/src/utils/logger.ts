/**
 * Logger Implementation for MCP Server
 * Uses stderr to avoid interfering with MCP communication on stdout
 */

import { ILogger } from '../domain/ports/outbound/index.js';
import { config } from '../config/config-loader.js';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger implements ILogger {
  private level: LogLevel;
  private context?: string;

  constructor(level?: LogLevel, context?: string) {
    this.level = level ?? this.getLogLevelFromConfig();
    this.context = context;
  }

  private getLogLevelFromConfig(): LogLevel {
    const configLevel = config.get('LOG_LEVEL').toLowerCase();
    switch (configLevel) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    const contextStr = this.context ? ` [${this.context}]` : '';
    return `${timestamp} [${level}]${contextStr} ${message}`;
  }

  debug(message: string, context?: any): void {
    if (this.level <= LogLevel.DEBUG) {
      const formattedMessage = this.formatMessage('DEBUG', message);
      const contextStr = context ? ` ${JSON.stringify(context, null, 2)}` : '';
      console.error(formattedMessage + contextStr);
    }
  }

  info(message: string, context?: any): void {
    if (this.level <= LogLevel.INFO) {
      const formattedMessage = this.formatMessage('INFO', message);
      const contextStr = context ? ` ${JSON.stringify(context, null, 2)}` : '';
      console.error(formattedMessage + contextStr);
    }
  }

  warn(message: string, context?: any): void {
    if (this.level <= LogLevel.WARN) {
      const formattedMessage = this.formatMessage('WARN', message);
      const contextStr = context ? ` ${JSON.stringify(context, null, 2)}` : '';
      console.error(formattedMessage + contextStr);
    }
  }

  error(message: string, error?: Error, context?: any): void {
    if (this.level <= LogLevel.ERROR) {
      const formattedMessage = this.formatMessage('ERROR', message);
      let errorStr = '';
      
      if (error) {
        errorStr = `\n  Error: ${error.message}`;
        if (error.stack) {
          errorStr += `\n  Stack: ${error.stack}`;
        }
      }
      
      const contextStr = context ? `\n  Context: ${JSON.stringify(context, null, 2)}` : '';
      console.error(formattedMessage + errorStr + contextStr);
    }
  }

  setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    switch (level) {
      case 'debug':
        this.level = LogLevel.DEBUG;
        break;
      case 'info':
        this.level = LogLevel.INFO;
        break;
      case 'warn':
        this.level = LogLevel.WARN;
        break;
      case 'error':
        this.level = LogLevel.ERROR;
        break;
    }
  }

  /**
   * 새로운 컨텍스트로 로거 생성
   */
  withContext(context: string): Logger {
    return new Logger(this.level, context);
  }

  /**
   * 성능 측정을 위한 타이머 시작
   */
  startTimer(label: string): () => void {
    const start = process.hrtime.bigint();
    return () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
      this.debug(`Timer [${label}]: ${duration.toFixed(2)}ms`);
    };
  }

  /**
   * 구조화된 로그 출력
   */
  logStructured(level: keyof typeof LogLevel, message: string, fields: Record<string, any>): void {
    const logLevel = LogLevel[level.toUpperCase() as keyof typeof LogLevel];
    if (this.level <= logLevel) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level: level.toUpperCase(),
        message,
        context: this.context,
        ...fields
      };
      console.error(JSON.stringify(logEntry));
    }
  }
}

// 기본 로거 인스턴스
export const logger = new Logger();

/**
 * 로거 팩토리 함수
 */
export function createLogger(context?: string, level?: LogLevel): Logger {
  return new Logger(level, context);
}