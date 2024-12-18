module.exports = {
    testEnvironment: 'jsdom',
    moduleFileExtensions: ['js', 'json'],
    transform: {
        '^.+\\.js$': 'babel-jest',
    },
    testMatch: [
        '**/tests/frontend/**/*.test.js'
    ],
    setupFilesAfterEnv: [
        '<rootDir>/tests/frontend/setup/jest.setup.js'
    ],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1'
    },
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        }
    },
    testEnvironmentOptions: {
        customExportConditions: ['node', 'node-addons'],
    },
}; 