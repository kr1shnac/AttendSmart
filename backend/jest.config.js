/**
 * Jest Configuration for AttendSmart Backend
 *
 * Configured for:
 * - Unit tests for controllers, services, utils
 * - Integration tests with MongoDB Memory Server
 * - Coverage reporting
 */

module.exports = {
  // Test environment
  testEnvironment: "node",

  // Test file patterns
  testMatch: ["**/tests/**/*.test.js", "**/tests/**/*.spec.js"],

  // Setup files
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],

  // Coverage configuration
  collectCoverageFrom: [
    "controllers/**/*.js",
    "services/**/*.js",
    "middleware/**/*.js",
    "utils/**/*.js",
    "!**/node_modules/**",
  ],

  // Coverage thresholds (start low, increase over time)
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30,
    },
  },

  // Coverage output
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],

  // Timeout for async tests
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Force exit after tests complete
  forceExit: true,

  // Clear mocks between tests
  clearMocks: true,

  // Module paths
  moduleDirectories: ["node_modules", "<rootDir>"],
};
