export default {
    testEnvironment: 'jsdom',
    moduleFileExtensions: ['js', 'json'],
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    transformIgnorePatterns: [
        '/node_modules/(?!(@open-wc|lit|@lit|@esm-bundle)/)'
    ],
    moduleNameMapper: {
        '^lit/(.*)$': '<rootDir>/../../frontend/node_modules/lit/$1',
        '^@lit/(.*)$': '<rootDir>/../../frontend/node_modules/@lit/$1',
        '^@/(.*)$': '<rootDir>/../../frontend/$1'
    },
    testMatch: [
        '<rootDir>/**/*.test.js'
    ],
    setupFilesAfterEnv: [
        '<rootDir>/setup/jest.setup.js',
        '@testing-library/jest-dom'
    ],
    collectCoverage: true,
    collectCoverageFrom: [
        '<rootDir>/../../frontend/**/*.js',
        '!<rootDir>/../../frontend/**/*.test.js',
        '!<rootDir>/../../frontend/**/*.config.js',
        '!<rootDir>/setup/**/*.js'
    ],
    coverageReporters: ['text', 'html', 'lcov'],
    coverageDirectory: '<rootDir>/../../coverage',
    coverageThreshold: {
        global: {
            statements: 80,
            branches: 80,
            functions: 80,
            lines: 80
        }
    }
}; 