export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'MCPError';
    Object.setPrototypeOf(this, MCPError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      stack: this.stack,
    };
  }
}

export class ValidationError extends MCPError {
  constructor(message: string, public field?: string, public value?: any) {
    super(message, 'VALIDATION_ERROR', 400, { field, value });
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class GitOperationError extends MCPError {
  constructor(message: string, public operation?: string, public repository?: string) {
    super(message, 'GIT_OPERATION_ERROR', 500, { operation, repository });
    this.name = 'GitOperationError';
    Object.setPrototypeOf(this, GitOperationError.prototype);
  }
}

export class AIServiceError extends MCPError {
  constructor(message: string, public service?: string, public model?: string) {
    super(message, 'AI_SERVICE_ERROR', 503, { service, model });
    this.name = 'AIServiceError';
    Object.setPrototypeOf(this, AIServiceError.prototype);
  }
}

export class FileSystemError extends MCPError {
  constructor(message: string, public path?: string, public operation?: string) {
    super(message, 'FILE_SYSTEM_ERROR', 500, { path, operation });
    this.name = 'FileSystemError';
    Object.setPrototypeOf(this, FileSystemError.prototype);
  }
}

export class NetworkError extends MCPError {
  constructor(message: string, public url?: string, public method?: string) {
    super(message, 'NETWORK_ERROR', 502, { url, method });
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export class AuthenticationError extends MCPError {
  constructor(message: string, public realm?: string) {
    super(message, 'AUTHENTICATION_ERROR', 401, { realm });
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class AuthorizationError extends MCPError {
  constructor(message: string, public resource?: string, public action?: string) {
    super(message, 'AUTHORIZATION_ERROR', 403, { resource, action });
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

export class NotFoundError extends MCPError {
  constructor(message: string, public resource?: string) {
    super(message, 'NOT_FOUND_ERROR', 404, { resource });
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class RateLimitError extends MCPError {
  constructor(message: string, public retryAfter?: number) {
    super(message, 'RATE_LIMIT_ERROR', 429, { retryAfter });
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class TimeoutError extends MCPError {
  constructor(message: string, public timeout?: number) {
    super(message, 'TIMEOUT_ERROR', 408, { timeout });
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

// Error utility functions
export function isOperationalError(error: any): boolean {
  return error instanceof MCPError;
}

export function formatError(error: any): string {
  if (error instanceof MCPError) {
    return `[${error.code}] ${error.message}`;
  }
  return error?.message || String(error);
}

export function getStatusCode(error: any): number {
  if (error instanceof MCPError) {
    return error.statusCode || 500;
  }
  return 500;
}