/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {}],
  },
  moduleNameMapper: {
    "^bytes$": "<rootDir>/../bytes/src/index.ts"
  },
  testPathIgnorePatterns: ["/node_modules/", "/dist/"]
};
