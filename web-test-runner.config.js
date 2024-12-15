const { esbuildPlugin } = require('@web/dev-server-esbuild');
const { playwrightLauncher } = require('@web/test-runner-playwright');
const path = require('path');

module.exports = {
  files: 'tests/frontend/**/*.js',
  nodeResolve: true,
  coverage: true,
  coverageConfig: {
    reportDir: 'coverage',
    reporters: ['lcov', 'text'],
    threshold: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
  browsers: [
    playwrightLauncher({
      product: 'chromium',
      launchOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    }),
  ],
  plugins: [
    esbuildPlugin({
      ts: true,
      target: 'auto',
      jsxFactory: 'html',
      jsxFragment: 'fragment',
    })
  ],
  testFramework: {
    config: {
      timeout: '10000',
    },
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
  rootDir: path.resolve(__dirname),
  mimeTypes: {
    '**/*.js': 'js',
  },
  nodeResolve: {
    exportConditions: ['browser', 'development'],
    moduleDirectories: ['node_modules'],
  },
  preserveSymlinks: true,
}; 