/**
 * AI 프롬프트 템플릿 관리
 */
export class PromptTemplates {
  static codeReview(code: string, language: string): string {
    return `Review the following ${language} code and provide feedback:

\`\`\`${language}
${code}
\`\`\`

Focus on:
1. Code quality and readability
2. Performance considerations
3. Security vulnerabilities
4. Best practices
5. Potential bugs

Provide specific, actionable feedback.`;
  }

  static generateTests(code: string, framework: string = 'vitest'): string {
    return `Generate unit tests for the following code using ${framework}:

\`\`\`
${code}
\`\`\`

Include:
- Happy path tests
- Edge cases
- Error scenarios
- Mock external dependencies

Return only the test code, no explanations.`;
  }

  static documentCode(code: string): string {
    return `Add comprehensive JSDoc documentation to the following code:

\`\`\`
${code}
\`\`\`

Include:
- Function/class descriptions
- Parameter descriptions and types
- Return value descriptions
- Usage examples where appropriate
- Any thrown errors

Return the fully documented code.`;
  }

  static refactorCode(code: string, goal: string): string {
    return `Refactor the following code to ${goal}:

\`\`\`
${code}
\`\`\`

Maintain the same functionality while improving the code structure.
Return only the refactored code.`;
  }

  static explainError(error: string, context: string): string {
    return `Explain this error and how to fix it:

Error: ${error}

Context: ${context}

Provide:
1. What causes this error
2. Step-by-step solution
3. Code example of the fix
4. How to prevent it in the future`;
  }
}