/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  collectCoverage: false, // Coverage는 일단 비활성화
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  // 외부 모듈 mock
  moduleNameMapper: {
    '@code-ai/shared/(.*)': '<rootDir>/../shared/src/$1',
  },
};