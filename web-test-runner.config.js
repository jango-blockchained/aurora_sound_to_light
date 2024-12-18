import { playwrightLauncher } from '@web/test-runner-playwright';
import { esbuildPlugin } from '@web/dev-server-esbuild';
import { fromRollup } from '@web/dev-server-rollup';
import rollupCommonjs from '@rollup/plugin-commonjs';

const commonjs = fromRollup(rollupCommonjs);

export default {
  files: [
    'tests/frontend/**/*.test.js'
  ],
  nodeResolve: true,
  plugins: [
    esbuildPlugin({ ts: true, target: 'auto' }),
    commonjs()
  ],
  browsers: [
    playwrightLauncher({ product: 'chromium' }),
  ],
  testFramework: {
    path: '@web/test-runner-mocha',
    config: {
      ui: 'bdd',
      timeout: '60000'
    }
  },
  testRunnerHtml: testFramework => `
    <!DOCTYPE html>
    <html>
      <head>
        <script type="module">
          // Import test dependencies
          import '@open-wc/testing';
          import 'chai/chai.js';
          
          // Setup global test environment
          window.process = { env: { NODE_ENV: 'test' } };
        </script>
      </head>
      <body>
        <script type="module" src="${testFramework}"></script>
      </body>
    </html>
  `,
  middleware: [
    function rewriteBase(context, next) {
      if (context.url.startsWith('/base/')) {
        context.url = context.url.replace('/base/', '/');
      }
      return next();
    },
    function rewriteNodeModules(context, next) {
      if (context.url.includes('node_modules')) {
        context.url = context.url.replace('/node_modules/', '/');
      }
      return next();
    }
  ],
  coverageConfig: {
    include: [
      'frontend/**/*.js'
    ],
    exclude: [
      '**/node_modules/**',
      'tests/**/*.js',
      '**/*.config.js'
    ],
    threshold: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    }
  }
}; 