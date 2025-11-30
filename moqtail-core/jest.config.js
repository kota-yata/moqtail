/** @type {import('ts-jest').JestConfigWithTsJest} */
import fs from 'fs';
import ts from 'typescript';

const rawConfig = ts.readConfigFile(
  new URL('./tsconfig.json', import.meta.url).pathname,
  (p) => fs.readFileSync(p, 'utf8')
).config;
const tsconfig = {
  ...rawConfig.compilerOptions,
  paths: {
    ...(rawConfig.compilerOptions?.paths || {}),
    // Ensure absolute-style imports like 'src/...' resolve in tests
    'src/*': ['src/*']
  }
};

export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {},
  testPathIgnorePatterns: ['/node_modules/', '/dist/']
};
