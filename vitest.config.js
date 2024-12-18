import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'happy-dom',
        setupFiles: ['./tests/frontend/setup/vitest.setup.js'],
        include: ['tests/frontend/**/*.test.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            include: ['frontend/**/*.js'],
            exclude: [
                'node_modules/**',
                'tests/**',
                '**/*.config.js'
            ],
            thresholds: {
                statements: 80,
                branches: 80,
                functions: 80,
                lines: 80
            }
        }
    }
}); 