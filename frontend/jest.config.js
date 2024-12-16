module.exports = {
    testEnvironment: 'jsdom',
    moduleFileExtensions: ['js', 'json'],
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1'
    },
    testMatch: [
        '<rootDir>/**/*.test.js'
    ],
    setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
    collectCoverage: true,
    collectCoverageFrom: [
        '<rootDir>/**/*.js',
        '!<rootDir>/**/jest.config.js',
        '!<rootDir>/**/test-*.js',
        '!<rootDir>/test/**/*.js'
    ],
    coverageReporters: ['text', 'html'],
    coverageDirectory: '<rootDir>/coverage'
}; 