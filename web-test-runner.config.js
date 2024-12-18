import { playwrightLauncher } from '@web/test-runner-playwright';
import { esbuildPlugin } from '@web/dev-server-esbuild';

export default {
  files: [
    'tests/frontend/unit/**/*.test.js',
    'tests/frontend/integration/**/*.test.js',
    'tests/frontend/e2e/**/*.test.js'
  ],
  nodeResolve: true,
  plugins: [
    esbuildPlugin({ ts: true, target: 'auto' })
  ],
  browsers: [
    playwrightLauncher({ product: 'chromium' }),
  ],
  testFramework: {
    config: {
      ui: 'bdd',
      timeout: '10000'
    }
  },
  testRunnerHtml: testFramework => `
    <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 0;
          }
        </style>
        <script type="module">
          // Import test dependencies
          import '@open-wc/testing';
          import 'chart.js';
          import 'sinon';
        </script>
      </head>
      <body>
        <script type="module" src="${testFramework}"></script>
      </body>
    </html>
  `,
  exclude: ['**/node_modules/**/*.test.js'],
  coverageConfig: {
    include: [
      'frontend/**/*.js',
      'tests/frontend/**/*.js'
    ],
    exclude: [
      '**/node_modules/**',
      'tests/frontend/setup/**',
      '**/*.test.js',
      '**/*.config.js'
    ],
    threshold: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    }
  },
  middleware: [
    function rewriteImports(context, next) {
      if (context.url.includes('/frontend/')) {
        context.url = context.url.replace('/frontend/', '/');
      }
      return next();
    }
  ]
}; 