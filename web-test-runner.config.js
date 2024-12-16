import { esbuildPlugin } from '@web/dev-server-esbuild';
import { playwrightLauncher } from '@web/test-runner-playwright';
import { importMapsPlugin } from '@web/dev-server-import-maps';

export default {
  files: [
    'tests/frontend/unit/**/*.test.js',
    'tests/frontend/integration/**/*.integration.test.js',
    'tests/frontend/e2e/**/*.e2e.test.js'
  ],
  nodeResolve: true,
  coverage: true,
  coverageConfig: {
    reportDir: 'coverage',
    reporters: ['lcov', 'text', 'html'],
    threshold: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    },
    exclude: [
      '**/node_modules/**',
      '**/test/**',
      '**/coverage/**'
    ]
  },
  browsers: [
    playwrightLauncher({
      product: 'chromium',
      launchOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    })
  ],
  plugins: [
    esbuildPlugin({
      ts: true,
      target: 'auto',
      jsxFactory: 'html',
      jsxFragment: 'fragment'
    }),
    importMapsPlugin({
      inject: {
        importMap: {
          imports: {
            '@open-wc/testing': '/node_modules/@open-wc/testing/index.js'
          }
        }
      }
    })
  ],
  testFramework: {
    config: {
      timeout: '10000',
      ui: 'bdd',
      reporter: 'spec'
    }
  },
  testRunnerHtml: testFramework => `
        <html>
            <head>
                <script type="module">
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
    }
  ],
  mimeTypes: {
    '**/*.js': 'js'
  },
  nodeResolve: {
    exportConditions: ['browser', 'development'],
    moduleDirectories: ['node_modules']
  },
  preserveSymlinks: true
}; 