/**
 * MCP Tool Response Formatters
 * Formats responses according to MCP protocol specifications
 */

import { CallToolResult, TextContent, ImageContent, EmbeddedResource } from '@modelcontextprotocol/sdk/types.js';

/**
 * 텍스트 응답 생성
 */
export function createTextResponse(text: string): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: text
      } as TextContent
    ]
  };
}

/**
 * JSON 데이터를 텍스트로 포맷팅하여 응답 생성
 */
export function createJsonResponse<T>(data: T, pretty: boolean = true): CallToolResult {
  const jsonString = pretty 
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);

  return createTextResponse(jsonString);
}

/**
 * 구조화된 데이터 응답 생성
 */
export function createStructuredResponse(
  summary: string, 
  details: any,
  metadata?: Record<string, any>
): CallToolResult {
  let text = `# ${summary}\n\n`;
  
  if (typeof details === 'object' && details !== null) {
    if (Array.isArray(details)) {
      details.forEach((item, index) => {
        text += `## ${index + 1}. ${JSON.stringify(item)}\n`;
      });
    } else {
      for (const [key, value] of Object.entries(details)) {
        text += `## ${key}\n`;
        if (typeof value === 'object') {
          text += `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n\n`;
        } else {
          text += `${value}\n\n`;
        }
      }
    }
  } else {
    text += `${details}\n\n`;
  }

  if (metadata) {
    text += `## Metadata\n`;
    text += `\`\`\`json\n${JSON.stringify(metadata, null, 2)}\n\`\`\`\n`;
  }

  return createTextResponse(text);
}

/**
 * 에러 응답 생성
 */
export function createErrorResponse(error: Error | string, details?: any): CallToolResult {
  const errorMessage = error instanceof Error ? error.message : error;
  const stack = error instanceof Error ? error.stack : undefined;
  
  let text = `❌ **Error**: ${errorMessage}\n\n`;
  
  if (stack) {
    text += `**Stack Trace:**\n\`\`\`\n${stack}\n\`\`\`\n\n`;
  }
  
  if (details) {
    text += `**Details:**\n\`\`\`json\n${JSON.stringify(details, null, 2)}\n\`\`\`\n`;
  }

  return {
    content: [
      {
        type: 'text',
        text: text
      } as TextContent
    ],
    isError: true
  };
}

/**
 * 성공 응답 생성 (체크마크와 함께)
 */
export function createSuccessResponse(message: string, data?: any): CallToolResult {
  let text = `✅ ${message}\n\n`;
  
  if (data) {
    text += `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n`;
  }

  return createTextResponse(text);
}

/**
 * 진행 상황 응답 생성
 */
export function createProgressResponse(
  current: number, 
  total: number, 
  message: string,
  details?: string[]
): CallToolResult {
  const percentage = Math.round((current / total) * 100);
  const progressBar = '█'.repeat(Math.floor(percentage / 5)) + 
                     '░'.repeat(20 - Math.floor(percentage / 5));
  
  let text = `🔄 **Progress**: ${current}/${total} (${percentage}%)\n`;
  text += `[${progressBar}]\n\n`;
  text += `${message}\n`;
  
  if (details && details.length > 0) {
    text += `\n**Details:**\n`;
    details.forEach(detail => {
      text += `• ${detail}\n`;
    });
  }

  return createTextResponse(text);
}

/**
 * 파일 목록 응답 생성
 */
export function createFileListResponse(
  files: Array<{
    path: string;
    size?: number;
    modified?: Date;
    type?: string;
  }>,
  title: string = 'Files'
): CallToolResult {
  let text = `📁 **${title}**\n\n`;
  
  if (files.length === 0) {
    text += 'No files found.\n';
  } else {
    text += `Found ${files.length} files:\n\n`;
    
    files.forEach(file => {
      text += `• \`${file.path}\``;
      
      if (file.size !== undefined) {
        const sizeKB = (file.size / 1024).toFixed(1);
        text += ` (${sizeKB} KB)`;
      }
      
      if (file.type) {
        text += ` [${file.type}]`;
      }
      
      if (file.modified) {
        text += ` - ${file.modified.toISOString().split('T')[0]}`;
      }
      
      text += '\n';
    });
  }

  return createTextResponse(text);
}

/**
 * 테이블 형태 응답 생성
 */
export function createTableResponse<T extends Record<string, any>>(
  data: T[],
  title?: string,
  columns?: (keyof T)[]
): CallToolResult {
  let text = title ? `📊 **${title}**\n\n` : '';
  
  if (data.length === 0) {
    text += 'No data available.\n';
    return createTextResponse(text);
  }

  // 컬럼 결정
  const cols = columns || Object.keys(data[0]) as (keyof T)[];
  
  // 헤더
  const header = cols.join(' | ');
  const separator = cols.map(() => '---').join(' | ');
  
  text += `| ${header} |\n`;
  text += `| ${separator} |\n`;
  
  // 데이터 행
  data.forEach(row => {
    const values = cols.map(col => {
      const value = row[col];
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    });
    text += `| ${values.join(' | ')} |\n`;
  });

  return createTextResponse(text);
}

/**
 * 코드 블록 응답 생성
 */
export function createCodeResponse(
  code: string,
  language: string = '',
  filename?: string
): CallToolResult {
  let text = '';
  
  if (filename) {
    text += `📄 **${filename}**\n\n`;
  }
  
  text += `\`\`\`${language}\n${code}\n\`\`\`\n`;

  return createTextResponse(text);
}

/**
 * 단계별 가이드 응답 생성
 */
export function createStepGuideResponse(
  title: string,
  steps: Array<{
    title: string;
    description: string;
    code?: string;
    note?: string;
  }>
): CallToolResult {
  let text = `📋 **${title}**\n\n`;
  
  steps.forEach((step, index) => {
    text += `## ${index + 1}. ${step.title}\n\n`;
    text += `${step.description}\n\n`;
    
    if (step.code) {
      text += `\`\`\`\n${step.code}\n\`\`\`\n\n`;
    }
    
    if (step.note) {
      text += `> **Note**: ${step.note}\n\n`;
    }
  });

  return createTextResponse(text);
}

/**
 * 통계 응답 생성
 */
export function createStatsResponse(stats: Record<string, number | string>): CallToolResult {
  let text = '📈 **Statistics**\n\n';
  
  for (const [key, value] of Object.entries(stats)) {
    const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    text += `• **${formattedKey}**: ${typeof value === 'number' ? value.toLocaleString() : value}\n`;
  }

  return createTextResponse(text);
}