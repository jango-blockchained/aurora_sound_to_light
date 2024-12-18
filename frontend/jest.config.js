module.exports = {
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    moduleFileExtensions: ['js', 'json'],
    transformIgnorePatterns: [
        '/node_modules/(?!(@open-wc|lit|@lit|@esm-bundle)/)'
    ],
    testMatch: [
        '**/*.test.js'
    ],
    setupFilesAfterEnv: [
        '@testing-library/jest-dom'
    ],
    moduleNameMapper: {
        '^lit/(.*)$': '<rootDir>/node_modules/lit/$1',
        '^@lit/(.*)$': '<rootDir>/node_modules/@lit/$1'
    }
}; 