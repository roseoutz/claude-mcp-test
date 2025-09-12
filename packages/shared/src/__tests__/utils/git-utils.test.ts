import { describe, it, expect } from 'vitest';
import {
  detectLanguage,
  isTestFile,
  isConfigFile,
  isDocumentFile,
  isBinaryFile,
  isCriticalFile,
  formatFileSize,
  calculateFileComplexity,
  categorizeFilesByStatus,
  normalizeFilePath,
  extractCommitType,
  gitignoreToGlob,
  LANGUAGE_EXTENSIONS
} from '../../utils/git-utils.js';

describe('git-utils', () => {
  describe('detectLanguage', () => {
    it('should detect TypeScript files', () => {
      expect(detectLanguage('component.ts')).toBe('typescript');
      expect(detectLanguage('component.tsx')).toBe('typescript');
      expect(detectLanguage('types.d.ts')).toBe('typescript');
    });

    it('should detect JavaScript files', () => {
      expect(detectLanguage('script.js')).toBe('javascript');
      expect(detectLanguage('component.jsx')).toBe('javascript');
      expect(detectLanguage('module.mjs')).toBe('javascript');
      expect(detectLanguage('config.cjs')).toBe('javascript');
    });

    it('should detect Python files', () => {
      expect(detectLanguage('main.py')).toBe('python');
      expect(detectLanguage('types.pyi')).toBe('python');
    });

    it('should detect special files', () => {
      expect(detectLanguage('Dockerfile')).toBe('dockerfile');
      expect(detectLanguage('Dockerfile.prod')).toBe('dockerfile');
      expect(detectLanguage('Makefile')).toBe('makefile');
    });

    it('should return unknown for unrecognized files', () => {
      expect(detectLanguage('file.unknown')).toBe('unknown');
      expect(detectLanguage('no-extension')).toBe('unknown');
    });
  });

  describe('isTestFile', () => {
    it('should detect test files', () => {
      expect(isTestFile('component.test.ts')).toBe(true);
      expect(isTestFile('component.spec.js')).toBe(true);
      expect(isTestFile('__tests__/component.js')).toBe(true);
      expect(isTestFile('test/unit/helper.js')).toBe(true);
      expect(isTestFile('tests/integration/api.test.js')).toBe(true);
      expect(isTestFile('src/utils_test.go')).toBe(true);
      expect(isTestFile('ComponentTest.java')).toBe(true);
    });

    it('should not detect non-test files', () => {
      expect(isTestFile('component.ts')).toBe(false);
      expect(isTestFile('utils.js')).toBe(false);
      expect(isTestFile('README.md')).toBe(false);
    });
  });

  describe('isConfigFile', () => {
    it('should detect configuration files', () => {
      expect(isConfigFile('package.json')).toBe(true);
      expect(isConfigFile('tsconfig.json')).toBe(true);
      expect(isConfigFile('webpack.config.js')).toBe(true);
      expect(isConfigFile('.eslintrc')).toBe(true);
      expect(isConfigFile('.env')).toBe(true);
      expect(isConfigFile('docker-compose.yml')).toBe(true);
      expect(isConfigFile('Dockerfile')).toBe(true);
    });

    it('should not detect non-config files', () => {
      expect(isConfigFile('component.ts')).toBe(false);
      expect(isConfigFile('utils.js')).toBe(false);
      expect(isConfigFile('data.json')).toBe(false);
    });
  });

  describe('isDocumentFile', () => {
    it('should detect documentation files', () => {
      expect(isDocumentFile('README.md')).toBe(true);
      expect(isDocumentFile('CHANGELOG.md')).toBe(true);
      expect(isDocumentFile('docs/guide.md')).toBe(true);
      expect(isDocumentFile('LICENSE')).toBe(true);
      expect(isDocumentFile('CONTRIBUTING.txt')).toBe(true);
      expect(isDocumentFile('api.rst')).toBe(true);
    });

    it('should not detect non-document files', () => {
      expect(isDocumentFile('component.ts')).toBe(false);
      expect(isDocumentFile('data.json')).toBe(false);
    });
  });

  describe('isBinaryFile', () => {
    it('should detect binary files', () => {
      expect(isBinaryFile('image.jpg')).toBe(true);
      expect(isBinaryFile('archive.zip')).toBe(true);
      expect(isBinaryFile('executable.exe')).toBe(true);
      expect(isBinaryFile('font.woff2')).toBe(true);
      expect(isBinaryFile('document.pdf')).toBe(true);
      expect(isBinaryFile('library.so')).toBe(true);
    });

    it('should not detect text files as binary', () => {
      expect(isBinaryFile('component.ts')).toBe(false);
      expect(isBinaryFile('README.md')).toBe(false);
      expect(isBinaryFile('data.json')).toBe(false);
    });
  });

  describe('isCriticalFile', () => {
    it('should detect critical files', () => {
      expect(isCriticalFile('package.json')).toBe(true);
      expect(isCriticalFile('Dockerfile')).toBe(true);
      expect(isCriticalFile('src/main.ts')).toBe(true);
      expect(isCriticalFile('src/index.js')).toBe(true);
      expect(isCriticalFile('main.go')).toBe(true);
      expect(isCriticalFile('.github/workflows/ci.yml')).toBe(true);
    });

    it('should not detect non-critical files', () => {
      expect(isCriticalFile('component.ts')).toBe(false);
      expect(isCriticalFile('utils.js')).toBe(false);
      expect(isCriticalFile('README.md')).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('should format file sizes correctly', () => {
      expect(formatFileSize(100)).toBe('100 B');
      expect(formatFileSize(1024)).toBe('1.00 KB');
      expect(formatFileSize(1048576)).toBe('1.00 MB');
      expect(formatFileSize(1073741824)).toBe('1.00 GB');
      expect(formatFileSize(1500)).toBe('1.46 KB');
      expect(formatFileSize(2500000)).toBe('2.38 MB');
    });

    it('should handle zero and small values', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(1)).toBe('1 B');
      expect(formatFileSize(999)).toBe('999 B');
    });
  });

  describe('calculateFileComplexity', () => {
    it('should calculate TypeScript complexity', () => {
      const tsCode = `
        function test() {
          if (condition) {
            for (let i = 0; i < 10; i++) {
              while (true) {
                break;
              }
            }
          }
        }
        
        class Component {
          method() {
            return true;
          }
        }
      `;
      
      const complexity = calculateFileComplexity(tsCode, 'typescript');
      expect(complexity).toBeGreaterThan(0);
      expect(complexity).toBeLessThanOrEqual(100);
    });

    it('should calculate Python complexity', () => {
      const pythonCode = `
        def test():
            if condition:
                for i in range(10):
                    while True:
                        break
        
        class Component:
            def method(self):
                return True
      `;
      
      const complexity = calculateFileComplexity(pythonCode, 'python');
      expect(complexity).toBeGreaterThan(0);
      expect(complexity).toBeLessThanOrEqual(100);
    });

    it('should handle unknown languages', () => {
      const code = 'line1\nline2\nline3\n';
      const complexity = calculateFileComplexity(code, 'unknown');
      expect(complexity).toBeGreaterThan(0);
    });
  });

  describe('categorizeFilesByStatus', () => {
    it('should categorize files by git status', () => {
      const files = [
        { path: 'new.ts', status: 'added' },
        { path: 'modified.ts', status: 'modified' },
        { path: 'deleted.ts', status: 'deleted' },
        { path: 'renamed.ts', status: 'renamed' },
        { path: 'added2.ts', status: 'A' },
        { path: 'modified2.ts', status: 'M' },
      ];

      const result = categorizeFilesByStatus(files);

      expect(result.added).toEqual(['new.ts', 'added2.ts']);
      expect(result.modified).toEqual(['modified.ts', 'modified2.ts']);
      expect(result.deleted).toEqual(['deleted.ts']);
      expect(result.renamed).toEqual(['renamed.ts']);
    });

    it('should handle empty file list', () => {
      const result = categorizeFilesByStatus([]);
      expect(result.added).toEqual([]);
      expect(result.modified).toEqual([]);
      expect(result.deleted).toEqual([]);
      expect(result.renamed).toEqual([]);
    });
  });

  describe('normalizeFilePath', () => {
    it('should normalize file paths', () => {
      expect(normalizeFilePath('src\\components\\Button.tsx')).toBe('src/components/Button.tsx');
      expect(normalizeFilePath('src/./components/../Button.tsx')).toBe('src/Button.tsx');
      expect(normalizeFilePath('./src/Button.tsx')).toBe('src/Button.tsx');
    });
  });

  describe('extractCommitType', () => {
    it('should extract conventional commit information', () => {
      expect(extractCommitType('feat: add new button component')).toEqual({
        type: 'feat',
        scope: undefined,
        description: 'add new button component',
        isBreaking: false
      });

      expect(extractCommitType('fix(auth): handle invalid tokens')).toEqual({
        type: 'fix',
        scope: 'auth',
        description: 'handle invalid tokens',
        isBreaking: false
      });

      expect(extractCommitType('feat!: remove deprecated API')).toEqual({
        type: 'feat',
        scope: undefined,
        description: 'remove deprecated API',
        isBreaking: true
      });

      expect(extractCommitType('feat(api)!: change response format')).toEqual({
        type: 'feat',
        scope: 'api',
        description: 'change response format',
        isBreaking: true
      });
    });

    it('should handle non-conventional commits', () => {
      expect(extractCommitType('Add new feature')).toEqual({
        type: 'unknown',
        scope: undefined,
        description: 'Add new feature',
        isBreaking: false
      });

      expect(extractCommitType('WIP: working on feature')).toEqual({
        type: 'WIP',
        scope: undefined,
        description: 'working on feature',
        isBreaking: false
      });
    });
  });

  describe('gitignoreToGlob', () => {
    it('should convert gitignore patterns to glob patterns', () => {
      expect(gitignoreToGlob('*.log')).toBe('**/*.log');
      expect(gitignoreToGlob('build/')).toBe('**/build/**');
      expect(gitignoreToGlob('node_modules')).toBe('**/node_modules');
      expect(gitignoreToGlob('#comment')).toBe('');
      expect(gitignoreToGlob('')).toBe('');
      expect(gitignoreToGlob('   ')).toBe('');
    });

    it('should handle complex patterns', () => {
      expect(gitignoreToGlob('src/**/*.test.js')).toBe('**/src/**/*.test.js');
      expect(gitignoreToGlob('dist/')).toBe('**/dist/**');
    });
  });

  describe('LANGUAGE_EXTENSIONS', () => {
    it('should contain common programming languages', () => {
      expect(LANGUAGE_EXTENSIONS.typescript).toContain('.ts');
      expect(LANGUAGE_EXTENSIONS.javascript).toContain('.js');
      expect(LANGUAGE_EXTENSIONS.python).toContain('.py');
      expect(LANGUAGE_EXTENSIONS.java).toContain('.java');
      expect(LANGUAGE_EXTENSIONS.go).toContain('.go');
      expect(LANGUAGE_EXTENSIONS.rust).toContain('.rs');
    });

    it('should contain web technologies', () => {
      expect(LANGUAGE_EXTENSIONS.html).toContain('.html');
      expect(LANGUAGE_EXTENSIONS.css).toContain('.css');
      expect(LANGUAGE_EXTENSIONS.vue).toContain('.vue');
      expect(LANGUAGE_EXTENSIONS.svelte).toContain('.svelte');
    });

    it('should contain configuration formats', () => {
      expect(LANGUAGE_EXTENSIONS.json).toContain('.json');
      expect(LANGUAGE_EXTENSIONS.yaml).toContain('.yml');
      expect(LANGUAGE_EXTENSIONS.xml).toContain('.xml');
    });
  });
});