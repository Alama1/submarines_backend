/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: {
    '^@ff14/entities$': '<rootDir>/../../packages/entities/src/index.ts',
    '^@ff14/types$': '<rootDir>/../../packages/shared-types/src/index.ts',
  },
};
